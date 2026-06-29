import { useEffect, useRef, useState } from "react";
import { fetchLiveRates } from "../api/client.ts";
import type { FxPosition, InterestRatePair } from "../types/fx.ts";

interface Props {
  positions: FxPosition[];
  spotRates: Record<string, number>;
  interestRates: InterestRatePair[];
  onUpdate: (positions: FxPosition[], spotRates: Record<string, number>, interestRates: InterestRatePair[]) => void;
  loading: boolean;
}

const CURRENCIES = ["EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "SEK", "NOK", "NZD", "SGD"];
const CACHE_TTL = 60;

const cellInputStyle = {
  width: 90, padding: "4px 6px", borderRadius: 4,
  border: "1px solid var(--border)", fontFamily: "var(--mono)", fontSize: 13,
};

export function PortfolioBuilder({ positions, spotRates, interestRates, onUpdate, loading }: Props) {
  const [draft, setDraft] = useState(positions);
  const [draftSpots, setDraftSpots] = useState(spotRates);
  const [draftRates, setDraftRates] = useState(interestRates);

  const [spotSource, setSpotSource] = useState<Record<string, number> | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const lastFetchedCurrencies = useRef<string[]>([]);

  useEffect(() => {
    if (fetchedAt === null) return;
    setElapsed(Math.floor((Date.now() - fetchedAt) / 1000));
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - fetchedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchedAt]);

  function isSpotEdited(ccy: string): boolean {
    if (!spotSource || !(ccy in spotSource)) return false;
    return draftSpots[ccy] !== spotSource[ccy];
  }

  const anySpotEdited = spotSource !== null && Object.keys(spotSource).some(isSpotEdited);

  function resetSpot(ccy: string) {
    if (!spotSource || !(ccy in spotSource)) return;
    setDraftSpots((prev) => ({ ...prev, [ccy]: spotSource[ccy] }));
  }

  function resetAllSpots() {
    if (!spotSource) return;
    setDraftSpots((prev) => ({ ...prev, ...spotSource }));
  }

  function handleFetchLiveRates() {
    const currencies = [...new Set(draft.map((p) => p.currency))];
    if (currencies.length === 0) return;
    setFetchingRates(true);
    setFetchError(null);
    fetchLiveRates(currencies, "USD")
      .then((res) => {
        setDraftSpots((prev) => ({ ...prev, ...res.spot_rates }));
        setSpotSource(res.spot_rates);
        setUnavailable(res.unavailable);
        setFetchedAt(Date.now());
        lastFetchedCurrencies.current = currencies;
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : "Failed to fetch live rates"))
      .finally(() => setFetchingRates(false));
  }

  function updatePosition(idx: number, field: string, value: string | number) {
    setDraft((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function addPosition() {
    const used = new Set(draft.map((p) => p.currency));
    const next = CURRENCIES.find((c) => !used.has(c)) ?? "EUR";
    setDraft((prev) => [...prev, { currency: next, notional: 1_000_000, direction: "long" as const, label: "" }]);
    if (!draftSpots[next]) setDraftSpots((prev) => ({ ...prev, [next]: 1.0 }));
    if (!draftRates.find((r) => r.currency === next)) {
      setDraftRates((prev) => [...prev, { currency: next, domestic_rate: 0.05, foreign_rate: 0.03 }]);
    }
  }

  function removePosition(idx: number) {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSpot(ccy: string, rate: number) {
    setDraftSpots((prev) => ({ ...prev, [ccy]: rate }));
  }

  function updateInterestRate(ccy: string, field: "domestic_rate" | "foreign_rate", value: number) {
    setDraftRates((prev) =>
      prev.map((r) => r.currency === ccy ? { ...r, [field]: value } : r)
    );
  }

  function handleApply() {
    onUpdate(draft, draftSpots, draftRates);
  }

  const activeCurrencies = [...new Set(draft.map((p) => p.currency))];

  return (
    <div className="toolbar">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.03em", color: "var(--text)" }}>
          Portfolio Positions
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {fetchedAt !== null && (
            <span style={{ fontSize: 12, color: elapsed >= CACHE_TTL ? "#b91c1c" : "var(--text)" }}>
              {elapsed < CACHE_TTL
                ? `Spot rates live ${elapsed}s ago`
                : `Spot rates stale (${Math.floor(elapsed / 60)}m ${elapsed % 60}s ago)`}
              {elapsed >= CACHE_TTL && (
                <button
                  onClick={handleFetchLiveRates}
                  style={{ marginLeft: 6, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13 }}
                >
                  ↻
                </button>
              )}
            </span>
          )}
          {anySpotEdited && (
            <button
              onClick={resetAllSpots}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 12, textDecoration: "underline" }}
            >
              ↺ Reset all spot rates to source
            </button>
          )}
          <button
            onClick={handleFetchLiveRates}
            disabled={fetchingRates}
            style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--accent)", background: fetchingRates ? "var(--card-bg)" : "var(--accent-soft)", color: "var(--accent)", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
          >
            {fetchingRates ? "Fetching..." : "Fetch Live Spot Rates"}
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 10 }}>{fetchError}</div>
      )}
      {unavailable.length > 0 && (
        <div style={{ fontSize: 12, color: "#b45309", marginBottom: 10 }}>
          No live data available for: {unavailable.join(", ")}
        </div>
      )}

      <table className="data-table" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Currency</th>
            <th>Notional</th>
            <th>Direction</th>
            <th>Spot Rate</th>
            <th>r (domestic)</th>
            <th>r (foreign)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {draft.map((p, i) => {
            const ir = draftRates.find((r) => r.currency === p.currency);
            const edited = isSpotEdited(p.currency);
            return (
              <tr key={i}>
                <td>
                  <select
                    value={p.currency}
                    onChange={(e) => {
                      const ccy = e.target.value;
                      updatePosition(i, "currency", ccy);
                      if (!draftSpots[ccy]) setDraftSpots((prev) => ({ ...prev, [ccy]: 1.0 }));
                      if (!draftRates.find((r) => r.currency === ccy)) {
                        setDraftRates((prev) => [...prev, { currency: ccy, domestic_rate: 0.05, foreign_rate: 0.03 }]);
                      }
                    }}
                    style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border)" }}
                  >
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    type="number" step={100000} value={p.notional}
                    onChange={(e) => updatePosition(i, "notional", +e.target.value)}
                    style={{ ...cellInputStyle, width: 120 }}
                  />
                </td>
                <td>
                  <select
                    value={p.direction}
                    onChange={(e) => updatePosition(i, "direction", e.target.value)}
                    style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid var(--border)" }}
                  >
                    <option value="long">Long</option>
                    <option value="short">Short</option>
                  </select>
                </td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number" step={0.001} value={draftSpots[p.currency] ?? 1.0}
                      onChange={(e) => updateSpot(p.currency, +e.target.value)}
                      style={{
                        ...cellInputStyle,
                        borderColor: edited ? "#d97706" : "var(--border)",
                        background: edited ? "#fffbeb" : "var(--card-bg)",
                      }}
                    />
                    {edited && (
                      <button
                        title={`Reset to ${spotSource![p.currency]}`}
                        onClick={() => resetSpot(p.currency)}
                        style={{ background: "none", border: "none", color: "#d97706", cursor: "pointer", fontSize: 13 }}
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <input
                    type="number" step={0.0025} value={ir?.domestic_rate ?? 0.05}
                    onChange={(e) => updateInterestRate(p.currency, "domestic_rate", +e.target.value)}
                    style={{ ...cellInputStyle, width: 80 }}
                  />
                </td>
                <td>
                  <input
                    type="number" step={0.0025} value={ir?.foreign_rate ?? 0.03}
                    onChange={(e) => updateInterestRate(p.currency, "foreign_rate", +e.target.value)}
                    style={{ ...cellInputStyle, width: 80 }}
                  />
                </td>
                <td>
                  {draft.length > 1 && (
                    <button
                      onClick={() => removePosition(i)}
                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 16, fontWeight: 700 }}
                    >
                      x
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={addPosition}
          style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--card-bg)", fontSize: 13, cursor: "pointer", color: "var(--text-h)" }}
        >
          + Add Position
        </button>
        <button className="apply-button" onClick={handleApply} disabled={loading}>
          {loading ? "Computing..." : "Recalculate"}
        </button>
        <span style={{ fontSize: 12, color: "var(--text)" }}>
          {activeCurrencies.length} currencies, {draft.length} positions
        </span>
      </div>
    </div>
  );
}
