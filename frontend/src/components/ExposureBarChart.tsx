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
import type { CurrencyExposure } from "../types/fx.ts";
import { CURRENCY_COLORS } from "../types/fx.ts";

interface Props {
  exposures: CurrencyExposure[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

export function ExposureBarChart({ exposures }: Props) {
  const data = exposures.map((e) => ({
    currency: e.currency,
    Long: e.gross_long,
    Short: -e.gross_short,
    Net: e.net_exposure_base,
  }));

  return (
    <div className="chart-card wide">
      <h3>Net Exposure by Currency</h3>
      <p className="chart-subtitle">
        Gross long and short exposure per currency, converted to base currency.
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="currency" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={fmt} />
          <Tooltip formatter={(v) => fmt(Number(v))} />
          <Legend />
          <Bar dataKey="Long" fill="#059669" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Short" fill="#dc2626" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Net" fill={CURRENCY_COLORS.EUR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
