// ============================================================
// Nexus Data — Asset Scores CRUD
// Client-side mutations via Supabase SDK (ADR-006).
// Score calculation: sum(answer.value * question.weight)
// where Sim=1 (true), Nao=0 (false).
// ============================================================

import { getAnonClient } from '../supabase.js';
import type {
  AssetScore,
  AssetScoreInsert,
  ScoreAnswer,
  Questionnaire,
  QuestionnaireQuestion,
} from './types.js';

const TABLE = 'asset_scores';

// ── Score Calculation ───────────────────────────────────────

/**
 * Calculate total score from answers and questionnaire questions.
 * Formula: sum(answer.value * question.weight) where Sim=1, Nao=0.
 * Supports negative totals (e.g. many -1 weight questions answered Sim).
 *
 * Pure function — no side effects.
 */
export function calculateScore(
  answers: ScoreAnswer[],
  questions: QuestionnaireQuestion[],
): number {
  const weightMap = new Map(questions.map((q) => [q.id, q.weight]));

  let total = 0;
  for (const answer of answers) {
    const weight = weightMap.get(answer.question_id);
    if (weight === undefined) {
      throw new Error(
        `Pergunta "${answer.question_id}" não encontrada no questionário`,
      );
    }
    // Sim (true) = 1, Nao (false) = 0
    total += (answer.value ? 1 : 0) * weight;
  }

  return total;
}

// ── Validation ──────────────────────────────────────────────

/**
 * Validate that all questions in the questionnaire have an answer.
 * Throws if any question is missing an answer or an answer references
 * a non-existent question.
 */
export function validateAnswers(
  answers: ScoreAnswer[],
  questions: QuestionnaireQuestion[],
): void {
  const questionIds = new Set(questions.map((q) => q.id));
  const answeredIds = new Set(answers.map((a) => a.question_id));

  // Check for answers referencing non-existent questions
  for (const a of answers) {
    if (!questionIds.has(a.question_id)) {
      throw new Error(
        `Resposta referencia pergunta inexistente: "${a.question_id}"`,
      );
    }
  }

  // Check for unanswered questions
  for (const qId of questionIds) {
    if (!answeredIds.has(qId)) {
      throw new Error(`Pergunta "${qId}" não foi respondida`);
    }
  }

  // Check for duplicate answers
  if (answeredIds.size !== answers.length) {
    throw new Error('Respostas duplicadas detectadas');
  }
}

// ── CRUD operations ─────────────────────────────────────────

/**
 * Get a saved score for an asset.
 * Returns null if no score exists.
 */
export async function getAssetScore(
  assetId: string,
  questionnaireId: string,
): Promise<AssetScore | null> {
  const { data, error } = await getAnonClient()
    .from(TABLE)
    .select('*')
    .eq('asset_id', assetId)
    .eq('questionnaire_id', questionnaireId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Save (upsert) a score for an asset.
 * Calculates total_score from answers × question weights.
 * If a score already exists for this asset+questionnaire, it is updated.
 */
export async function saveAssetScore(
  assetId: string,
  questionnaireId: string,
  answers: ScoreAnswer[],
  questionnaire: Questionnaire,
  userId: string,
): Promise<AssetScore> {
  // Validate all questions answered
  validateAnswers(answers, questionnaire.questions);

  // Calculate score
  const totalScore = calculateScore(answers, questionnaire.questions);

  const payload: AssetScoreInsert = {
    asset_id: assetId,
    questionnaire_id: questionnaireId,
    answers,
    total_score: totalScore,
    user_id: userId,
  };

  // Upsert: insert or update on conflict (asset_id, questionnaire_id)
  const { data, error } = await getAnonClient()
    .from(TABLE)
    .upsert(payload, { onConflict: 'asset_id,questionnaire_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a saved score for an asset.
 */
export async function deleteAssetScore(
  assetId: string,
  questionnaireId: string,
): Promise<void> {
  const { error } = await getAnonClient()
    .from(TABLE)
    .delete()
    .eq('asset_id', assetId)
    .eq('questionnaire_id', questionnaireId);

  if (error) throw error;
}

/**
 * Get all scores for assets within a specific questionnaire.
 * Used for building score arrays for normalizeScores().
 */
export async function getScoresByQuestionnaire(
  questionnaireId: string,
): Promise<AssetScore[]> {
  const { data, error } = await getAnonClient()
    .from(TABLE)
    .select('*')
    .eq('questionnaire_id', questionnaireId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}
