import { useEffect, useState } from "react";
import "./App.css";
import {
  computeExposure,
  computeForwards,
  computeFxVar,
  computeHedgeEffectiveness,
  fetchSamplePortfolio,
} from "./api/client.ts";
import { CorrelationHeatmap } from "./components/CorrelationHeatmap.tsx";
import { ExposureBarChart } from "./components/ExposureBarChart.tsx";
import { ExposureSummaryCards } from "./components/ExposureSummaryCards.tsx";
import { ForwardHedgingPanel } from "./components/ForwardHedgingPanel.tsx";
import { HedgeEffectivenessPanel } from "./components/HedgeEffectivenessPanel.tsx";
import { VarContributionChart } from "./components/VarContributionChart.tsx";
import { VarSurfaceTable } from "./components/VarSurfaceTable.tsx";
import type {
  ExposureResponse,
  ForwardHedgingResponse,
  FxVarResponse,
  HedgeEffectivenessResponse,
  SamplePortfolioResponse,
} from "./types/fx.ts";

type Tab = "exposure" | "hedging" | "var-analysis" | "hedge-effectiveness";

const TABS: [Tab, string][] = [
  ["exposure", "Exposure"],
  ["hedging", "Hedging"],
  ["var-analysis", "VaR Analysis"],
  ["hedge-effectiveness", "Hedge Effectiveness"],
];

function App() {
  const [sampleData, setSampleData] = useState<SamplePortfolioResponse | null>(null);
  const [exposure, setExposure] = useState<ExposureResponse | null>(null);
  const [forwards, setForwards] = useState<ForwardHedgingResponse | null>(null);
  const [fxVar, setFxVar] = useState<FxVarResponse | null>(null);
  const [hedgeEff, setHedgeEff] = useState<HedgeEffectivenessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("exposure");
  const [hedgeRatios, setHedgeRatios] = useState<Record<string, number>>({});
  const [tenorYears, setTenorYears] = useState(0.25);

  useEffect(() => {
    setLoading(true);
    fetchSamplePortfolio()
      .then((data) => {
        setSampleData(data);
        const ratios: Record<string, number> = {};
        for (const p of data.positions) ratios[p.currency] = 0.5;
        setHedgeRatios(ratios);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sample data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sampleData) return;
    computeExposure(sampleData.positions, sampleData.spot_rates, "USD")
      .then(setExposure)
      .catch(() => {});
  }, [sampleData]);

  useEffect(() => {
    if (!sampleData) return;
    computeForwards(
      sampleData.positions, sampleData.spot_rates,
      sampleData.interest_rates, hedgeRatios, tenorYears, "USD",
    )
      .then(setForwards)
      .catch(() => {});
  }, [sampleData, hedgeRatios, tenorYears]);

  useEffect(() => {
    if (!sampleData || !exposure) return;
    const exposures: Record<string, number> = {};
    for (const e of exposure.currency_exposures) {
      exposures[e.currency] = e.net_exposure_base;
    }
    computeFxVar(exposures, sampleData.fx_returns)
      .then(setFxVar)
      .catch(() => {});
  }, [sampleData, exposure]);

  useEffect(() => {
    if (!sampleData) return;
    const n = Object.values(sampleData.fx_returns)[0]?.length ?? 0;
    if (n < 10) return;
    const rng = Array.from({ length: n }, (_, i) => {
      let sum = 0;
      for (const ccy of Object.keys(sampleData.fx_returns)) {
        sum += sampleData.fx_returns[ccy][i];
      }
      return sum / Object.keys(sampleData.fx_returns).length;
    });
    const hedged = rng.map((v) => v * 0.3);
    computeHedgeEffectiveness(rng, hedged)
      .then(setHedgeEff)
      .catch(() => {});
  }, [sampleData]);

  function handleHedgeRatioChange(currency: string, ratio: number) {
    setHedgeRatios((prev) => ({ ...prev, [currency]: ratio }));
  }

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
          {tab === "exposure" && exposure && (
            <>
              <ExposureSummaryCards data={exposure} />
              <ExposureBarChart exposures={exposure.currency_exposures} />
            </>
          )}

          {tab === "hedging" && forwards && (
            <ForwardHedgingPanel
              data={forwards}
              hedgeRatios={hedgeRatios}
              tenorYears={tenorYears}
              onHedgeRatioChange={handleHedgeRatioChange}
              onTenorChange={setTenorYears}
            />
          )}

          {tab === "var-analysis" && fxVar && (
            <>
              <div className="charts-row">
                <VarContributionChart
                  contributions={fxVar.var_contributions}
                  diversificationBenefit={fxVar.diversification_benefit}
                />
                <CorrelationHeatmap
                  currencies={fxVar.currencies}
                  matrix={fxVar.correlation_matrix}
                />
              </div>
              <VarSurfaceTable surface={fxVar.var_surface} />
            </>
          )}

          {tab === "hedge-effectiveness" && hedgeEff && (
            <HedgeEffectivenessPanel data={hedgeEff} />
          )}
        </div>
      )}
    </>
  );
}

export default App;
