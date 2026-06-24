import { useEffect, useState } from "react";
import "./App.css";
import { fetchSamplePortfolio } from "./api/client.ts";
import type { SamplePortfolioResponse } from "./types/fx.ts";

type Tab = "exposure" | "hedging" | "var-analysis" | "hedge-effectiveness";

const TABS: [Tab, string][] = [
  ["exposure", "Exposure"],
  ["hedging", "Hedging"],
  ["var-analysis", "VaR Analysis"],
  ["hedge-effectiveness", "Hedge Effectiveness"],
];

function App() {
  const [sampleData, setSampleData] = useState<SamplePortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("exposure");

  useEffect(() => {
    setLoading(true);
    fetchSamplePortfolio()
      .then(setSampleData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sample data"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <header className="app-header">
        <h1>FX Exposure & Hedging Dashboard</h1>
        <p className="header-tagline">
          Portfolio FX exposure, forward hedging, currency-level VaR and hedge effectiveness analysis.
        </p>
        <p className="header-background">
          Consolidate multi-currency positions into a single exposure view, model the
          cost and effect of forward hedging via covered interest rate parity, compute
          portfolio VaR with risk decomposition by currency, and assess hedge
          effectiveness using dollar-offset and regression methods.
        </p>
      </header>

      <nav className="tab-nav">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`tab-button${tab === key ? " active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading && <div className="status-message">Loading...</div>}
      {error && <div className="status-message error">{error}</div>}

      {!loading && !error && sampleData && (
        <div className="tab-content" key={tab}>
          {tab === "exposure" && (
            <div className="tab-placeholder">
              Exposure tab - {sampleData.positions.length} positions loaded across{" "}
              {Object.keys(sampleData.spot_rates).length} currencies
            </div>
          )}
          {tab === "hedging" && (
            <div className="tab-placeholder">
              Hedging tab - forward rate modelling and hedge ratio controls
            </div>
          )}
          {tab === "var-analysis" && (
            <div className="tab-placeholder">
              VaR Analysis tab - portfolio FX VaR, correlation heatmap and risk decomposition
            </div>
          )}
          {tab === "hedge-effectiveness" && (
            <div className="tab-placeholder">
              Hedge Effectiveness tab - dollar-offset, regression and P&L distribution comparison
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default App;
