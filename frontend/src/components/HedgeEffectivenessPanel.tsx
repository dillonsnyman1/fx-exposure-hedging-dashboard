import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HedgeEffectivenessResponse } from "../types/fx.ts";

interface Props {
  data: HedgeEffectivenessResponse;
}

const pct = (v: number) => (v * 100).toFixed(2) + "%";

export function HedgeEffectivenessPanel({ data }: Props) {
  const maxLen = Math.min(data.unhedged_distribution.counts.length, data.hedged_distribution.counts.length);
  const chartData = Array.from({ length: maxLen }, (_, i) => {
    const binCenter =
      (data.unhedged_distribution.bin_edges[i] + data.unhedged_distribution.bin_edges[i + 1]) / 2;
    return {
      return: +(binCenter * 100).toFixed(4),
      Unhedged: data.unhedged_distribution.counts[i],
      Hedged: data.hedged_distribution.counts[i],
    };
  });

  const metrics = [
    { label: "Dollar-Offset Ratio", value: data.dollar_offset_ratio.toFixed(3), color: "#2563eb" },
    { label: "Regression R-Squared", value: data.regression_r_squared.toFixed(4), color: "#7c3aed" },
    { label: "Regression Beta", value: data.regression_beta.toFixed(4), color: "#0891b2" },
    { label: "Unhedged Vol", value: pct(data.unhedged_vol), color: "#d97706" },
    { label: "Hedged Vol", value: pct(data.hedged_vol), color: "#059669" },
    { label: "Vol Reduction", value: data.vol_reduction_pct.toFixed(1) + "%", color: "#dc2626" },
  ];

  return (
    <>
      <div className="summary-cards">
        {metrics.map((m) => (
          <div key={m.label} className="summary-card" style={{ borderTopColor: m.color }}>
            <div className="summary-card-label">{m.label}</div>
            <div className="summary-card-value">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="chart-card wide">
        <h3>Hedged vs Unhedged Return Distribution</h3>
        <p className="chart-subtitle">
          Overlay of the hedged and unhedged portfolio return distributions.
          A tighter hedged distribution indicates effective hedging.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="return" tick={{ fontSize: 11 }} unit="%" />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="Unhedged" fill="#dc262640" stroke="#dc2626" />
            <Area type="monotone" dataKey="Hedged" fill="#2563eb40" stroke="#2563eb" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
