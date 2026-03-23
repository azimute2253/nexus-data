/**
 * migrate-to-supabase.mjs — Legacy Data Migration Script
 *
 * Reads CSV files from data/fixtures/ via Story 2.1 parser and inserts data
 * into Supabase in FK dependency order:
 *   1. asset_types       (10 rows)
 *   2. questionnaires    (3 rows)
 *   3. asset_groups      (~15 rows, FK → asset_types)
 *   4. assets            (131+ rows, FK → asset_groups)
 *   5. asset_scores      (per-asset scores, FK → assets + questionnaires)
 *
 * Idempotent via UPSERT (ON CONFLICT DO UPDATE) — safe to re-run.
 * Requires: SUPABASE_SERVICE_ROLE_KEY, PUBLIC_SUPABASE_URL, NEXUS_USER_ID
 *
 * Usage:
 *   node scripts/migrate-to-supabase.mjs                  # full migration
 *   node scripts/migrate-to-supabase.mjs --dry-run        # preview only
 *   node scripts/migrate-to-supabase.mjs --fixtures ./dir  # custom fixtures dir
 *
 * [Story 2.2 — ADR-008 Obligations 1, 4, 7]
 */

import { createClient } from '@supabase/supabase-js';
import { parseAllSheets } from './parse-sheets.mjs';
import { join, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULTS = {
  fixturesDir: join(import.meta.dirname, '..', 'data', 'fixtures'),
};

/**
 * Asset type name → config used for mapping groups and determining price_source.
 * sort_order reflects the spreadsheet row order (1-indexed).
 */
const TYPE_CONFIG = {
  'Reserva de investimento': { sort_order: 1, scoring_method: 'none', tab: 'riRvRf', price_source: 'manual', currency: 'BRL', whole_shares: false },
  'Reserva de valor':        { sort_order: 2, scoring_method: 'none', tab: 'riRvRf', price_source: 'manual', currency: 'BRL', whole_shares: false },
  'Renda fixa BR':           { sort_order: 3, scoring_method: 'none', tab: 'riRvRf', price_source: 'manual', currency: 'BRL', whole_shares: false },
  'FIIs':                    { sort_order: 4, scoring_method: 'questionnaire', tab: 'fiis', price_source: 'brapi', currency: 'BRL', whole_shares: true },
  'Ações BR':                { sort_order: 5, scoring_method: 'questionnaire', tab: 'acoes', price_source: 'brapi', currency: 'BRL', whole_shares: true },
  'Ações US':                { sort_order: 6, scoring_method: 'questionnaire', tab: 'exterior', price_source: 'yahoo', currency: 'USD', whole_shares: false },
  'REITs':                   { sort_order: 7, scoring_method: 'questionnaire', tab: 'exterior', price_source: 'yahoo', currency: 'USD', whole_shares: false },
  'Renda fixa no exterior':  { sort_order: 8, scoring_method: 'none', tab: 'exterior', price_source: 'yahoo', currency: 'USD', whole_shares: false },
  'Ações Europa':            { sort_order: 9, scoring_method: 'questionnaire', tab: null, price_source: 'yahoo', currency: 'EUR', whole_shares: false },
  'Ações Asia':              { sort_order: 10, scoring_method: 'questionnaire', tab: null, price_source: 'yahoo', currency: 'JPY', whole_shares: false },
};

/**
 * Map from spreadsheet type name to the questionnaire it uses.
 * Only types with scoring_method='questionnaire' get scored.
 */
const QUESTIONNAIRE_MAP = {
  'FIIs':       'FIIs',
  'Ações BR':   'Acoes',
  'Ações US':   'ETFs',
  'REITs':      'ETFs',
  'Ações Europa': 'ETFs',
  'Ações Asia':   'ETFs',
};

/**
 * Questions per questionnaire type, derived from the balanceamentos tab.
 * FIIs and Acoes have distinct questions; ETFs share a generic set.
 */
const QUESTIONNAIRE_DEFINITIONS = {
  FIIs: {
    name: 'FIIs',
    questions: [
      'Nenhum ativo concentra a renda em mais que 20%?',
      'Nenhum credor concentra a renda em mais que 20%?',
      'Tem 05 ou mais imóveis?',
      'Tem vacância menor que 5%?',
      'É monoativo?',
      'Tem DY acima de 8%?',
      'Paga dividendos regularmente?',
    ],
  },
  Acoes: {
    name: 'Ações BR',
    questions: [
      'Nenhum ativo concentra a renda em mais que 20%?',
      'Nenhum credor concentra a renda em mais que 20%?',
      'Paga dividendos regularmente?',
      'Tem lucro crescente nos últimos 5 anos?',
      'Tem dívida controlada?',
      'ROE acima de 15%?',
    ],
  },
  ETFs: {
    name: 'ETFs/International',
    questions: [],
  },
};

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}. See .env.example.`);
  }
  return value;
}

async function loadEnvFile() {
  // Try loading .env.local or .env from project root
  const { readFileSync } = await import('node:fs');
  const root = join(import.meta.dirname, '..');

  for (const name of ['.env.local', '.env']) {
    try {
      const content = readFileSync(join(root, name), 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx < 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
      return;
    } catch {
      // file doesn't exist, try next
    }
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, fixturesDir: DEFAULTS.fixturesDir };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      opts.dryRun = true;
    } else if (args[i] === '--fixtures' && args[i + 1]) {
      opts.fixturesDir = resolve(args[++i]);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Migration summary tracker
// ---------------------------------------------------------------------------

class MigrationSummary {
  constructor() {
    /** @type {Record<string, { inserted: number, updated: number, skipped: number, errors: string[] }>} */
    this.tables = {};
  }

  init(table) {
    if (!this.tables[table]) {
      this.tables[table] = { inserted: 0, updated: 0, skipped: 0, errors: [] };
    }
  }

  recordInsert(table) { this.init(table); this.tables[table].inserted++; }
  recordUpdate(table) { this.init(table); this.tables[table].updated++; }
  recordSkip(table) { this.init(table); this.tables[table].skipped++; }
  recordError(table, msg) { this.init(table); this.tables[table].errors.push(msg); }

  print() {
    console.log('\n========================================');
    console.log('  Migration Summary');
    console.log('========================================');
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const [table, stats] of Object.entries(this.tables)) {
      const total = stats.inserted + stats.updated + stats.skipped;
      console.log(`\n  ${table}:`);
      console.log(`    Inserted: ${stats.inserted}`);
      console.log(`    Updated:  ${stats.updated}`);
      console.log(`    Skipped:  ${stats.skipped}`);
      console.log(`    Errors:   ${stats.errors.length}`);
      if (stats.errors.length > 0) {
        stats.errors.forEach(e => console.log(`      ⚠ ${e}`));
      }
      totalInserted += stats.inserted;
      totalUpdated += stats.updated;
      totalSkipped += stats.skipped;
      totalErrors += stats.errors.length;
    }

    console.log('\n----------------------------------------');
    console.log(`  Total: ${totalInserted} inserted, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`);
    console.log('========================================\n');

    return { totalInserted, totalUpdated, totalSkipped, totalErrors };
  }
}

// ---------------------------------------------------------------------------
// Phase 1: asset_types
// ---------------------------------------------------------------------------

/**
 * Migrate asset types. Returns a map of type name → UUID.
 * Uses select-then-upsert since asset_types has no unique constraint on (name, user_id).
 */
async function migrateAssetTypes(supabase, distribuicao, userId, dryRun, summary) {
  console.log('\n--- Phase 1: asset_types ---');
  const typeMap = new Map(); // name → id

  // Fetch existing types for this user
  const { data: existing } = await supabase
    .from('asset_types')
    .select('id, name')
    .eq('user_id', userId);

  const existingByName = new Map((existing ?? []).map(r => [r.name, r.id]));

  for (let i = 0; i < distribuicao.length; i++) {
    const rec = distribuicao[i];
    const config = TYPE_CONFIG[rec.name] ?? { sort_order: i + 1 };
    const row = {
      name: rec.name,
      target_pct: rec.target_pct,
      sort_order: config.sort_order,
      user_id: userId,
    };

    console.log(`  [${i + 1}/${distribuicao.length}] ${rec.name} (target: ${(rec.target_pct * 100).toFixed(0)}%)`);

    if (dryRun) {
      typeMap.set(rec.name, existingByName.get(rec.name) ?? `<dry-run-${i}>`);
      summary.recordSkip('asset_types');
      continue;
    }

    const existingId = existingByName.get(rec.name);
    if (existingId) {
      // Update existing
      const { error } = await supabase
        .from('asset_types')
        .update({ target_pct: row.target_pct, sort_order: row.sort_order })
        .eq('id', existingId);

      if (error) {
        summary.recordError('asset_types', `${rec.name}: ${error.message}`);
        console.log(`    ⚠ Error updating: ${error.message}`);
      } else {
        typeMap.set(rec.name, existingId);
        summary.recordUpdate('asset_types');
      }
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('asset_types')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        summary.recordError('asset_types', `${rec.name}: ${error.message}`);
        console.log(`    ⚠ Error inserting: ${error.message}`);
      } else {
        typeMap.set(rec.name, data.id);
        summary.recordInsert('asset_types');
      }
    }
  }

  console.log(`  → ${typeMap.size} asset types mapped`);
  return typeMap;
}

// ---------------------------------------------------------------------------
// Phase 2: questionnaires
// ---------------------------------------------------------------------------

/**
 * Migrate questionnaires. Returns a map of questionnaire key → UUID.
 */
async function migrateQuestionnaires(supabase, balanceamentos, typeMap, userId, dryRun, summary) {
  console.log('\n--- Phase 2: questionnaires ---');
  const qMap = new Map(); // key (FIIs/Acoes/ETFs) → id

  // Fetch existing questionnaires for this user
  const { data: existing } = await supabase
    .from('questionnaires')
    .select('id, name')
    .eq('user_id', userId);

  const existingByName = new Map((existing ?? []).map(r => [r.name, r.id]));

  const entries = Object.entries(QUESTIONNAIRE_DEFINITIONS);
  for (let i = 0; i < entries.length; i++) {
    const [key, def] = entries[i];

    // Resolve asset_type_id for this questionnaire
    const typeEntries = Object.entries(QUESTIONNAIRE_MAP).filter(([, qKey]) => qKey === key);
    const firstTypeName = typeEntries[0]?.[0];
    const assetTypeId = firstTypeName ? typeMap.get(firstTypeName) : null;

    // Use questions from the balanceamentos parse if available, else from definitions
    const questions = def.questions.length > 0
      ? def.questions.map(text => ({ text, weight: 1 }))
      : balanceamentos.questions;

    const row = {
      name: def.name,
      asset_type_id: assetTypeId,
      questions,
      user_id: userId,
    };

    console.log(`  [${i + 1}/${entries.length}] ${def.name} (${questions.length} questions)`);

    if (dryRun) {
      qMap.set(key, existingByName.get(def.name) ?? `<dry-run-q-${i}>`);
      summary.recordSkip('questionnaires');
      continue;
    }

    const existingId = existingByName.get(def.name);
    if (existingId) {
      const { error } = await supabase
        .from('questionnaires')
        .update({ asset_type_id: assetTypeId, questions })
        .eq('id', existingId);

      if (error) {
        summary.recordError('questionnaires', `${def.name}: ${error.message}`);
        console.log(`    ⚠ Error updating: ${error.message}`);
      } else {
        qMap.set(key, existingId);
        summary.recordUpdate('questionnaires');
      }
    } else {
      const { data, error } = await supabase
        .from('questionnaires')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        summary.recordError('questionnaires', `${def.name}: ${error.message}`);
        console.log(`    ⚠ Error inserting: ${error.message}`);
      } else {
        qMap.set(key, data.id);
        summary.recordInsert('questionnaires');
      }
    }
  }

  console.log(`  → ${qMap.size} questionnaires mapped`);
  return qMap;
}

// ---------------------------------------------------------------------------
// Phase 3: asset_groups
// ---------------------------------------------------------------------------

/**
 * Build the group definitions from parsed data.
 * Groups are identified by (typeName, groupLabel) from the spreadsheet.
 * Returns an array of group definitions ready for insertion.
 */
function buildGroupDefinitions(parsed, typeMap) {
  const groups = [];
  const seen = new Set();

  const addGroups = (assets, typeName) => {
    const typeId = typeMap.get(typeName);
    if (!typeId) return;

    const config = TYPE_CONFIG[typeName] ?? {};

    for (const asset of assets) {
      const groupLabel = asset.group ?? 'Default';
      const key = `${typeName}||${groupLabel}`;
      if (seen.has(key)) continue;
      seen.add(key);

      groups.push({
        type_id: typeId,
        name: `${typeName} — ${groupLabel}`,
        target_pct: null, // Groups don't have target_pct in the spreadsheet
        scoring_method: config.scoring_method ?? 'none',
        _type_name: typeName,
        _group_label: groupLabel,
      });
    }
  };

  // FIIs — all in one group (no group column in CSV, they're all FIIs)
  const fiisTypeId = typeMap.get('FIIs');
  if (fiisTypeId && parsed.fiis.length > 0) {
    groups.push({
      type_id: fiisTypeId,
      name: 'FIIs — Default',
      target_pct: null,
      scoring_method: 'questionnaire',
      _type_name: 'FIIs',
      _group_label: 'Default',
    });
    seen.add('FIIs||Default');
  }

  // Ações BR — groups from CSV column
  addGroups(parsed.acoes, 'Ações BR');

  // RI, RV e RF — map groups to the correct asset types
  for (const asset of parsed.riRvRf) {
    const groupLabel = asset.group ?? 'Default';
    // Map RI/RV/RF assets to correct type by examining the asset
    let typeName;
    if (asset.ticker === 'ROMP') {
      typeName = 'Reserva de investimento';
    } else if (asset.ticker.startsWith('Tesouro')) {
      typeName = 'Renda fixa BR';
    } else {
      typeName = 'Reserva de valor';
    }

    const key = `${typeName}||${groupLabel}`;
    if (!seen.has(key)) {
      seen.add(key);
      const typeId = typeMap.get(typeName);
      if (typeId) {
        groups.push({
          type_id: typeId,
          name: `${typeName} — ${groupLabel}`,
          target_pct: null,
          scoring_method: 'none',
          _type_name: typeName,
          _group_label: groupLabel,
        });
      }
    }
  }

  // Exterior — map groups to the correct asset types based on ticker
  const EXTERIOR_TYPE_MAP = {
    VOO: 'Ações US', QQQM: 'Ações US', SCHD: 'Ações US',
    BND: 'Renda fixa no exterior',
    IAU: 'Reserva de valor',
  };

  for (const asset of parsed.exterior) {
    const typeName = EXTERIOR_TYPE_MAP[asset.ticker];
    if (!typeName) continue;
    const groupLabel = asset.group ?? 'Default';
    const key = `${typeName}||${groupLabel}`;
    if (!seen.has(key)) {
      seen.add(key);
      const typeId = typeMap.get(typeName);
      if (typeId) {
        const config = TYPE_CONFIG[typeName] ?? {};
        groups.push({
          type_id: typeId,
          name: `${typeName} — ${groupLabel}`,
          target_pct: null,
          scoring_method: config.scoring_method ?? 'none',
          _type_name: typeName,
          _group_label: groupLabel,
        });
      }
    }
  }

  return groups;
}

/**
 * Migrate asset groups. Returns a map of "typeName||groupLabel" → UUID.
 */
async function migrateAssetGroups(supabase, parsed, typeMap, userId, dryRun, summary) {
  console.log('\n--- Phase 3: asset_groups ---');

  const groupDefs = buildGroupDefinitions(parsed, typeMap);
  const groupMap = new Map(); // "typeName||groupLabel" → id

  // Fetch existing groups for this user
  const { data: existing } = await supabase
    .from('asset_groups')
    .select('id, name, type_id')
    .eq('user_id', userId);

  const existingByName = new Map((existing ?? []).map(r => [r.name, r.id]));

  for (let i = 0; i < groupDefs.length; i++) {
    const def = groupDefs[i];
    const key = `${def._type_name}||${def._group_label}`;
    const row = {
      type_id: def.type_id,
      name: def.name,
      target_pct: def.target_pct,
      scoring_method: def.scoring_method,
      user_id: userId,
    };

    console.log(`  [${i + 1}/${groupDefs.length}] ${def.name}`);

    if (dryRun) {
      groupMap.set(key, existingByName.get(def.name) ?? `<dry-run-g-${i}>`);
      summary.recordSkip('asset_groups');
      continue;
    }

    const existingId = existingByName.get(def.name);
    if (existingId) {
      const { error } = await supabase
        .from('asset_groups')
        .update({ type_id: def.type_id, target_pct: def.target_pct, scoring_method: def.scoring_method })
        .eq('id', existingId);

      if (error) {
        summary.recordError('asset_groups', `${def.name}: ${error.message}`);
        console.log(`    ⚠ Error updating: ${error.message}`);
      } else {
        groupMap.set(key, existingId);
        summary.recordUpdate('asset_groups');
      }
    } else {
      const { data, error } = await supabase
        .from('asset_groups')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        summary.recordError('asset_groups', `${def.name}: ${error.message}`);
        console.log(`    ⚠ Error inserting: ${error.message}`);
      } else {
        groupMap.set(key, data.id);
        summary.recordInsert('asset_groups');
      }
    }
  }

  console.log(`  → ${groupMap.size} asset groups mapped`);
  return groupMap;
}

// ---------------------------------------------------------------------------
// Phase 4: assets
// ---------------------------------------------------------------------------

/**
 * Build the full list of assets from all tabs, with FK references resolved.
 */
function buildAssetList(parsed, groupMap) {
  const assets = [];

  // FIIs
  for (const fii of parsed.fiis) {
    assets.push({
      ticker: fii.ticker,
      name: null,
      sector: fii.sector,
      quantity: fii.quantity,
      _group_key: 'FIIs||Default',
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
    });
  }

  // Ações BR
  for (const acao of parsed.acoes) {
    assets.push({
      ticker: acao.ticker,
      name: null,
      sector: null,
      quantity: acao.quantity,
      _group_key: `Ações BR||${acao.group ?? 'Default'}`,
      price_source: 'brapi',
      is_active: true,
      manual_override: false,
      whole_shares: true,
    });
  }

  // RI, RV e RF
  const RIRV_TYPE_MAP = {
    ROMP: 'Reserva de investimento',
  };
  for (const asset of parsed.riRvRf) {
    let typeName = RIRV_TYPE_MAP[asset.ticker];
    if (!typeName) {
      typeName = asset.ticker.startsWith('Tesouro') ? 'Renda fixa BR' : 'Reserva de valor';
    }
    const groupLabel = asset.group ?? 'Default';
    assets.push({
      ticker: asset.ticker,
      name: null,
      sector: asset.sector,
      quantity: asset.quantity,
      _group_key: `${typeName}||${groupLabel}`,
      price_source: 'manual',
      is_active: true,
      manual_override: false,
      whole_shares: false,
    });
  }

  // Exterior
  const EXTERIOR_TYPE_MAP = {
    VOO: 'Ações US', QQQM: 'Ações US', SCHD: 'Ações US',
    BND: 'Renda fixa no exterior',
    IAU: 'Reserva de valor',
  };
  for (const asset of parsed.exterior) {
    const typeName = EXTERIOR_TYPE_MAP[asset.ticker];
    if (!typeName) {
      console.log(`    ⚠ Unknown exterior ticker type mapping for: ${asset.ticker}, skipping`);
      continue;
    }
    const groupLabel = asset.group ?? 'Default';
    assets.push({
      ticker: asset.ticker,
      name: null,
      sector: null,
      quantity: asset.quantity,
      _group_key: `${typeName}||${groupLabel}`,
      price_source: 'yahoo',
      is_active: true,
      manual_override: false,
      whole_shares: false,
    });
  }

  return assets;
}

/**
 * Migrate assets. Returns a map of ticker → UUID.
 * Uses UPSERT via the (ticker, user_id) unique constraint.
 */
async function migrateAssets(supabase, parsed, groupMap, userId, dryRun, summary) {
  console.log('\n--- Phase 4: assets ---');

  const assetList = buildAssetList(parsed, groupMap);
  const assetMap = new Map(); // ticker → id

  // Fetch existing assets for this user
  const { data: existing } = await supabase
    .from('assets')
    .select('id, ticker')
    .eq('user_id', userId);

  const existingByTicker = new Map((existing ?? []).map(r => [r.ticker, r.id]));

  for (let i = 0; i < assetList.length; i++) {
    const asset = assetList[i];
    const groupId = groupMap.get(asset._group_key);

    if (!groupId) {
      const msg = `${asset.ticker}: missing group_id for key "${asset._group_key}"`;
      summary.recordError('assets', msg);
      console.log(`  [${i + 1}/${assetList.length}] ⚠ ${msg}`);
      continue;
    }

    const row = {
      ticker: asset.ticker,
      name: asset.name,
      sector: asset.sector,
      quantity: asset.quantity,
      group_id: groupId,
      price_source: asset.price_source,
      is_active: asset.is_active,
      manual_override: asset.manual_override,
      whole_shares: asset.whole_shares,
      user_id: userId,
    };

    console.log(`  [${i + 1}/${assetList.length}] ${asset.ticker} (qty: ${asset.quantity})`);

    if (dryRun) {
      assetMap.set(asset.ticker, existingByTicker.get(asset.ticker) ?? `<dry-run-a-${i}>`);
      summary.recordSkip('assets');
      continue;
    }

    const existingId = existingByTicker.get(asset.ticker);
    if (existingId) {
      const { error } = await supabase
        .from('assets')
        .update({
          sector: row.sector,
          quantity: row.quantity,
          group_id: row.group_id,
          price_source: row.price_source,
          is_active: row.is_active,
          manual_override: row.manual_override,
          whole_shares: row.whole_shares,
        })
        .eq('id', existingId);

      if (error) {
        summary.recordError('assets', `${asset.ticker}: ${error.message}`);
        console.log(`    ⚠ Error updating: ${error.message}`);
      } else {
        assetMap.set(asset.ticker, existingId);
        summary.recordUpdate('assets');
      }
    } else {
      const { data, error } = await supabase
        .from('assets')
        .insert(row)
        .select('id')
        .single();

      if (error) {
        summary.recordError('assets', `${asset.ticker}: ${error.message}`);
        console.log(`    ⚠ Error inserting: ${error.message}`);
      } else {
        assetMap.set(asset.ticker, data.id);
        summary.recordInsert('assets');
      }
    }
  }

  console.log(`  → ${assetMap.size} assets mapped`);
  return assetMap;
}

// ---------------------------------------------------------------------------
// Phase 5: asset_scores
// ---------------------------------------------------------------------------

/**
 * Migrate asset scores from the balanceamentos tab.
 * Uses the (asset_id, questionnaire_id) unique constraint for upsert.
 */
async function migrateAssetScores(supabase, balanceamentos, assetMap, qMap, typeMap, userId, dryRun, summary) {
  console.log('\n--- Phase 5: asset_scores ---');

  // Build reverse map: type_id → questionnaire key
  const typeIdToQKey = new Map();
  for (const [typeName, qKey] of Object.entries(QUESTIONNAIRE_MAP)) {
    const typeId = typeMap.get(typeName);
    if (typeId) typeIdToQKey.set(typeId, qKey);
  }

  // Build ticker → type_name map by inspecting which group each asset belongs to
  // We need to know which questionnaire to use per ticker
  const tickerToQKey = new Map();

  // FIIs
  for (const fii of Object.keys(balanceamentos.scores)) {
    // Check if this ticker is in parsed fiis
    // Simple heuristic: FII tickers end in 11, stock tickers end in 3/4
    // Better: check against actual parsed data
  }

  // Use a simpler approach: look up each scored ticker in the asset map
  // and check its group to determine the questionnaire
  const { data: assetsWithGroups } = dryRun
    ? { data: [] }
    : await supabase
        .from('assets')
        .select('id, ticker, group_id, asset_groups(type_id)')
        .eq('user_id', userId);

  const tickerToTypeId = new Map();
  for (const a of (assetsWithGroups ?? [])) {
    const typeId = a.asset_groups?.type_id;
    if (typeId) tickerToTypeId.set(a.ticker, typeId);
  }

  const scoredTickers = Object.keys(balanceamentos.scores);
  let count = 0;

  for (const ticker of scoredTickers) {
    count++;
    const assetId = assetMap.get(ticker);
    if (!assetId) {
      summary.recordSkip('asset_scores');
      console.log(`  [${count}/${scoredTickers.length}] ${ticker}: not in assets table, skipping score`);
      continue;
    }

    // Determine questionnaire
    const typeId = tickerToTypeId.get(ticker);
    const qKey = typeId ? typeIdToQKey.get(typeId) : null;
    const questionnaireId = qKey ? qMap.get(qKey) : null;

    if (!questionnaireId) {
      summary.recordSkip('asset_scores');
      console.log(`  [${count}/${scoredTickers.length}] ${ticker}: no questionnaire mapping, skipping score`);
      continue;
    }

    const scoreData = balanceamentos.scores[ticker];
    const row = {
      asset_id: assetId,
      questionnaire_id: questionnaireId,
      answers: scoreData.answers,
      total_score: scoreData.total_score,
      user_id: userId,
    };

    console.log(`  [${count}/${scoredTickers.length}] ${ticker}: score=${scoreData.total_score}`);

    if (dryRun) {
      summary.recordSkip('asset_scores');
      continue;
    }

    // Upsert: try insert, on conflict update
    // asset_scores has UNIQUE (asset_id, questionnaire_id)
    const { data: existingScore } = await supabase
      .from('asset_scores')
      .select('id')
      .eq('asset_id', assetId)
      .eq('questionnaire_id', questionnaireId)
      .maybeSingle();

    if (existingScore) {
      const { error } = await supabase
        .from('asset_scores')
        .update({ answers: scoreData.answers, total_score: scoreData.total_score })
        .eq('id', existingScore.id);

      if (error) {
        summary.recordError('asset_scores', `${ticker}: ${error.message}`);
        console.log(`    ⚠ Error updating: ${error.message}`);
      } else {
        summary.recordUpdate('asset_scores');
      }
    } else {
      const { error } = await supabase
        .from('asset_scores')
        .insert(row);

      if (error) {
        summary.recordError('asset_scores', `${ticker}: ${error.message}`);
        console.log(`    ⚠ Error inserting: ${error.message}`);
      } else {
        summary.recordInsert('asset_scores');
      }
    }
  }

  console.log(`  → ${count} scores processed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load environment
  await loadEnvFile();

  const opts = parseArgs();
  const mode = opts.dryRun ? 'DRY RUN' : 'LIVE';

  console.log('========================================');
  console.log(`  Nexus Data — Legacy Migration [${mode}]`);
  console.log('========================================');
  console.log(`  Fixtures: ${opts.fixturesDir}`);

  // Validate environment
  const supabaseUrl = requireEnv('PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const userId = requireEnv('NEXUS_USER_ID');

  console.log(`  Supabase: ${supabaseUrl}`);
  console.log(`  User ID:  ${userId}`);

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Parse all CSV files
  console.log('\n--- Parsing CSV files ---');
  const parsed = parseAllSheets(opts.fixturesDir);
  console.log(`  distribuicao: ${parsed.distribuicao.length} types`);
  console.log(`  acoes:        ${parsed.acoes.length} stocks`);
  console.log(`  fiis:         ${parsed.fiis.length} funds`);
  console.log(`  riRvRf:       ${parsed.riRvRf.length} fixed income`);
  console.log(`  exterior:     ${parsed.exterior.length} foreign`);
  console.log(`  balanceamentos: ${Object.keys(parsed.balanceamentos.scores).length} scored tickers`);
  if (parsed.warnings.length > 0) {
    console.log(`  Warnings: ${parsed.warnings.length}`);
    parsed.warnings.forEach(w => console.log(`    ⚠ ${w}`));
  }

  const summary = new MigrationSummary();

  // Execute in FK dependency order
  const typeMap = await migrateAssetTypes(supabase, parsed.distribuicao, userId, opts.dryRun, summary);
  const qMap = await migrateQuestionnaires(supabase, parsed.balanceamentos, typeMap, userId, opts.dryRun, summary);
  const groupMap = await migrateAssetGroups(supabase, parsed, typeMap, userId, opts.dryRun, summary);
  const assetMap = await migrateAssets(supabase, parsed, groupMap, userId, opts.dryRun, summary);
  await migrateAssetScores(supabase, parsed.balanceamentos, assetMap, qMap, typeMap, userId, opts.dryRun, summary);

  // Print summary
  const totals = summary.print();

  if (totals.totalErrors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});
