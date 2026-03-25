// ============================================================
// Nexus Data — Allocation Table Utilities
// Pure logic for sorting, formatting, and status computation.
// Used by AllocationTable.tsx React island.
// [Story 5.2]
// ============================================================
export function sortTypes(types, sort) {
    return [...types].sort((a, b) => {
        const aVal = a[sort.key];
        const bVal = b[sort.key];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sort.dir === 'asc'
                ? aVal.localeCompare(bVal, 'pt-BR')
                : bVal.localeCompare(aVal, 'pt-BR');
        }
        const diff = aVal - bVal;
        return sort.dir === 'asc' ? diff : -diff;
    });
}
// ---------- Formatting ----------
export function formatBrl(value) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
export function formatPct(value) {
    return `${value.toFixed(2)}%`;
}
export function getStatus(deviationPct) {
    if (deviationPct > 2)
        return 'Overweight';
    if (deviationPct < -2)
        return 'Underweight';
    return 'Aligned';
}
