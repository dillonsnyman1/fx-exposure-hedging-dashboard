import type {
  ExposureResponse,
  ForwardHedgingResponse,
  FxPosition,
  FxVarResponse,
  HedgeEffectivenessResponse,
  InterestRatePair,
  SamplePortfolioResponse,
} from "../types/fx.ts";

const API_BASE: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(
      (payload as { detail?: string } | null)?.detail ??
        `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(
      (payload as { detail?: string } | null)?.detail ??
        `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export function fetchSamplePortfolio(
  baseCurrency: string = "USD",
  nDays: number = 500
): Promise<SamplePortfolioResponse> {
  return get<SamplePortfolioResponse>(
    `/api/sample-portfolio?base_currency=${baseCurrency}&n_days=${nDays}`
  );
}

export function computeExposure(
  positions: FxPosition[],
  spotRates: Record<string, number>,
  baseCurrency: string
): Promise<ExposureResponse> {
  return post<ExposureResponse>("/api/exposure", {
    positions,
    spot_rates: spotRates,
    base_currency: baseCurrency,
  });
}

export function computeForwards(
  positions: FxPosition[],
  spotRates: Record<string, number>,
  interestRates: InterestRatePair[],
  hedgeRatios: Record<string, number>,
  tenorYears: number,
  baseCurrency: string
): Promise<ForwardHedgingResponse> {
  return post<ForwardHedgingResponse>("/api/forwards", {
    positions,
    spot_rates: spotRates,
    interest_rates: interestRates,
    hedge_ratios: hedgeRatios,
    tenor_years: tenorYears,
    base_currency: baseCurrency,
  });
}

export function computeFxVar(
  exposures: Record<string, number>,
  fxReturns: Record<string, number[]>,
  confidences: number[] = [0.9, 0.95, 0.99],
  holdingPeriods: number[] = [1, 5, 10]
): Promise<FxVarResponse> {
  return post<FxVarResponse>("/api/fx-var", {
    exposures,
    fx_returns: fxReturns,
    confidences,
    holding_periods: holdingPeriods,
  });
}

export function computeHedgeEffectiveness(
  unhedgedReturns: number[],
  hedgedReturns: number[]
): Promise<HedgeEffectivenessResponse> {
  return post<HedgeEffectivenessResponse>("/api/hedge-effectiveness", {
    unhedged_returns: unhedgedReturns,
    hedged_returns: hedgedReturns,
  });
}
