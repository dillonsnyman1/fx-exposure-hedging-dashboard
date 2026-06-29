import type { ForwardHedgingResponse } from "../types/fx.ts";

interface Props {
  data: ForwardHedgingResponse;
  hedgeRatios: Record<string, number>;
  tenorYears: number;
  onHedgeRatioChange: (currency: string, ratio: number) => void;
  onTenorChange: (tenor: number) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);

const fmtRate = (v: number) => v.toFixed(6);
const fmtPts = (v: number) => (v * 10000).toFixed(2);
const fmtPct = (v: number) => (v * 100).toFixed(0) + "%";

export function ForwardHedgingPanel({ data, hedgeRatios, tenorYears, onHedgeRatioChange, onTenorChange }: Props) {
  const tenorOptions = [
    { label: "1M", value: 1 / 12 },
    { label: "3M", value: 0.25 },
    { label: "6M", value: 0.5 },
    { label: "1Y", value: 1.0 },
  ];

  return (
    <>
      <div className="toolbar" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <label className="form-field">
            Tenor
            <select
              value={tenorYears}
              onChange={(e) => onTenorChange(Number(e.target.value))}
            >
              {tenorOptions.map((t) => (
                <option key={t.label} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          {data.forwards.map((f) => (
            <label key={f.currency} className="form-field">
              {f.currency} Hedge
              <select
                value={hedgeRatios[f.currency] ?? 0}
                onChange={(e) => onHedgeRatioChange(f.currency, Number(e.target.value))}
              >
                {[0, 0.25, 0.5, 0.75, 1.0].map((r) => (
                  <option key={r} value={r}>{fmtPct(r)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="chart-card wide">
        <h3>Forward Hedging Results</h3>
        <p className="chart-subtitle">
          Forward rates derived from covered interest rate parity. Hedge cost is the
          notional hedged multiplied by forward points.
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Currency</th>
              <th>Spot Rate</th>
              <th>Forward Rate</th>
              <th>Fwd Points (pips)</th>
              <th>Hedge Ratio</th>
              <th>Unhedged Exp.</th>
              <th>Hedged Exp.</th>
              <th>Hedge Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.forwards.map((f) => (
              <tr key={f.currency}>
                <td className="row-header">{f.currency}</td>
                <td>{fmtRate(f.spot_rate)}</td>
                <td>{fmtRate(f.forward_rate)}</td>
                <td>{fmtPts(f.forward_points)}</td>
                <td>{fmtPct(f.hedge_ratio)}</td>
                <td>{fmt(f.unhedged_exposure)}</td>
                <td>{fmt(f.hedged_exposure)}</td>
                <td>{fmt(f.hedge_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td className="row-header">Total</td>
              <td colSpan={4}></td>
              <td>{fmt(data.total_unhedged_exposure)}</td>
              <td>{fmt(data.total_hedged_exposure)}</td>
              <td>{fmt(data.total_hedge_cost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
