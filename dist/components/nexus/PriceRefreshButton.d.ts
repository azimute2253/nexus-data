export interface PriceRefreshButtonProps {
    /** Supabase Edge Function URL for refresh-prices */
    refreshUrl: string;
    /** Auth token for the Edge Function call */
    authToken: string;
    /** Callback when refresh completes successfully */
    onRefreshComplete?: () => void;
    /** Callback when refresh fails */
    onRefreshError?: (error: string) => void;
}
export declare function PriceRefreshButton({ refreshUrl, authToken, onRefreshComplete, onRefreshError, }: PriceRefreshButtonProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=PriceRefreshButton.d.ts.map