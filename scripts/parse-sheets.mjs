/**
 * parse-sheets.mjs — CSV Parser for Google Sheets Export
 *
 * Reads CSV files exported from the 6 Google Sheets tabs and transforms
 * Brazilian-format data into structured JSON matching the Supabase schema.
 *
 * Expected CSV format (per tab):
 *
 *   distribuicao.csv   — Tipo de ativo, Porcentagem desejada, Valor atual
 *   acoes.csv          — Ação, Quantidade, Cotação, Saldo, Grupo
 *   fiis.csv           — Fundos, Setor, Quantidade, Cotação, Saldo, %Carteira
 *   ri-rv-rf.csv       — Ativo, Setor, Quantidade, Cotação, Saldo, Grupo
 *   exterior.csv       — Ativo, Quantidade, Cotação, Saldo, Grupo
 *   balanceamentos.csv — Pergunta, <ticker1>, <ticker2>, ..., Score (last row)
 *
 * Brazilian number format: "R$ 1.234,56" → 1234.56
 * Ticker normalization:    "VALE3.SA " → "VALE3"
 * Error markers:           "#N/A", "#REF!" → null
 */

import Papa from 'papaparse';
import { readFileSync } from 'node:fs';

// ---------------------------------------------------------------------------
// Value transforms
// ---------------------------------------------------------------------------

const ERROR_MARKERS = new Set(['#N/A', '#REF!', '#VALUE!', '#DIV/0!', '#NAME?', '#NULL!']);

/**
 * Parse a Brazilian-format currency/number string to a JS number.
 * Handles: "R$ 1.234,56", "US$ 608,38", "1.234,56", "5%", plain numbers.
 * Returns null for error markers and empty strings.
 */
export function parseBRNumber(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (str === '' || ERROR_MARKERS.has(str)) return null;

  // Strip currency prefix (R$, US$, etc.)
  let cleaned = str.replace(/^[A-Z]{1,3}\$\s*/i, '');

  // Strip percentage suffix
  cleaned = cleaned.replace(/%$/, '');

  // Brazilian format: 1.234,56 → remove dots, replace comma with dot
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }

  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * Parse a percentage string like "5%" or "0.05" to a decimal.
 * "5%" → 0.05, "0.05" → 0.05
 */
export function parsePercentage(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (str === '' || ERROR_MARKERS.has(str)) return null;

  if (str.endsWith('%')) {
    const num = parseBRNumber(str);
    return num != null ? num / 100 : null;
  }
  return parseBRNumber(str);
}

/**
 * Normalize a ticker symbol.
 * "VALE3.SA " → "VALE3", " bbas3.sa" → "BBAS3"
 */
export function normalizeTicker(raw) {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (str === '' || ERROR_MARKERS.has(str)) return null;
  return str.replace(/\.SA$/i, '').toUpperCase().trim();
}

/**
 * Check if a value is an error marker (#N/A, #REF!, etc.)
 */
export function isErrorMarker(raw) {
  if (raw == null) return false;
  return ERROR_MARKERS.has(String(raw).trim());
}

// ---------------------------------------------------------------------------
// CSV reading
// ---------------------------------------------------------------------------

/**
 * Read and parse a CSV file using PapaParse.
 * @param {string} filePath - Absolute or relative path to CSV file
 * @returns {{ data: object[], meta: object, errors: object[] }}
 */
export function readCSV(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  if (content.trim() === '') {
    throw new ParseError('CSV file is empty', filePath);
  }
  return Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
  });
}

// ---------------------------------------------------------------------------
// Column validation
// ---------------------------------------------------------------------------

export class ParseError extends Error {
  constructor(message, filePath, details) {
    super(message);
    this.name = 'ParseError';
    this.filePath = filePath;
    this.details = details;
  }
}

/**
 * Validate that a CSV has the required columns.
 * Throws ParseError with expected vs actual columns on mismatch.
 */
export function validateColumns(actualColumns, requiredColumns, filePath) {
  const missing = requiredColumns.filter(col => !actualColumns.includes(col));
  if (missing.length > 0) {
    throw new ParseError(
      `CSV is missing required columns: ${missing.join(', ')}. ` +
      `Expected: [${requiredColumns.join(', ')}]. ` +
      `Actual: [${actualColumns.join(', ')}].`,
      filePath,
      { expected: requiredColumns, actual: actualColumns, missing }
    );
  }
}

// ---------------------------------------------------------------------------
// Tab parsers — each returns structured data matching Supabase schema
// ---------------------------------------------------------------------------

const DISTRIBUICAO_COLUMNS = ['Tipo de ativo', 'Porcentagem desejada', 'Valor atual'];

/**
 * Parse "Distribuição de aporte" tab → AssetType[]
 * @returns {{ records: Array<{name: string, target_pct: number|null}>, warnings: string[] }}
 */
export function parseDistribuicao(filePath) {
  const { data, meta } = readCSV(filePath);
  validateColumns(meta.fields, DISTRIBUICAO_COLUMNS, filePath);

  const warnings = [];
  const records = data.map((row, i) => {
    const name = String(row['Tipo de ativo'] ?? '').trim();
    if (!name) {
      warnings.push(`Row ${i + 2}: empty asset type name, skipping`);
      return null;
    }

    const valorAtual = row['Valor atual'];
    if (isErrorMarker(valorAtual)) {
      warnings.push(`Row ${i + 2}: "${name}" has error marker "${valorAtual}" in Valor atual → null`);
    }

    return {
      name,
      target_pct: parsePercentage(row['Porcentagem desejada']),
      current_value: parseBRNumber(valorAtual),
    };
  }).filter(Boolean);

  return { records, warnings };
}

const ACOES_COLUMNS = ['Ação', 'Quantidade', 'Cotação', 'Saldo', 'Grupo'];

/**
 * Parse "Ações" tab → Asset-like objects
 * @returns {{ records: Array, warnings: string[] }}
 */
export function parseAcoes(filePath) {
  const { data, meta } = readCSV(filePath);
  validateColumns(meta.fields, ACOES_COLUMNS, filePath);

  const warnings = [];
  const records = data.map((row, i) => {
    const rawTicker = row['Ação'];
    const ticker = normalizeTicker(rawTicker);
    if (!ticker) {
      warnings.push(`Row ${i + 2}: empty ticker, skipping`);
      return null;
    }

    const quantity = parseBRNumber(row['Quantidade']);

    return {
      ticker,
      quantity: quantity ?? 0,
      price: parseBRNumber(row['Cotação']),
      balance: parseBRNumber(row['Saldo']),
      group: String(row['Grupo'] ?? '').trim() || null,
    };
  }).filter(Boolean);

  return { records, warnings };
}

const FII_COLUMNS = ['Fundos', 'Setor', 'Quantidade', 'Cotação', 'Saldo'];

/**
 * Parse "FII" tab → Asset-like objects for real estate funds
 * @returns {{ records: Array, warnings: string[] }}
 */
export function parseFII(filePath) {
  const { data, meta } = readCSV(filePath);
  validateColumns(meta.fields, FII_COLUMNS, filePath);

  const warnings = [];
  const records = data.map((row, i) => {
    const ticker = normalizeTicker(row['Fundos']);
    if (!ticker) {
      warnings.push(`Row ${i + 2}: empty fund ticker, skipping`);
      return null;
    }

    const quantity = parseBRNumber(row['Quantidade']);

    return {
      ticker,
      sector: String(row['Setor'] ?? '').trim() || null,
      quantity: quantity ?? 0,
      price: parseBRNumber(row['Cotação']),
      balance: parseBRNumber(row['Saldo']),
    };
  }).filter(Boolean);

  return { records, warnings };
}

const RIRV_COLUMNS = ['Ativo', 'Setor', 'Quantidade', 'Cotação', 'Saldo', 'Grupo'];

/**
 * Parse "RI, RV e RF" tab → Fixed income asset records
 * @returns {{ records: Array, warnings: string[] }}
 */
export function parseRIRVRF(filePath) {
  const { data, meta } = readCSV(filePath);
  validateColumns(meta.fields, RIRV_COLUMNS, filePath);

  const warnings = [];
  const records = data.map((row, i) => {
    const name = String(row['Ativo'] ?? '').trim();
    if (!name) {
      warnings.push(`Row ${i + 2}: empty asset name, skipping`);
      return null;
    }

    const quantity = parseBRNumber(row['Quantidade']);

    return {
      ticker: name,
      sector: String(row['Setor'] ?? '').trim() || null,
      quantity: quantity ?? 0,
      price: parseBRNumber(row['Cotação']),
      balance: parseBRNumber(row['Saldo']),
      group: String(row['Grupo'] ?? '').trim() || null,
    };
  }).filter(Boolean);

  return { records, warnings };
}

const EXTERIOR_COLUMNS = ['Ativo', 'Quantidade', 'Cotação', 'Saldo', 'Grupo'];

/**
 * Parse "Exterior" tab → Foreign asset records
 * @returns {{ records: Array, warnings: string[] }}
 */
export function parseExterior(filePath) {
  const { data, meta } = readCSV(filePath);
  validateColumns(meta.fields, EXTERIOR_COLUMNS, filePath);

  const warnings = [];
  const records = data.map((row, i) => {
    const ticker = normalizeTicker(row['Ativo']);
    if (!ticker) {
      warnings.push(`Row ${i + 2}: empty asset name, skipping`);
      return null;
    }

    const quantity = parseBRNumber(row['Quantidade']);

    return {
      ticker,
      quantity: quantity ?? 0,
      price: parseBRNumber(row['Cotação']),
      balance: parseBRNumber(row['Saldo']),
      group: String(row['Grupo'] ?? '').trim() || null,
    };
  }).filter(Boolean);

  return { records, warnings };
}

/**
 * Parse "Balanceamentos" tab → Questionnaire structure + per-asset scores
 *
 * The last row contains "Score" in column A with numeric values per asset.
 * All other rows are questions with SIM/NÃO answers.
 *
 * @returns {{ questions: Array<{text: string, weight: number}>, scores: Record<string, {answers: boolean[], total_score: number}>, warnings: string[] }}
 */
export function parseBalanceamentos(filePath) {
  const { data, meta } = readCSV(filePath);

  if (!meta.fields || meta.fields.length < 2) {
    throw new ParseError(
      'Balanceamentos CSV must have at least 2 columns (Pergunta + 1 ticker)',
      filePath
    );
  }

  const questionCol = meta.fields[0]; // "Pergunta"
  const tickerCols = meta.fields.slice(1);
  const warnings = [];

  // Separate question rows from score row
  const scoreRowIndex = data.findIndex(row =>
    String(row[questionCol] ?? '').trim().toLowerCase() === 'score'
  );

  const questionRows = scoreRowIndex >= 0 ? data.slice(0, scoreRowIndex) : data;
  const scoreRow = scoreRowIndex >= 0 ? data[scoreRowIndex] : null;

  // Build questions (each question has equal weight = 1)
  const questions = questionRows.map((row, i) => {
    const text = String(row[questionCol] ?? '').trim();
    if (!text) {
      warnings.push(`Row ${i + 2}: empty question text, skipping`);
      return null;
    }
    return { text, weight: 1 };
  }).filter(Boolean);

  // Build per-ticker scores
  const scores = {};
  for (const ticker of tickerCols) {
    const normalizedTicker = normalizeTicker(ticker);
    if (!normalizedTicker) continue;

    const answers = questionRows.map(row => {
      const val = String(row[ticker] ?? '').trim().toUpperCase();
      if (val === 'SIM') return true;
      if (val === 'NÃO' || val === 'NAO') return false;
      return null; // unanswered
    });

    const totalScore = scoreRow ? parseBRNumber(scoreRow[ticker]) : null;

    scores[normalizedTicker] = {
      answers,
      total_score: totalScore ?? 0,
    };
  }

  return { questions, scores, warnings };
}

// ---------------------------------------------------------------------------
// Unified parser — parse all 6 tabs at once
// ---------------------------------------------------------------------------

/**
 * Parse all 6 CSV files from a directory.
 *
 * @param {string} dir - Directory containing the CSV files
 * @param {object} [fileMap] - Override default filenames
 * @returns {{ distribuicao, acoes, fiis, riRvRf, exterior, balanceamentos, warnings: string[] }}
 */
export function parseAllSheets(dir, fileMap = {}) {
  const files = {
    distribuicao: fileMap.distribuicao ?? 'distribuicao.csv',
    acoes: fileMap.acoes ?? 'acoes.csv',
    fiis: fileMap.fiis ?? 'fiis.csv',
    riRvRf: fileMap.riRvRf ?? 'ri-rv-rf.csv',
    exterior: fileMap.exterior ?? 'exterior.csv',
    balanceamentos: fileMap.balanceamentos ?? 'balanceamentos.csv',
  };

  const resolve = (name) => `${dir}/${name}`;
  const allWarnings = [];

  const distribuicao = parseDistribuicao(resolve(files.distribuicao));
  allWarnings.push(...distribuicao.warnings.map(w => `[distribuicao] ${w}`));

  const acoes = parseAcoes(resolve(files.acoes));
  allWarnings.push(...acoes.warnings.map(w => `[acoes] ${w}`));

  const fiis = parseFII(resolve(files.fiis));
  allWarnings.push(...fiis.warnings.map(w => `[fiis] ${w}`));

  const riRvRf = parseRIRVRF(resolve(files.riRvRf));
  allWarnings.push(...riRvRf.warnings.map(w => `[ri-rv-rf] ${w}`));

  const exterior = parseExterior(resolve(files.exterior));
  allWarnings.push(...exterior.warnings.map(w => `[exterior] ${w}`));

  const balanceamentos = parseBalanceamentos(resolve(files.balanceamentos));
  allWarnings.push(...balanceamentos.warnings.map(w => `[balanceamentos] ${w}`));

  return {
    distribuicao: distribuicao.records,
    acoes: acoes.records,
    fiis: fiis.records,
    riRvRf: riRvRf.records,
    exterior: exterior.records,
    balanceamentos: {
      questions: balanceamentos.questions,
      scores: balanceamentos.scores,
    },
    warnings: allWarnings,
  };
}
