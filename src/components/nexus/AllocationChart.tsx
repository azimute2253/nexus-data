// ============================================================
// Nexus Data — Allocation Pie Chart Component
// Side-by-side pie charts comparing actual vs target allocation
// across asset types. Uses Recharts within a React island.
// Desktop: side-by-side | Mobile (< 768px): stacked vertically.
// [Story 5.3, ADR-006]
// ============================================================

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import type { TypePerformance } from '../../lib/dashboard/types.js';
import { formatBrl, formatPct } from '../../lib/dashboard/allocation-utils.js';

// ---------- Props ----------

export interface AllocationChartProps {
  /** Performance data per asset type from getPerformanceMetrics() */
  types: TypePerformance[];
  /** Total portfolio value in BRL */
  totalValueBrl: number;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message to display instead of chart */
  error?: string | null;
  /** Callback for retry on error */
  onRetry?: () => void;
}

// ---------- Colors ----------

const TYPE_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#14B8A6', // teal-500
  '#6366F1', // indigo-500
];

export function getColor(index: number): string {
  return TYPE_COLORS[index % TYPE_COLORS.length];
}

// ---------- Chart data ----------

export interface ChartSlice {
  name: string;
  value: number;
  valueBrl: number;
  fill: string;
}

export function buildActualSlices(types: TypePerformance[]): ChartSlice[] {
  return types
    .filter((t) => t.actual_pct > 0)
    .map((t, _i) => {
      const originalIndex = types.indexOf(t);
      return {
        name: t.asset_type_name,
        value: t.actual_pct,
        valueBrl: t.total_value_brl,
        fill: getColor(originalIndex),
      };
    });
}

export function buildTargetSlices(types: TypePerformance[], totalValueBrl: number): ChartSlice[] {
  return types
    .filter((t) => t.target_pct > 0)
    .map((t, _i) => {
      const originalIndex = types.indexOf(t);
      return {
        name: t.asset_type_name,
        value: t.target_pct,
        valueBrl: totalValueBrl * (t.target_pct / 100),
        fill: getColor(originalIndex),
      };
    });
}

// ---------- Custom tooltip ----------

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartSlice }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-gray-900">{data.name}</p>
      <p className="text-sm text-gray-600">{formatPct(data.value)}</p>
      <p className="text-sm text-gray-600">{formatBrl(data.valueBrl)}</p>
    </div>
  );
}

// ---------- Custom label ----------

function renderLabel(props: PieLabelRenderProps) {
  const { name, value, x, y, textAnchor } = props;
  if (typeof value !== 'number' || value < 3) return null; // skip tiny slices
  return (
    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" className="text-xs" fill="#374151">
      {name ?? ''} {formatPct(value)}
    </text>
  );
}

// ---------- Loading skeleton ----------

function LoadingSkeleton() {
  return (
    <div className="animate-pulse p-6" role="status" aria-label="Carregando gráficos de alocação">
      <div className="flex flex-col items-center gap-8 md:flex-row md:justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-48 w-48 rounded-full bg-gray-200" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-4 w-16 rounded bg-gray-200" />
          <div className="h-48 w-48 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

// ---------- Error state ----------

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
      <p className="text-sm text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          type="button"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

// ---------- Empty state ----------

function EmptyState() {
  return (
    <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-12" role="status">
      <p className="text-sm text-gray-500">Sem dados para exibir</p>
    </div>
  );
}

// ---------- Single pie chart ----------

function SinglePie({ title, data, descText }: { title: string; data: ChartSlice[]; descText: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <desc>{descText}</desc>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={40}
            paddingAngle={1}
            label={renderLabel}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} stroke="#fff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------- Color legend ----------

function ColorLegend({ types }: { types: TypePerformance[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-2">
      {types.map((t, i) => (
        <div key={t.asset_type_id} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-sm"
            style={{ backgroundColor: getColor(i) }}
            aria-hidden="true"
          />
          <span className="text-xs text-gray-600">{t.asset_type_name}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Main component ----------

export function AllocationChart({
  types,
  totalValueBrl,
  isLoading = false,
  error = null,
  onRetry,
}: AllocationChartProps) {
  const actualSlices = useMemo(() => buildActualSlices(types), [types]);
  const targetSlices = useMemo(() => buildTargetSlices(types, totalValueBrl), [types, totalValueBrl]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (types.length === 0) return <EmptyState />;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:gap-2" role="img" aria-label="Gráficos de alocação: Atual vs Target">
        <SinglePie
          title="Atual"
          data={actualSlices}
          descText="Gráfico pizza mostrando a alocação atual do portfólio por tipo de ativo"
        />
        <SinglePie
          title="Target"
          data={targetSlices}
          descText="Gráfico pizza mostrando a alocação alvo do portfólio por tipo de ativo"
        />
      </div>
      <ColorLegend types={types} />
    </div>
  );
}
