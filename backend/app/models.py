from enum import Enum

from pydantic import BaseModel, Field


class PositionDirection(str, Enum):
    long = "long"
    short = "short"


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class FxPosition(BaseModel):
    currency: str = Field(description="ISO currency code, e.g. EUR")
    notional: float = Field(gt=0, description="Notional amount in foreign currency")
    direction: PositionDirection = Field(default=PositionDirection.long)
    label: str = Field(default="")


class InterestRatePair(BaseModel):
    currency: str
    domestic_rate: float = Field(description="Base currency risk-free rate")
    foreign_rate: float = Field(description="Foreign currency risk-free rate")


class ReturnDistribution(BaseModel):
    bin_edges: list[float]
    counts: list[int]
    normal_pdf: list[float]


# ---------------------------------------------------------------------------
# Exposure
# ---------------------------------------------------------------------------

class ExposureRequest(BaseModel):
    positions: list[FxPosition] = Field(min_length=1)
    base_currency: str = Field(default="USD")
    spot_rates: dict[str, float] = Field(description="Spot rates: {CCY: rate_vs_base}")


class CurrencyExposure(BaseModel):
    currency: str
    gross_long: float
    gross_short: float
    net_exposure: float
    net_exposure_base: float
    pct_of_total: float


class ExposureResponse(BaseModel):
    base_currency: str
    currency_exposures: list[CurrencyExposure]
    total_gross_exposure: float
    total_net_exposure: float


# ---------------------------------------------------------------------------
# Forward hedging
# ---------------------------------------------------------------------------

class ForwardHedgingRequest(BaseModel):
    positions: list[FxPosition] = Field(min_length=1)
    base_currency: str = Field(default="USD")
    spot_rates: dict[str, float]
    interest_rates: list[InterestRatePair]
    hedge_ratios: dict[str, float] = Field(default_factory=dict)
    tenor_years: float = Field(default=0.25, gt=0, le=5.0)


class ForwardResult(BaseModel):
    currency: str
    spot_rate: float
    forward_rate: float
    forward_points: float
    hedge_ratio: float
    unhedged_exposure: float
    hedged_exposure: float
    hedge_cost: float


class ForwardHedgingResponse(BaseModel):
    forwards: list[ForwardResult]
    total_unhedged_exposure: float
    total_hedged_exposure: float
    total_hedge_cost: float


# ---------------------------------------------------------------------------
# FX VaR
# ---------------------------------------------------------------------------

class FxVarRequest(BaseModel):
    exposures: dict[str, float] = Field(description="{CCY: net_exposure_in_base}")
    fx_returns: dict[str, list[float]] = Field(description="{CCY: [daily log returns]}")
    confidences: list[float] = Field(default=[0.90, 0.95, 0.99])
    holding_periods: list[int] = Field(default=[1, 5, 10])


class FxVarResult(BaseModel):
    confidence: float
    holding_period: int
    var_historical: float
    cvar_historical: float
    var_parametric: float
    cvar_parametric: float


class VarContribution(BaseModel):
    currency: str
    standalone_var: float
    component_var: float
    marginal_var: float
    pct_contribution: float


class FxVarResponse(BaseModel):
    var_surface: list[FxVarResult]
    correlation_matrix: list[list[float]]
    currencies: list[str]
    var_contributions: list[VarContribution]
    diversification_benefit: float
    portfolio_distribution: ReturnDistribution


# ---------------------------------------------------------------------------
# Hedge effectiveness
# ---------------------------------------------------------------------------

class HedgeEffectivenessRequest(BaseModel):
    unhedged_returns: list[float]
    hedged_returns: list[float]


class HedgeEffectivenessResponse(BaseModel):
    dollar_offset_ratio: float
    regression_r_squared: float
    regression_beta: float
    regression_intercept: float
    unhedged_distribution: ReturnDistribution
    hedged_distribution: ReturnDistribution
    unhedged_vol: float
    hedged_vol: float
    vol_reduction_pct: float


# ---------------------------------------------------------------------------
# Sample portfolio
# ---------------------------------------------------------------------------

class SamplePortfolioResponse(BaseModel):
    positions: list[FxPosition]
    spot_rates: dict[str, float]
    interest_rates: list[InterestRatePair]
    fx_returns: dict[str, list[float]]
    dates: list[str]


# ---------------------------------------------------------------------------
# Live spot rates
# ---------------------------------------------------------------------------

class LiveRatesRequest(BaseModel):
    currencies: list[str] = Field(min_length=1)
    base_currency: str = Field(default="USD")


class LiveRatesResponse(BaseModel):
    spot_rates: dict[str, float]
    unavailable: list[str] = Field(default_factory=list)
