import type { Questionnaire, QuestionnaireInsert, QuestionnaireUpdate } from './types.js';
/**
 * List all questionnaires for a wallet.
 */
export declare function getQuestionnaires(walletId: string): Promise<Questionnaire[]>;
/**
 * Get a single questionnaire by ID.
 * Returns null if not found.
 */
export declare function getQuestionnaire(id: string): Promise<Questionnaire | null>;
/**
 * Create a new questionnaire.
 * Validates: name required, at least 1 question, question text non-empty, weights +1/-1.
 */
export declare function createQuestionnaire(input: QuestionnaireInsert): Promise<Questionnaire>;
/**
 * Update an existing questionnaire.
 * At least one field must be provided.
 * If questions are included, they are fully validated.
 */
export declare function updateQuestionnaire(id: string, updates: QuestionnaireUpdate): Promise<Questionnaire>;
/**
 * Delete a questionnaire by ID.
 */
export declare function deleteQuestionnaire(id: string): Promise<void>;
/**
 * Reorder questions within a questionnaire.
 * Takes an array of question IDs in the desired order and updates sort_order values.
 */
export declare function reorderQuestions(questionnaireId: string, questionIds: string[]): Promise<Questionnaire>;
//# sourceMappingURL=questionnaires.d.ts.map