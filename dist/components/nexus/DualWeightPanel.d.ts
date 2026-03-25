import type { Asset, AssetUpdate, Questionnaire, AssetScore, ScoreAnswer } from '../../lib/nexus/types.js';
export interface DualWeightPanelProps {
    /** The asset being edited */
    asset: Asset;
    /** Questionnaire linked to the asset's type (null = no questionnaire) */
    questionnaire: Questionnaire | null;
    /** Previously saved questionnaire score (null = fresh) */
    savedScore: AssetScore | null;
    /** Normalized weight percentage within the group (0-100, read-only) */
    weightPct: number | null;
    /** Callback to persist asset updates (weight_mode + manual_weight) */
    onSave: (id: string, updates: AssetUpdate) => Promise<void>;
    /** Callback to persist questionnaire answers */
    onSaveScore: (answers: ScoreAnswer[]) => Promise<void>;
}
export declare function DualWeightPanel({ asset, questionnaire, savedScore, weightPct, onSave, onSaveScore, }: DualWeightPanelProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DualWeightPanel.d.ts.map