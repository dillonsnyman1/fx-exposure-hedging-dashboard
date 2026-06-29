import type { ExposureResponse } from "../types/fx.ts";

interface Props {
  data: ExposureResponse;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export function ExposureSummaryCards({ data }: Props) {
  const largest = data.currency_exposures.reduce(
    (max, e) => (Math.abs(e.net_exposure_base) > Math.abs(max.net_exposure_base) ? e : max),
    data.currency_exposures[0],
  );

  const cards = [
    { label: "Total Gross Exposure", value: fmt(data.total_gross_exposure), sub: `Base: ${data.base_currency}`, color: "#2563eb" },
    { label: "Total Net Exposure", value: fmt(data.total_net_exposure), sub: `${data.currency_exposures.length} currencies`, color: "#7c3aed" },
    { label: "Number of Currencies", value: String(data.currency_exposures.length), sub: "Distinct currencies", color: "#0891b2" },
    { label: "Largest Single Exposure", value: fmt(Math.abs(largest.net_exposure_base)), sub: largest.currency, color: "#d97706" },
  ];

  return (
    <div className="summary-cards">
      {cards.map((c) => (
        <div key={c.label} className="summary-card" style={{ borderTopColor: c.color }}>
          <div className="summary-card-label">{c.label}</div>
          <div className="summary-card-value">{c.value}</div>
          <div className="summary-card-subvalue">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
