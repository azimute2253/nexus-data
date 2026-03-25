export interface ConfirmDialogProps {
    /** Whether the dialog is visible */
    isOpen: boolean;
    /** Dialog title */
    title: string;
    /** Warning/description message */
    message: string;
    /** Label for confirm button (default: "Confirmar") */
    confirmLabel?: string;
    /** Label for cancel button (default: "Cancelar") */
    cancelLabel?: string;
    /** Visual style for confirm button */
    variant?: 'danger' | 'default';
    /** Called when user confirms */
    onConfirm: () => void;
    /** Called when user cancels or presses Escape */
    onCancel: () => void;
}
export declare function ConfirmDialog({ isOpen, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel, }: ConfirmDialogProps): import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=ConfirmDialog.d.ts.map