// ============================================================
// Nexus Data — Questionnaires CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// All operations use the anon client (respects RLS).
// wallet_id isolation is app-layer (ADR-014).
// ============================================================
import { getAnonClient } from '../supabase.js';
const TABLE = 'questionnaires';
// ── Validation helpers ──────────────────────────────────────
const VALID_WEIGHTS = [1, -1];
function validateQuestion(q, index) {
    if (!q.text?.trim()) {
        throw new Error(`Pergunta ${index + 1}: texto é obrigatório`);
    }
    if (!VALID_WEIGHTS.includes(q.weight)) {
        throw new Error(`Pergunta ${index + 1}: peso deve ser +1 ou -1`);
    }
    if (!Number.isInteger(q.sort_order)) {
        throw new Error(`Pergunta ${index + 1}: sort_order deve ser inteiro`);
    }
}
function validateQuestions(questions) {
    if (!questions || questions.length === 0) {
        throw new Error('Questionario deve ter pelo menos 1 pergunta');
    }
    for (let i = 0; i < questions.length; i++) {
        validateQuestion(questions[i], i);
    }
}
// ── CRUD operations ─────────────────────────────────────────
/**
 * List all questionnaires for a wallet.
 */
export async function getQuestionnaires(walletId) {
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: true });
    if (error)
        throw error;
    return data;
}
/**
 * Get a single questionnaire by ID.
 * Returns null if not found.
 */
export async function getQuestionnaire(id) {
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error)
        throw error;
    return data;
}
/**
 * Create a new questionnaire.
 * Validates: name required, at least 1 question, question text non-empty, weights +1/-1.
 */
export async function createQuestionnaire(input) {
    if (!input.name?.trim()) {
        throw new Error('Nome do questionário é obrigatório');
    }
    validateQuestions(input.questions);
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .insert(input)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
/**
 * Update an existing questionnaire.
 * At least one field must be provided.
 * If questions are included, they are fully validated.
 */
export async function updateQuestionnaire(id, updates) {
    const keys = Object.keys(updates).filter((k) => updates[k] !== undefined);
    if (keys.length === 0) {
        throw new Error('At least one field must be provided for update');
    }
    if ('name' in updates && !updates.name?.trim()) {
        throw new Error('Nome do questionário não pode ser vazio');
    }
    if ('questions' in updates && updates.questions !== undefined) {
        validateQuestions(updates.questions);
    }
    const { data, error } = await getAnonClient()
        .from(TABLE)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error)
        throw error;
    return data;
}
/**
 * Delete a questionnaire by ID.
 */
export async function deleteQuestionnaire(id) {
    const { error } = await getAnonClient()
        .from(TABLE)
        .delete()
        .eq('id', id);
    if (error)
        throw error;
}
/**
 * Reorder questions within a questionnaire.
 * Takes an array of question IDs in the desired order and updates sort_order values.
 */
export async function reorderQuestions(questionnaireId, questionIds) {
    const questionnaire = await getQuestionnaire(questionnaireId);
    if (!questionnaire) {
        throw new Error('Questionário não encontrado');
    }
    const questionsMap = new Map(questionnaire.questions.map((q) => [q.id, q]));
    // Validate all IDs exist
    for (const qid of questionIds) {
        if (!questionsMap.has(qid)) {
            throw new Error(`Pergunta com id "${qid}" não encontrada no questionário`);
        }
    }
    // Rebuild questions array with updated sort_order
    const reordered = questionIds.map((qid, index) => ({
        ...questionsMap.get(qid),
        sort_order: index + 1,
    }));
    return updateQuestionnaire(questionnaireId, { questions: reordered });
}
