import type { FxVarResult } from "../types/fx.ts";

interface Props {
  surface: FxVarResult[];
}

const pct = (v: number) => (v * 100).toFixed(3) + "%";

export function VarSurfaceTable({ surface }: Props) {
  return (
    <div className="chart-card wide">
      <h3>VaR Surface</h3>
      <p className="chart-subtitle">
        VaR and CVaR across confidence levels and holding periods.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Confidence</th>
            <th>Holding Period</th>
            <th>Hist. VaR</th>
            <th>Hist. CVaR</th>
            <th>Param. VaR</th>
            <th>Param. CVaR</th>
          </tr>
        </thead>
        <tbody>
          {surface.map((r, i) => (
            <tr key={i}>
              <td className="row-header">{(r.confidence * 100).toFixed(0)}%</td>
              <td>{r.holding_period}d</td>
              <td>{pct(r.var_historical)}</td>
              <td>{pct(r.cvar_historical)}</td>
              <td>{pct(r.var_parametric)}</td>
              <td>{pct(r.cvar_parametric)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
