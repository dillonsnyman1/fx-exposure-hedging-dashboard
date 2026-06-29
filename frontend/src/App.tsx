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
import { PortfolioBuilder } from "./components/PortfolioBuilder.tsx";
import { VarContributionChart } from "./components/VarContributionChart.tsx";
import { VarSurfaceTable } from "./components/VarSurfaceTable.tsx";
import type {
  ExposureResponse,
  ForwardHedgingResponse,
  FxPosition,
  FxVarResponse,
  HedgeEffectivenessResponse,
  InterestRatePair,
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
  const [positions, setPositions] = useState<FxPosition[]>([]);
  const [spotRates, setSpotRates] = useState<Record<string, number>>({});
  const [interestRates, setInterestRates] = useState<InterestRatePair[]>([]);

  const [exposure, setExposure] = useState<ExposureResponse | null>(null);
  const [forwards, setForwards] = useState<ForwardHedgingResponse | null>(null);
  const [fxVar, setFxVar] = useState<FxVarResponse | null>(null);
  const [hedgeEff, setHedgeEff] = useState<HedgeEffectivenessResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.slice(1);
    return TABS.some(([k]) => k === hash) ? (hash as Tab) : "exposure";
  });

  const [hedgeRatios, setHedgeRatios] = useState<Record<string, number>>({});
  const [tenorYears, setTenorYears] = useState(0.25);
  const [varConfidences, setVarConfidences] = useState([0.90, 0.95, 0.99]);
  const [varHoldingPeriods, setVarHoldingPeriods] = useState([1, 5, 10]);

  useEffect(() => {
    setLoading(true);
    fetchSamplePortfolio()
      .then((data) => {
        setSampleData(data);
        setPositions(data.positions);
        setSpotRates(data.spot_rates);
        setInterestRates(data.interest_rates);
        const ratios: Record<string, number> = {};
        for (const p of data.positions) ratios[p.currency] = 0.5;
        setHedgeRatios(ratios);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sample data"))
      .finally(() => setLoading(false));
  }, []);

  function recalculate(pos: FxPosition[], spots: Record<string, number>, rates: InterestRatePair[]) {
    setPositions(pos);
    setSpotRates(spots);
    setInterestRates(rates);
    setError(null);

    computeExposure(pos, spots, "USD")
      .then(setExposure)
      .catch((e) => setError(e instanceof Error ? e.message : "Exposure calculation failed"));

    computeForwards(pos, spots, rates, hedgeRatios, tenorYears, "USD")
      .then(setForwards)
      .catch(() => {});
  }

  useEffect(() => {
    if (positions.length === 0) return;
    computeForwards(positions, spotRates, interestRates, hedgeRatios, tenorYears, "USD")
      .then(setForwards)
      .catch(() => {});
  }, [hedgeRatios, tenorYears]);

  useEffect(() => {
    if (!exposure || !sampleData) return;
    const exposures: Record<string, number> = {};
    for (const e of exposure.currency_exposures) {
      exposures[e.currency] = e.net_exposure_base;
    }
    const availableReturns: Record<string, number[]> = {};
    for (const ccy of Object.keys(exposures)) {
      if (sampleData.fx_returns[ccy]) {
        availableReturns[ccy] = sampleData.fx_returns[ccy];
      }
    }
    if (Object.keys(availableReturns).length < 2) return;
    computeFxVar(exposures, availableReturns, varConfidences, varHoldingPeriods)
      .then(setFxVar)
      .catch(() => {});
  }, [exposure, sampleData, varConfidences, varHoldingPeriods]);

  useEffect(() => {
    if (!sampleData) return;
    const currencies = Object.keys(sampleData.fx_returns);
    const n = sampleData.fx_returns[currencies[0]]?.length ?? 0;
    if (n < 10 || currencies.length === 0) return;

    const unhedged = Array.from({ length: n }, (_, i) => {
      let sum = 0;
      for (const ccy of currencies) sum += sampleData.fx_returns[ccy][i];
      return sum / currencies.length;
    });
    const hedged = unhedged.map((v) => v * 0.3);
    computeHedgeEffectiveness(unhedged, hedged)
      .then(setHedgeEff)
      .catch(() => {});
  }, [sampleData]);

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

      <PortfolioBuilder
        positions={positions}
        spotRates={spotRates}
        interestRates={interestRates}
        onUpdate={recalculate}
        loading={loading}
      />

      <nav className="tab-nav">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            className={`tab-button${tab === key ? " active" : ""}`}
            onClick={() => { setTab(key); window.location.hash = key; }}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <div className="status-message error">{error}</div>}

      {!error && (
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
              onHedgeRatioChange={(ccy, ratio) => setHedgeRatios((prev) => ({ ...prev, [ccy]: ratio }))}
              onTenorChange={setTenorYears}
            />
          )}

          {tab === "var-analysis" && (
            <>
              <div className="toolbar" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <label className="form-field">
                    Confidence Levels
                    <select
                      value={varConfidences.join(",")}
                      onChange={(e) => setVarConfidences(e.target.value.split(",").map(Number))}
                    >
                      <option value="0.9,0.95,0.99">90%, 95%, 99%</option>
                      <option value="0.95,0.99">95%, 99%</option>
                      <option value="0.95">95% only</option>
                      <option value="0.99">99% only</option>
                    </select>
                  </label>
                  <label className="form-field">
                    Holding Periods
                    <select
                      value={varHoldingPeriods.join(",")}
                      onChange={(e) => setVarHoldingPeriods(e.target.value.split(",").map(Number))}
                    >
                      <option value="1,5,10">1d, 5d, 10d</option>
                      <option value="1,10,21">1d, 10d, 21d</option>
                      <option value="1">1d only</option>
                      <option value="1,5,10,21">1d, 5d, 10d, 21d</option>
                    </select>
                  </label>
                </div>
              </div>
              {fxVar && (
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
            </>
          )}

          {tab === "hedge-effectiveness" && hedgeEff && (
            <HedgeEffectivenessPanel data={hedgeEff} />
          )}
        </div>
      )}

      {loading && <div className="status-message">Loading sample portfolio...</div>}
    </>
  );
}

export default App;
