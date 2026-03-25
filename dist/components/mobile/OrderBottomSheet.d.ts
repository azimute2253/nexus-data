import type { RebalanceResult } from '../../lib/nexus/types.js';
export interface OrderBottomSheetProps {
    result: RebalanceResult;
    open: boolean;
    onClose: () => void;
}
export declare function OrderBottomSheet({ result, open, onClose }: OrderBottomSheetProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=OrderBottomSheet.d.ts.map