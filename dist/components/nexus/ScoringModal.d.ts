import type { Questionnaire, ScoreAnswer, AssetScore } from '../../lib/nexus/types.js';
export interface ScoringModalProps {
    /** Whether the modal is visible */
    isOpen: boolean;
    /** Callback to close the modal */
    onClose: () => void;
    /** Asset being scored */
    asset: {
        id: string;
        ticker: string;
    };
    /** Questionnaire linked to the asset's type (null = no questionnaire) */
    questionnaire: Questionnaire | null;
    /** Previously saved score for pre-filling (null = fresh) */
    savedScore: AssetScore | null;
    /** Callback to persist answers. Receives answers array. */
    onSave: (answers: ScoreAnswer[]) => Promise<void>;
}
export declare function ScoringModal({ isOpen, onClose, asset, questionnaire, savedScore, onSave, }: ScoringModalProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=ScoringModal.d.ts.map