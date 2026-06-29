import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VarContribution } from "../types/fx.ts";

interface Props {
  contributions: VarContribution[];
  diversificationBenefit: number;
}

export function VarContributionChart({ contributions, diversificationBenefit }: Props) {
  const data = [
    ...contributions.map((c) => ({
      name: c.currency,
      "Component VaR": +(c.component_var * 100).toFixed(4),
      "Standalone VaR": +(c.standalone_var * 100).toFixed(4),
    })),
    {
      name: "Diversification",
      "Component VaR": 0,
      "Standalone VaR": -(diversificationBenefit * 100),
    },
  ];

  return (
    <div className="chart-card">
      <h3>VaR Contribution by Currency</h3>
      <p className="chart-subtitle">
        Component VaR sums to total portfolio VaR. Diversification benefit is the
        reduction from holding a multi-currency portfolio.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(v) => Number(v).toFixed(4) + "%"} />
          <Legend />
          <Bar dataKey="Standalone VaR" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Component VaR" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
