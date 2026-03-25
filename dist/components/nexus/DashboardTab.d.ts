export interface DashboardTabProps {
    /** Active wallet ID from WalletSelector */
    walletId: string | null;
    /** User ID for data filtering */
    userId: string;
    /** Callback to navigate to Ativos tab */
    onNavigateAtivos?: () => void;
}
export declare function DashboardTab({ walletId, userId, onNavigateAtivos, }: DashboardTabProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=DashboardTab.d.ts.map