export interface TargetWarningProps {
    /** Current sum of target percentages */
    sum: number;
    /** Label for the context (e.g. "classes de ativo", "grupos em Ações BR") */
    label: string;
    /** Tolerance in percentage points before showing warning (default: 0 for classes, 1 for groups) */
    tolerancePp?: number;
}
export declare function TargetWarning({ sum, label, tolerancePp }: TargetWarningProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=TargetWarning.d.ts.map