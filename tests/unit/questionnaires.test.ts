import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Questionnaire,
  QuestionnaireInsert,
  QuestionnaireQuestion,
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
    'from', 'select', 'insert', 'update', 'delete',
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
  getQuestionnaires,
  getQuestionnaire,
  createQuestionnaire,
  updateQuestionnaire,
  deleteQuestionnaire,
  reorderQuestions,
} from '../../src/lib/nexus/questionnaires.js';

// ── Fixtures ────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const Q_ID = '22222222-2222-2222-2222-222222222222';
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

function makeQuestionnaire(overrides: Partial<Questionnaire> = {}): Questionnaire {
  return {
    id: Q_ID,
    name: 'FIIs',
    asset_type_id: TYPE_ID,
    questions: [
      makeQuestion({ id: 'q1', sort_order: 1 }),
      makeQuestion({ id: 'q2', text: 'DY acima de 0.7% ao mês?', sort_order: 2 }),
    ],
    user_id: USER_ID,
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

// ── Tests ───────────────────────────────────────────────────

// ---------- getQuestionnaires (list all) ----------

describe('getQuestionnaires', () => {
  it('T7.1.1 — returns all questionnaires', async () => {
    const questionnaires = [
      makeQuestionnaire({ name: 'FIIs' }),
      makeQuestionnaire({ id: 'other-id', name: 'Acoes' }),
      makeQuestionnaire({ id: 'third-id', name: 'ETFs' }),
    ];

    queryBuilder.order.mockReturnValueOnce({ data: questionnaires, error: null });

    const result = await getQuestionnaires();

    expect(queryBuilder.from).toHaveBeenCalledWith('questionnaires');
    expect(queryBuilder.select).toHaveBeenCalledWith('*');
    expect(result).toHaveLength(3);
    expect(result.map((q: Questionnaire) => q.name)).toEqual(['FIIs', 'Acoes', 'ETFs']);
  });

  it('returns empty array when no questionnaires exist', async () => {
    queryBuilder.order.mockReturnValueOnce({ data: [], error: null });

    const result = await getQuestionnaires();
    expect(result).toEqual([]);
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'connection error', code: '500' };
    queryBuilder.order.mockReturnValueOnce({ data: null, error: err });

    await expect(getQuestionnaires()).rejects.toEqual(err);
  });
});

// ---------- getQuestionnaire (single by ID) ----------

describe('getQuestionnaire', () => {
  it('returns a single questionnaire by ID', async () => {
    const q = makeQuestionnaire();
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: q, error: null });

    const result = await getQuestionnaire(Q_ID);

    expect(queryBuilder.from).toHaveBeenCalledWith('questionnaires');
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', Q_ID);
    expect(result).toEqual(q);
  });

  it('returns null when not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    const result = await getQuestionnaire('nonexistent');
    expect(result).toBeNull();
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'server error', code: '500' };
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: err });

    await expect(getQuestionnaire('any-id')).rejects.toEqual(err);
  });
});

// ---------- createQuestionnaire ----------

describe('createQuestionnaire', () => {
  it('T7.1.2 — creates a questionnaire with questions', async () => {
    const questions: QuestionnaireQuestion[] = [
      makeQuestion({ id: 'q1', text: 'Tem vacancia abaixo de 10%?', weight: 1, sort_order: 1 }),
    ];
    const input: QuestionnaireInsert = {
      name: 'FIIs',
      asset_type_id: TYPE_ID,
      questions,
      user_id: USER_ID,
    };
    const created = makeQuestionnaire({ questions });

    queryBuilder.single.mockReturnValueOnce({ data: created, error: null });

    const result = await createQuestionnaire(input);

    expect(queryBuilder.from).toHaveBeenCalledWith('questionnaires');
    expect(queryBuilder.insert).toHaveBeenCalledWith(input);
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].text).toBe('Tem vacancia abaixo de 10%?');
    expect(result.questions[0].weight).toBe(1);
  });

  it('validation: rejects empty name', async () => {
    const input: QuestionnaireInsert = {
      name: '',
      asset_type_id: TYPE_ID,
      questions: [makeQuestion()],
      user_id: USER_ID,
    };

    await expect(createQuestionnaire(input)).rejects.toThrow(
      'Nome do questionário é obrigatório',
    );
  });

  it('T7.1.4 — validation: rejects questionnaire with 0 questions', async () => {
    const input: QuestionnaireInsert = {
      name: 'Empty',
      asset_type_id: TYPE_ID,
      questions: [],
      user_id: USER_ID,
    };

    await expect(createQuestionnaire(input)).rejects.toThrow(
      'Questionario deve ter pelo menos 1 pergunta',
    );
  });

  it('T7.1.5 — validation: rejects question with empty text', async () => {
    const input: QuestionnaireInsert = {
      name: 'FIIs',
      asset_type_id: TYPE_ID,
      questions: [makeQuestion({ text: '' })],
      user_id: USER_ID,
    };

    await expect(createQuestionnaire(input)).rejects.toThrow(
      'Pergunta 1: texto é obrigatório',
    );
  });

  it('validation: rejects question with invalid weight', async () => {
    const input: QuestionnaireInsert = {
      name: 'FIIs',
      asset_type_id: TYPE_ID,
      questions: [makeQuestion({ weight: 5 as never })],
      user_id: USER_ID,
    };

    await expect(createQuestionnaire(input)).rejects.toThrow(
      'Pergunta 1: peso deve ser +1 ou -1',
    );
  });

  it('validation: rejects question with non-integer sort_order', async () => {
    const input: QuestionnaireInsert = {
      name: 'FIIs',
      asset_type_id: TYPE_ID,
      questions: [makeQuestion({ sort_order: 1.5 })],
      user_id: USER_ID,
    };

    await expect(createQuestionnaire(input)).rejects.toThrow(
      'Pergunta 1: sort_order deve ser inteiro',
    );
  });

  it('throws on Supabase error', async () => {
    const input: QuestionnaireInsert = {
      name: 'FIIs',
      asset_type_id: TYPE_ID,
      questions: [makeQuestion()],
      user_id: USER_ID,
    };
    const err = { message: 'duplicate key', code: '23505' };

    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(createQuestionnaire(input)).rejects.toEqual(err);
  });
});

// ---------- updateQuestionnaire ----------

describe('updateQuestionnaire', () => {
  it('updates questionnaire name', async () => {
    const updated = makeQuestionnaire({ name: 'FIIs v2' });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateQuestionnaire(Q_ID, { name: 'FIIs v2' });

    expect(queryBuilder.from).toHaveBeenCalledWith('questionnaires');
    expect(queryBuilder.update).toHaveBeenCalledWith({ name: 'FIIs v2' });
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', Q_ID);
    expect(result.name).toBe('FIIs v2');
  });

  it('updates questions with validation', async () => {
    const newQuestions = [
      makeQuestion({ id: 'q1', text: 'Nova pergunta?', weight: -1, sort_order: 1 }),
    ];
    const updated = makeQuestionnaire({ questions: newQuestions });

    queryBuilder.single.mockReturnValueOnce({ data: updated, error: null });

    const result = await updateQuestionnaire(Q_ID, { questions: newQuestions });
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].weight).toBe(-1);
  });

  it('validation: rejects empty update object', async () => {
    await expect(updateQuestionnaire(Q_ID, {})).rejects.toThrow(
      'At least one field must be provided for update',
    );
  });

  it('validation: rejects empty name in update', async () => {
    await expect(updateQuestionnaire(Q_ID, { name: '' })).rejects.toThrow(
      'Nome do questionário não pode ser vazio',
    );
  });

  it('validation: rejects invalid questions in update', async () => {
    await expect(
      updateQuestionnaire(Q_ID, { questions: [] }),
    ).rejects.toThrow('Questionario deve ter pelo menos 1 pergunta');
  });

  it('throws on Supabase error', async () => {
    const err = { message: 'not found', code: 'PGRST116' };
    queryBuilder.single.mockReturnValueOnce({ data: null, error: err });

    await expect(
      updateQuestionnaire('bad-id', { name: 'Test' }),
    ).rejects.toEqual(err);
  });
});

// ---------- deleteQuestionnaire ----------

describe('deleteQuestionnaire', () => {
  it('deletes a questionnaire by ID', async () => {
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: null });

    await expect(deleteQuestionnaire(Q_ID)).resolves.toBeUndefined();

    expect(queryBuilder.from).toHaveBeenCalledWith('questionnaires');
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', Q_ID);
  });

  it('throws on Supabase error (e.g. FK constraint)', async () => {
    const err = { message: 'foreign key constraint', code: '23503' };
    queryBuilder.eq.mockReturnValueOnce({ data: null, error: err });

    await expect(deleteQuestionnaire('used-id')).rejects.toEqual(err);
  });
});

// ---------- reorderQuestions ----------

describe('reorderQuestions', () => {
  it('T7.1.3 — reorders questions: [Q1, Q2, Q3] → [Q3, Q1, Q2]', async () => {
    const original = makeQuestionnaire({
      questions: [
        makeQuestion({ id: 'q1', text: 'Pergunta A', sort_order: 1 }),
        makeQuestion({ id: 'q2', text: 'Pergunta B', sort_order: 2 }),
        makeQuestion({ id: 'q3', text: 'Pergunta C', sort_order: 3 }),
      ],
    });

    // getQuestionnaire call (select → eq → maybeSingle)
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: original, error: null });

    // updateQuestionnaire call (update → eq → select → single)
    const reordered = makeQuestionnaire({
      questions: [
        makeQuestion({ id: 'q3', text: 'Pergunta C', sort_order: 1 }),
        makeQuestion({ id: 'q1', text: 'Pergunta A', sort_order: 2 }),
        makeQuestion({ id: 'q2', text: 'Pergunta B', sort_order: 3 }),
      ],
    });
    queryBuilder.single.mockReturnValueOnce({ data: reordered, error: null });

    const result = await reorderQuestions(Q_ID, ['q3', 'q1', 'q2']);

    expect(result.questions[0].id).toBe('q3');
    expect(result.questions[0].sort_order).toBe(1);
    expect(result.questions[1].id).toBe('q1');
    expect(result.questions[1].sort_order).toBe(2);
    expect(result.questions[2].id).toBe('q2');
    expect(result.questions[2].sort_order).toBe(3);
  });

  it('throws if questionnaire not found', async () => {
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: null, error: null });

    await expect(reorderQuestions('nonexistent', ['q1'])).rejects.toThrow(
      'Questionário não encontrado',
    );
  });

  it('throws if question ID not found in questionnaire', async () => {
    const original = makeQuestionnaire({
      questions: [makeQuestion({ id: 'q1', sort_order: 1 })],
    });
    queryBuilder.maybeSingle.mockReturnValueOnce({ data: original, error: null });

    await expect(reorderQuestions(Q_ID, ['q99'])).rejects.toThrow(
      'Pergunta com id "q99" não encontrada no questionário',
    );
  });
});
