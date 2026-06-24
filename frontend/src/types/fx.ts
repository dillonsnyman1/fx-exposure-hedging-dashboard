export type PositionDirection = "long" | "short";

export interface FxPosition {
  currency: string;
  notional: number;
  direction: PositionDirection;
  label: string;
}

export interface InterestRatePair {
  currency: string;
  domestic_rate: number;
  foreign_rate: number;
}

export interface CurrencyExposure {
  currency: string;
  gross_long: number;
  gross_short: number;
  net_exposure: number;
  net_exposure_base: number;
  pct_of_total: number;
}

export interface ExposureResponse {
  base_currency: string;
  currency_exposures: CurrencyExposure[];
  total_gross_exposure: number;
  total_net_exposure: number;
}

export interface ForwardResult {
  currency: string;
  spot_rate: number;
  forward_rate: number;
  forward_points: number;
  hedge_ratio: number;
  unhedged_exposure: number;
  hedged_exposure: number;
  hedge_cost: number;
}

export interface ForwardHedgingResponse {
  forwards: ForwardResult[];
  total_unhedged_exposure: number;
  total_hedged_exposure: number;
  total_hedge_cost: number;
}

export interface FxVarResult {
  confidence: number;
  holding_period: number;
  var_historical: number;
  cvar_historical: number;
  var_parametric: number;
  cvar_parametric: number;
}

export interface VarContribution {
  currency: string;
  standalone_var: number;
  component_var: number;
  marginal_var: number;
  pct_contribution: number;
}

export interface ReturnDistribution {
  bin_edges: number[];
  counts: number[];
  normal_pdf: number[];
}

export interface FxVarResponse {
  var_surface: FxVarResult[];
  correlation_matrix: number[][];
  currencies: string[];
  var_contributions: VarContribution[];
  diversification_benefit: number;
  portfolio_distribution: ReturnDistribution;
}

export interface HedgeEffectivenessResponse {
  dollar_offset_ratio: number;
  regression_r_squared: number;
  regression_beta: number;
  regression_intercept: number;
  unhedged_distribution: ReturnDistribution;
  hedged_distribution: ReturnDistribution;
  unhedged_vol: number;
  hedged_vol: number;
  vol_reduction_pct: number;
}

export interface SamplePortfolioResponse {
  positions: FxPosition[];
  spot_rates: Record<string, number>;
  interest_rates: InterestRatePair[];
  fx_returns: Record<string, number[]>;
  dates: string[];
}

export const CURRENCY_COLORS: Record<string, string> = {
  EUR: "#2563eb",
  GBP: "#7c3aed",
  JPY: "#0891b2",
  CHF: "#059669",
  AUD: "#d97706",
  CAD: "#dc2626",
};

export const DEFAULT_BASE_CURRENCY = "USD";
