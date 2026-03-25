import type { Asset, PriceCache } from '../../lib/nexus/types.js';
export interface AssetTableProps {
    /** Active assets to display */
    assets: Asset[];
    /** Price cache entries keyed by ticker for price lookup */
    prices: Map<string, PriceCache>;
    /** USD/BRL exchange rate for currency conversion */
    exchangeRateBrl: number | null;
    /** Whether data is currently loading */
    isLoading?: boolean;
    /** Error message to display */
    error?: string | null;
    /** Callback for retry on error */
    onRetry?: () => void;
}
export declare function AssetTable({ assets, prices, exchangeRateBrl, isLoading, error, onRetry, }: AssetTableProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=AssetTable.d.ts.map