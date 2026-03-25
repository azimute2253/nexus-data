import type { AssetScore, ScoreAnswer, Questionnaire, QuestionnaireQuestion } from './types.js';
/**
 * Calculate total score from answers and questionnaire questions.
 * Formula: sum(answer.value * question.weight) where Sim=1, Nao=0.
 * Supports negative totals (e.g. many -1 weight questions answered Sim).
 *
 * Pure function — no side effects.
 */
export declare function calculateScore(answers: ScoreAnswer[], questions: QuestionnaireQuestion[]): number;
/**
 * Validate that all questions in the questionnaire have an answer.
 * Throws if any question is missing an answer or an answer references
 * a non-existent question.
 */
export declare function validateAnswers(answers: ScoreAnswer[], questions: QuestionnaireQuestion[]): void;
/**
 * Get a saved score for an asset.
 * Returns null if no score exists.
 */
export declare function getAssetScore(assetId: string, questionnaireId: string): Promise<AssetScore | null>;
/**
 * Save (upsert) a score for an asset.
 * Calculates total_score from answers × question weights.
 * If a score already exists for this asset+questionnaire, it is updated.
 */
export declare function saveAssetScore(assetId: string, questionnaireId: string, answers: ScoreAnswer[], questionnaire: Questionnaire, userId: string, walletId: string): Promise<AssetScore>;
/**
 * Delete a saved score for an asset.
 */
export declare function deleteAssetScore(assetId: string, questionnaireId: string): Promise<void>;
/**
 * Get all scores for assets within a specific questionnaire, filtered by wallet.
 * Used for building score arrays for normalizeScores().
 */
export declare function getScoresByQuestionnaire(walletId: string, questionnaireId: string): Promise<AssetScore[]>;
//# sourceMappingURL=asset-scores.d.ts.map