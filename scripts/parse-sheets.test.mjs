import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import {
  parseBRNumber,
  parsePercentage,
  normalizeTicker,
  isErrorMarker,
  readCSV,
  validateColumns,
  ParseError,
  parseDistribuicao,
  parseAcoes,
  parseFII,
  parseRIRVRF,
  parseExterior,
  parseBalanceamentos,
  parseAllSheets,
} from './parse-sheets.mjs';

const FIXTURES = join(import.meta.dirname, '..', 'data', 'fixtures');

// ---------------------------------------------------------------------------
// T2.1.1 — Brazilian number format
// ---------------------------------------------------------------------------

describe('parseBRNumber', () => {
  it('parses "R$ 1.234,56" → 1234.56', () => {
    const result = parseBRNumber('R$ 1.234,56');
    expect(typeof result).toBe('number');
    expect(result).toBe(1234.56);
  });

  it('parses "R$ 0,01" → 0.01', () => {
    expect(parseBRNumber('R$ 0,01')).toBe(0.01);
  });

  it('parses "R$ 159.262,78" → 159262.78', () => {
    expect(parseBRNumber('R$ 159.262,78')).toBe(159262.78);
  });

  it('parses "US$ 608,38" → 608.38', () => {
    expect(parseBRNumber('US$ 608,38')).toBe(608.38);
  });

  it('parses plain integer "54" → 54', () => {
    expect(parseBRNumber('54')).toBe(54);
  });

  it('parses already-numeric input', () => {
    expect(parseBRNumber(77.13)).toBe(77.13);
  });

  it('returns null for empty string', () => {
    expect(parseBRNumber('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseBRNumber(null)).toBeNull();
    expect(parseBRNumber(undefined)).toBeNull();
  });

  it('returns null for "#N/A"', () => {
    expect(parseBRNumber('#N/A')).toBeNull();
  });

  it('returns null for "#REF!"', () => {
    expect(parseBRNumber('#REF!')).toBeNull();
  });

  it('returns null for non-numeric garbage', () => {
    expect(parseBRNumber('abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T2.1.2 — Ticker normalization
// ---------------------------------------------------------------------------

describe('normalizeTicker', () => {
  it('strips .SA suffix: "VALE3.SA" → "VALE3"', () => {
    expect(normalizeTicker('VALE3.SA')).toBe('VALE3');
  });

  it('handles trailing space: "VALE3.SA " → "VALE3"', () => {
    expect(normalizeTicker('VALE3.SA ')).toBe('VALE3');
  });

  it('handles leading space: " bbas3.sa" → "BBAS3"', () => {
    expect(normalizeTicker(' bbas3.sa')).toBe('BBAS3');
  });

  it('uppercases: "petr4" → "PETR4"', () => {
    expect(normalizeTicker('petr4')).toBe('PETR4');
  });

  it('keeps tickers without .SA unchanged: "BTLG11" → "BTLG11"', () => {
    expect(normalizeTicker('BTLG11')).toBe('BTLG11');
  });

  it('returns null for empty string', () => {
    expect(normalizeTicker('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(normalizeTicker(null)).toBeNull();
  });

  it('returns null for error marker', () => {
    expect(normalizeTicker('#N/A')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T2.1.3 — Error markers → null
// ---------------------------------------------------------------------------

describe('isErrorMarker', () => {
  it('detects #N/A', () => expect(isErrorMarker('#N/A')).toBe(true));
  it('detects #REF!', () => expect(isErrorMarker('#REF!')).toBe(true));
  it('detects #VALUE!', () => expect(isErrorMarker('#VALUE!')).toBe(true));
  it('detects #DIV/0!', () => expect(isErrorMarker('#DIV/0!')).toBe(true));
  it('rejects normal values', () => expect(isErrorMarker('VALE3')).toBe(false));
  it('rejects null', () => expect(isErrorMarker(null)).toBe(false));
});

// ---------------------------------------------------------------------------
// parsePercentage
// ---------------------------------------------------------------------------

describe('parsePercentage', () => {
  it('parses "5%" → 0.05', () => {
    expect(parsePercentage('5%')).toBe(0.05);
  });

  it('parses "35%" → 0.35', () => {
    expect(parsePercentage('35%')).toBe(0.35);
  });

  it('parses "0.05" as-is', () => {
    expect(parsePercentage('0.05')).toBe(0.05);
  });

  it('returns null for #N/A', () => {
    expect(parsePercentage('#N/A')).toBeNull();
  });

  it('parses "6.06%" → ~0.0606', () => {
    expect(parsePercentage('6.06%')).toBeCloseTo(0.0606, 4);
  });
});

// ---------------------------------------------------------------------------
// Column validation
// ---------------------------------------------------------------------------

describe('validateColumns', () => {
  it('passes when all required columns are present', () => {
    expect(() =>
      validateColumns(['A', 'B', 'C'], ['A', 'B'], 'test.csv')
    ).not.toThrow();
  });

  it('throws ParseError with expected vs actual when columns are missing', () => {
    expect(() =>
      validateColumns(['Ticker', 'Price'], ['Ação', 'Quantidade', 'Cotação'], 'test.csv')
    ).toThrow(ParseError);

    try {
      validateColumns(['Ticker', 'Price'], ['Ação', 'Quantidade', 'Cotação'], 'test.csv');
    } catch (e) {
      expect(e.message).toContain('Ação');
      expect(e.message).toContain('Quantidade');
      expect(e.message).toContain('Expected:');
      expect(e.message).toContain('Actual:');
      expect(e.details.expected).toEqual(['Ação', 'Quantidade', 'Cotação']);
      expect(e.details.actual).toEqual(['Ticker', 'Price']);
      expect(e.details.missing).toEqual(['Ação', 'Quantidade', 'Cotação']);
    }
  });
});

// ---------------------------------------------------------------------------
// T2.1.4 — Distribuição tab → 10 asset_type objects
// ---------------------------------------------------------------------------

describe('parseDistribuicao', () => {
  it('parses valid CSV with all 10 asset types', () => {
    const { records, warnings } = parseDistribuicao(join(FIXTURES, 'distribuicao.csv'));

    expect(records).toHaveLength(10);
    expect(records.every(r => r.name && r.name.length > 0)).toBe(true);
    expect(records.every(r => r.target_pct !== undefined)).toBe(true);
  });

  it('each record has name and target_pct', () => {
    const { records } = parseDistribuicao(join(FIXTURES, 'distribuicao.csv'));

    const first = records[0];
    expect(first.name).toBe('Reserva de investimento');
    expect(first.target_pct).toBe(0.05);
    expect(first.current_value).toBe(0.01);
  });

  it('handles #N/A in Valor atual → null with warning', () => {
    const { records, warnings } = parseDistribuicao(join(FIXTURES, 'distribuicao.csv'));

    const europa = records.find(r => r.name === 'Ações Europa');
    expect(europa.current_value).toBeNull();
    expect(warnings.some(w => w.includes('#N/A'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseAcoes — stocks tab
// ---------------------------------------------------------------------------

describe('parseAcoes', () => {
  it('parses stock CSV with normalized tickers', () => {
    const { records } = parseAcoes(join(FIXTURES, 'acoes.csv'));

    expect(records.length).toBeGreaterThanOrEqual(5);
    expect(records[0].ticker).toBe('VALE3'); // .SA stripped
    expect(records[1].ticker).toBe('BBAS3'); // trailing space + .SA stripped
    expect(records[0].quantity).toBe(54);
    expect(records[0].price).toBe(77.13);
    expect(records[0].balance).toBe(4165.02);
  });

  it('defaults quantity to 0 for empty cells', () => {
    const tmpDir = join(FIXTURES, '__tmp_acoes');
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, 'acoes-empty-qty.csv');
    writeFileSync(tmpFile, 'Ação,Quantidade,Cotação,Saldo,Grupo\nVALE3,,10,10,Grupo 1\n');

    try {
      const { records } = parseAcoes(tmpFile);
      expect(records[0].quantity).toBe(0);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// parseFII — real estate funds
// ---------------------------------------------------------------------------

describe('parseFII', () => {
  it('parses FII CSV with correct values', () => {
    const { records } = parseFII(join(FIXTURES, 'fiis.csv'));

    expect(records.length).toBe(5);
    expect(records[0].ticker).toBe('BTLG11');
    expect(records[0].sector).toBe('Logistica');
    expect(records[0].quantity).toBe(93);
    expect(records[0].price).toBe(103.80);
    expect(records[0].balance).toBe(9653.40);
  });
});

// ---------------------------------------------------------------------------
// parseRIRVRF — fixed income
// ---------------------------------------------------------------------------

describe('parseRIRVRF', () => {
  it('parses fixed income CSV with all fields', () => {
    const { records } = parseRIRVRF(join(FIXTURES, 'ri-rv-rf.csv'));

    expect(records.length).toBe(3);
    expect(records[0].ticker).toBe('ROMP');
    expect(records[0].balance).toBe(0.01);
    expect(records[0].quantity).toBe(0);
    expect(records[0].group).toBe('Grupo 1');
  });

  it('parses sector and group fields', () => {
    const { records } = parseRIRVRF(join(FIXTURES, 'ri-rv-rf.csv'));

    const tesouroIpca = records.find(r => r.ticker === 'Tesouro IPCA');
    expect(tesouroIpca).toBeDefined();
    expect(tesouroIpca.balance).toBe(3102.81);
    expect(tesouroIpca.group).toBe('Grupo 3');
  });

  it('throws ParseError when required columns are missing', () => {
    const tmpDir = join(FIXTURES, '__tmp_rirv');
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, 'bad-rirv.csv');
    writeFileSync(tmpFile, 'Ativo,Quantidade,Saldo\nROM,,0.01\n');

    try {
      expect(() => parseRIRVRF(tmpFile)).toThrow(ParseError);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// parseExterior — foreign assets
// ---------------------------------------------------------------------------

describe('parseExterior', () => {
  it('parses foreign assets with US$ format', () => {
    const { records } = parseExterior(join(FIXTURES, 'exterior.csv'));

    expect(records.length).toBe(5);
    expect(records[0].ticker).toBe('VOO');
    expect(records[0].quantity).toBe(0.953);
    expect(records[0].price).toBe(608.38);
    expect(records[0].balance).toBe(3051.94);
  });

  it('parses group field for each asset', () => {
    const { records } = parseExterior(join(FIXTURES, 'exterior.csv'));

    expect(records[0].group).toBe('Grupo 1');
    expect(records[3].group).toBe('Grupo 3');
  });

  it('throws ParseError when Grupo column is missing', () => {
    const tmpDir = join(FIXTURES, '__tmp_exterior');
    mkdirSync(tmpDir, { recursive: true });
    const tmpFile = join(tmpDir, 'bad-exterior.csv');
    writeFileSync(tmpFile, 'Ativo,Quantidade,Cotação,Saldo\nVOO,1,500,500\n');

    try {
      expect(() => parseExterior(tmpFile)).toThrow(ParseError);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T2.1.5 — Balanceamentos → questionnaire + scores (including negatives)
// ---------------------------------------------------------------------------

describe('parseBalanceamentos', () => {
  it('extracts questions with correct text', () => {
    const { questions } = parseBalanceamentos(join(FIXTURES, 'balanceamentos.csv'));

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(questions[0].text).toBe('Nenhum ativo concentra a renda em mais que 20%?');
    expect(questions[0].weight).toBe(1);
  });

  it('extracts per-ticker scores including negatives', () => {
    const { scores } = parseBalanceamentos(join(FIXTURES, 'balanceamentos.csv'));

    expect(scores['BTLG11'].total_score).toBe(4);
    expect(scores['XPLG11'].total_score).toBe(0);
    expect(scores['PETR4'].total_score).toBe(-1);
    expect(scores['VALE3'].total_score).toBe(5);
  });

  it('extracts SIM/NÃO answers as boolean arrays', () => {
    const { scores } = parseBalanceamentos(join(FIXTURES, 'balanceamentos.csv'));

    // BTLG11 answers: SIM, SIM, SIM, SIM, NÃO, SIM, SIM, null, null, null
    const btlg = scores['BTLG11'].answers;
    expect(btlg[0]).toBe(true);   // SIM
    expect(btlg[1]).toBe(true);   // SIM
    expect(btlg[4]).toBe(false);  // NÃO (É monoativo?)
  });
});

// ---------------------------------------------------------------------------
// T2.1.6 — Error: unexpected column headers
// ---------------------------------------------------------------------------

describe('error handling — unexpected columns', () => {
  const tmpDir = join(FIXTURES, '__tmp_errors');

  const setup = (filename, content) => {
    mkdirSync(tmpDir, { recursive: true });
    const path = join(tmpDir, filename);
    writeFileSync(path, content);
    return path;
  };

  const cleanup = () => {
    try { rmSync(tmpDir, { recursive: true }); } catch {}
  };

  it('throws ParseError with expected vs actual for wrong headers', () => {
    const path = setup('bad-headers.csv', 'Ticker,Price,Balance\nVALE3,77.13,4165.02\n');

    try {
      parseAcoes(path);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.message).toContain('missing required columns');
      expect(e.message).toContain('Ação');
      expect(e.message).toContain('Expected:');
      expect(e.message).toContain('Actual:');
      expect(e.details.expected).toContain('Ação');
      expect(e.details.actual).toEqual(['Ticker', 'Price', 'Balance']);
    } finally {
      cleanup();
    }
  });

  it('throws ParseError for empty CSV file', () => {
    const path = setup('empty.csv', '');

    try {
      parseAcoes(path);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError);
      expect(e.message).toContain('empty');
    } finally {
      cleanup();
    }
  });

  it('throws for file not found', () => {
    expect(() => readCSV('/nonexistent/path.csv')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseAllSheets — full integration
// ---------------------------------------------------------------------------

describe('parseAllSheets', () => {
  it('parses all 6 tabs from fixture directory', () => {
    const result = parseAllSheets(FIXTURES);

    expect(result.distribuicao).toHaveLength(10);
    expect(result.acoes.length).toBeGreaterThanOrEqual(5);
    expect(result.fiis.length).toBe(5);
    expect(result.riRvRf.length).toBeGreaterThanOrEqual(2);
    expect(result.exterior.length).toBe(5);
    expect(result.balanceamentos.questions.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(result.balanceamentos.scores).length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});
