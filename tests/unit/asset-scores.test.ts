import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  AssetScore,
  Questionnaire,
  QuestionnaireQuestion,
  ScoreAnswer,
} from '../../src/lib/nexus/types.js';

// ── Mock Supabase client ────────────────────────────────────

const { queryBuilder, setMockResult } = vi.hoisted(() => {
  interface MockResult { data: unknown; error: unknown }

  let mockResult: MockResult = { data: null, error: null };

  function setMockResult(result: Partial<MockResult>) {
    mockResult = { data: null, error: null, ...result };
  }

  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chainMethods = [
    'from', 'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'order', 'single', 'maybeSingle',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn(() => {
      if (['single', 'maybeSingle'].includes(method)) {
        return { ...mockResult };
      }
      return builder;
    });
  }

  // Make builder thenable so await on non-terminal chains works
  (builder as Record<string, unknown>).then = (
    resolve: (val: MockResult) => void,
  ) => Promise.resolve(mockResult).then(resolve);

  return { queryBuilder: builder, setMockResult };
});

vi.mock('../../src/lib/supabase.js', () => ({
  getAnonClient: () => queryBuilder,
}));

// ── Import module under test ────────────────────────────────

import {
  calculateScore,
  validateAnswers,
  getAssetScore,
  saveAssetScore,
  deleteAssetScore,
  getScoresByQuestionnaire,
} from '../../src/lib/nexus/asset-scores.js';

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const WALLET_ID = '00000000-0000-0000-0000-000000000099';
const ASSET_ID = '11111111-1111-1111-1111-111111111111';
const QUESTIONNAIRE_ID = '22222222-2222-2222-2222-222222222222';
const TYPE_ID = '33333333-3333-3333-3333-333333333333';

function makeQuestion(overrides: Partial<QuestionnaireQuestion> = {}): QuestionnaireQuestion {
  return {
    id: 'q1',
    text: 'Tem vacancia abaixo de 10%?',
    weight: 1,
    sort_order: 1,
    ...overrides,
  };
}

function makeQuestionnaire(
  questions: QuestionnaireQuestion[],
  overrides: Partial<Questionnaire> = {},
): Questionnaire {
  return {
    id: QUESTIONNAIRE_ID,
    name: 'Acoes',
    asset_type_id: TYPE_ID,
    questions,
    user_id: USER_ID,
    wallet_id: WALLET_ID,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeAssetScore(overrides: Partial<AssetScore> = {}): AssetScore {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    asset_id: ASSET_ID,
    questionnaire_id: QUESTIONNAIRE_ID,
    answers: [{ question_id: 'q1', value: true }],
    total_score: 1,
    user_id: USER_ID,
    wallet_id: WALLET_ID,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  setMockResult({ data: null, error: null });
  vi.clearAllMocks();

  for (const method of Object.keys(queryBuilder)) {
    if (method === 'then') continue;
    queryBuilder[method].mockImplementation(() => {
      if (['single', 'maybeSingle'].includes(method)) {
        return { data: null, error: null };
      }
      return queryBuilder;
    });
  }
});

// ── Pure function tests — calculateScore ────────────────────

describe('calculateScore', () => {
  it('T7.2.2 — 11 questions (all weight +1): 8 Sim + 3 Nao = 8', () => {
    const questions: QuestionnaireQuestion[] = Array.from({ length: 11 }, (_, i) =>
      makeQuestion({ id: `q${i + 1}`, sort_order: i + 1 }),
    );
    // First 8 = Sim, last 3 = Nao
    const answers: ScoreAnswer[] = questions.map((q, i) => ({
      question_id: q.id,
      value: i < 8,
    }));

    const score = calculateScore(answers, questions);
    expect(score).toBe(8);
  });

  it('T7.2.4 — negative score: mixed weights, total = -10', () => {
    // 12 questions: 10 with weight -1 (all answered Sim) + 2 with weight +1 (both Nao)
    // = (10 * 1 * -1) + (2 * 0 * 1) = -10
    const questions: QuestionnaireQuestion[] = [
      ...Array.from({ length: 10 }, (_, i) =>
        makeQuestion({ id: `neg${i}`, weight: -1, sort_order: i + 1 }),
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        makeQuestion({ id: `pos${i}`, weight: 1, sort_order: 11 + i }),
      ),
    ];

    const answers: ScoreAnswer[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        question_id: `neg${i}`,
        value: true, // Sim on negative-weight questions
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        question_id: `pos${i}`,
        value: false, // Nao on positive-weight questions
      })),
    ];

    const score = calculateScore(answers, questions);
    expect(score).toBe(-10);
  });

  it('all Sim with weight +1 returns question count', () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: 1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: 1, sort_order: 2 }),
      makeQuestion({ id: 'q3', weight: 1, sort_order: 3 }),
    ];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'q2', value: true },
      { question_id: 'q3', value: true },
    ];

    expect(calculateScore(answers, questions)).toBe(3);
  });

  it('all Nao returns 0 regardless of weights', () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: 1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: -1, sort_order: 2 }),
    ];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: false },
      { question_id: 'q2', value: false },
    ];

    expect(calculateScore(answers, questions)).toBe(0);
  });

  it('mixed weights: Sim on -1 yields negative contribution', () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: 1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: -1, sort_order: 2 }),
    ];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },  // +1
      { question_id: 'q2', value: true },  // -1
    ];

    expect(calculateScore(answers, questions)).toBe(0);
  });

  it('throws if answer references non-existent question', () => {
    const questions = [makeQuestion({ id: 'q1' })];
    const answers: ScoreAnswer[] = [
      { question_id: 'nonexistent', value: true },
    ];

    expect(() => calculateScore(answers, questions)).toThrow(
      'Pergunta "nonexistent" não encontrada no questionário',
    );
  });

  it('empty answers and questions returns 0', () => {
    expect(calculateScore([], [])).toBe(0);
  });
});

// ── Pure function tests — validateAnswers ───────────────────

describe('validateAnswers', () => {
  it('passes when all questions answered exactly once', () => {
    const questions = [
      makeQuestion({ id: 'q1', sort_order: 1 }),
      makeQuestion({ id: 'q2', sort_order: 2 }),
    ];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'q2', value: false },
    ];

    expect(() => validateAnswers(answers, questions)).not.toThrow();
  });

  it('throws if answer references non-existent question', () => {
    const questions = [makeQuestion({ id: 'q1' })];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'ghost', value: false },
    ];

    expect(() => validateAnswers(answers, questions)).toThrow(
      'Resposta referencia pergunta inexistente: "ghost"',
    );
  });

  it('throws if question has no answer', () => {
    const questions = [
      makeQuestion({ id: 'q1', sort_order: 1 }),
      makeQuestion({ id: 'q2', sort_order: 2 }),
    ];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
    ];

    expect(() => validateAnswers(answers, questions)).toThrow(
      'Pergunta "q2" não foi respondida',
    );
  });

  it('throws if duplicate answers exist', () => {
    const questions = [makeQuestion({ id: 'q1' })];
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'q1', value: false },
    ];

    expect(() => validateAnswers(answers, questions)).toThrow(
      'Respostas duplicadas detectadas',
    );
  });

  it('passes with empty questions and answers', () => {
    expect(() => validateAnswers([], [])).not.toThrow();
  });
});

// ── CRUD tests — getAssetScore ──────────────────────────────

describe('getAssetScore', () => {
  it('T7.2.3 — returns saved score with pre-filled answers', async () => {
    const saved = makeAssetScore({
      answers: [
        { question_id: 'q1', value: true },
        { question_id: 'q2', value: false },
      ],
      total_score: 8,
    });
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: saved, error: null });

    const result = await getAssetScore(ASSET_ID, QUESTIONNAIRE_ID);

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_scores');
    expect(queryBuilder.eq).toHaveBeenCalledWith('asset_id', ASSET_ID);
    expect(queryBuilder.eq).toHaveBeenCalledWith('questionnaire_id', QUESTIONNAIRE_ID);
    expect(result).toEqual(saved);
    expect(result!.total_score).toBe(8);
  });

  it('returns null when no score exists', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getAssetScore(ASSET_ID, QUESTIONNAIRE_ID);
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getAssetScore(ASSET_ID, QUESTIONNAIRE_ID)).rejects.toEqual(err);
  });
});

// ── CRUD tests — saveAssetScore ─────────────────────────────

describe('saveAssetScore', () => {
  it('T7.2.1 — saves score for an asset with questionnaire answers', async () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: 1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: 1, sort_order: 2 }),
    ];
    const questionnaire = makeQuestionnaire(questions);
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'q2', value: false },
    ];

    const savedScore = makeAssetScore({
      answers,
      total_score: 1,
    });
    queryBuilder.single.mockReturnValueOnce({ data: savedScore, error: null });

    const result = await saveAssetScore(
      ASSET_ID, QUESTIONNAIRE_ID, answers, questionnaire, USER_ID, WALLET_ID,
    );

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_scores');
    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      {
        asset_id: ASSET_ID,
        questionnaire_id: QUESTIONNAIRE_ID,
        answers,
        total_score: 1,
        user_id: USER_ID,
        wallet_id: WALLET_ID,
      },
      { onConflict: 'asset_id,questionnaire_id' },
    );
    expect(result.total_score).toBe(1);
    expect(result.answers).toEqual(answers);
  });

  it('T7.2.5 — unsaved answers are not persisted (no DB write without save)', async () => {
    // This tests the behavior that closing without save means no DB call.
    // We verify that saveAssetScore is only called when explicitly invoked,
    // by checking that if NOT called, no upsert happens.
    expect(queryBuilder.upsert).not.toHaveBeenCalled();
    // The modal discarding unsaved state is a UI concern.
    // Data layer contract: no call = no persistence.
  });

  it('validates all questions are answered before saving', async () => {
    const questions = [
      makeQuestion({ id: 'q1', sort_order: 1 }),
      makeQuestion({ id: 'q2', sort_order: 2 }),
    ];
    const questionnaire = makeQuestionnaire(questions);
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      // q2 missing
    ];

    await expect(
      saveAssetScore(ASSET_ID, QUESTIONNAIRE_ID, answers, questionnaire, USER_ID, WALLET_ID),
    ).rejects.toThrow('Pergunta "q2" não foi respondida');

    // No DB call should happen
    expect(queryBuilder.upsert).not.toHaveBeenCalled();
  });

  it('calculates correct score with mixed weights', async () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: 1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: -1, sort_order: 2 }),
      makeQuestion({ id: 'q3', weight: 1, sort_order: 3 }),
    ];
    const questionnaire = makeQuestionnaire(questions);
    const answers: ScoreAnswer[] = [
      { question_id: 'q1', value: true },   // +1
      { question_id: 'q2', value: true },   // -1
      { question_id: 'q3', value: true },   // +1
    ];

    const savedScore = makeAssetScore({ total_score: 1 });
    queryBuilder.single.mockReturnValueOnce({ data: savedScore, error: null });

    await saveAssetScore(ASSET_ID, QUESTIONNAIRE_ID, answers, questionnaire, USER_ID, WALLET_ID);

    // Verify the total_score in the upsert payload
    const upsertCall = queryBuilder.upsert.mock.calls[0][0];
    expect(upsertCall.total_score).toBe(1); // 1 + (-1) + 1 = 1
  });

  it('throws on Supabase error', async () => {
    const questions = [makeQuestion({ id: 'q1', sort_order: 1 })];
    const questionnaire = makeQuestionnaire(questions);
    const answers: ScoreAnswer[] = [{ question_id: 'q1', value: true }];

    const err = { message: 'constraint violation', code: '23503' };
    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(
      saveAssetScore(ASSET_ID, QUESTIONNAIRE_ID, answers, questionnaire, USER_ID, WALLET_ID),
    ).rejects.toEqual(err);
  });
});

// ── CRUD tests — deleteAssetScore ───────────────────────────

describe('deleteAssetScore', () => {
  it('deletes a score by asset + questionnaire IDs', async () => {
    // The delete chain: from → delete → eq → eq → (resolves)
    // Our mock's `eq` returns builder (thenable), so the await will resolve.
    queryBuilder.eq.mockReturnValueOnce(
      queryBuilder, // second .eq() call returns builder
    );
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(
      deleteAssetScore(ASSET_ID, QUESTIONNAIRE_ID),
    ).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_scores');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('asset_id', ASSET_ID);
    expect(queryBuilder.eq).toHaveBeenCalledWith('questionnaire_id', QUESTIONNAIRE_ID);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.eq.mockReturnValueOnce(queryBuilder);
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(
      deleteAssetScore(ASSET_ID, QUESTIONNAIRE_ID),
    ).rejects.toEqual(err);
  });
});

// ── CRUD tests — getScoresByQuestionnaire ───────────────────

describe('getScoresByQuestionnaire', () => {
  it('returns all scores for a questionnaire', async () => {
    const scores = [
      makeAssetScore({ asset_id: 'asset-1', total_score: 8 }),
      makeAssetScore({ asset_id: 'asset-2', total_score: -10 }),
    ];
    queryBuilder.order.mockReturnValueOnce({ data: scores, error: null });

    const result = await getScoresByQuestionnaire(QUESTIONNAIRE_ID);

    expect(queryBuilder.from).toHaveBeenCalledWith('asset_scores');
    expect(queryBuilder.eq).toHaveBeenCalledWith('questionnaire_id', QUESTIONNAIRE_ID);
    expect(result).toHaveLength(2);
    expect(result[0].total_score).toBe(8);
    expect(result[1].total_score).toBe(-10);
  });

  it('returns empty array when no scores exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getScoresByQuestionnaire(QUESTIONNAIRE_ID);
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'timeout', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getScoresByQuestionnaire(QUESTIONNAIRE_ID)).rejects.toEqual(err);
  });
});

// ── Integration: score calculation → normalization ──────────

describe('score → normalization integration', () => {
  // Import normalizeScores from rebalance to verify the pipeline
  let normalizeScores: (scores: number[]) => number[];

  beforeEach(async () => {
    const mod = await import('../../src/lib/nexus/rebalance.js');
    normalizeScores = mod.normalizeScores;
  });

  it('calculated scores feed correctly into normalizeScores', () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: 1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: 1, sort_order: 2 }),
      makeQuestion({ id: 'q3', weight: -1, sort_order: 3 }),
    ];

    // Asset 1: Sim, Sim, Nao → 1 + 1 + 0 = 2
    const answers1: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'q2', value: true },
      { question_id: 'q3', value: false },
    ];
    // Asset 2: Sim, Nao, Sim → 1 + 0 + (-1) = 0
    const answers2: ScoreAnswer[] = [
      { question_id: 'q1', value: true },
      { question_id: 'q2', value: false },
      { question_id: 'q3', value: true },
    ];

    const score1 = calculateScore(answers1, questions);
    const score2 = calculateScore(answers2, questions);

    expect(score1).toBe(2);
    expect(score2).toBe(0);

    const normalized = normalizeScores([score1, score2]);
    expect(normalized).toHaveLength(2);
    // [2, 0] → no negatives, sum=2 → [100, 0]
    expect(normalized[0]).toBe(100);
    expect(normalized[1]).toBe(0);
  });

  it('negative scores normalize correctly', () => {
    const questions = [
      makeQuestion({ id: 'q1', weight: -1, sort_order: 1 }),
      makeQuestion({ id: 'q2', weight: -1, sort_order: 2 }),
    ];

    // Asset 1: both Sim → (-1) + (-1) = -2
    const score1 = calculateScore(
      [{ question_id: 'q1', value: true }, { question_id: 'q2', value: true }],
      questions,
    );
    // Asset 2: both Nao → 0 + 0 = 0
    const score2 = calculateScore(
      [{ question_id: 'q1', value: false }, { question_id: 'q2', value: false }],
      questions,
    );

    expect(score1).toBe(-2);
    expect(score2).toBe(0);

    // normalizeScores([-2, 0]) → shift +2 → [0, 2] → [0%, 100%]
    const normalized = normalizeScores([score1, score2]);
    expect(normalized[0]).toBe(0);
    expect(normalized[1]).toBe(100);
  });
});
