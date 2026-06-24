import os

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.fx_engine import (
    compute_hedged_exposure,
    compute_net_exposure,
    generate_sample_portfolio,
    hedge_effectiveness_dollar_offset,
    hedge_effectiveness_regression,
)
from app.models import (
    ExposureRequest,
    ExposureResponse,
    ForwardHedgingRequest,
    ForwardHedgingResponse,
    FxVarRequest,
    FxVarResponse,
    HedgeEffectivenessRequest,
    HedgeEffectivenessResponse,
    SamplePortfolioResponse,
)
from app.var_engine import (
    compute_component_var,
    compute_correlation_matrix,
    compute_diversification_benefit,
    compute_portfolio_returns,
    compute_return_distribution,
    compute_var_surface,
)

CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(title="FX Exposure & Hedging Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Sample portfolio
# ---------------------------------------------------------------------------

@app.get("/api/sample-portfolio", response_model=SamplePortfolioResponse)
async def sample_portfolio(base_currency: str = "USD", n_days: int = 500):
    data = generate_sample_portfolio(base_currency, n_days)
    return SamplePortfolioResponse(**data)


# ---------------------------------------------------------------------------
# Exposure
# ---------------------------------------------------------------------------

@app.post("/api/exposure", response_model=ExposureResponse)
async def exposure(req: ExposureRequest) -> ExposureResponse:
    positions = [p.model_dump() for p in req.positions]
    result = compute_net_exposure(positions, req.spot_rates, req.base_currency)
    return ExposureResponse(**result)


# ---------------------------------------------------------------------------
# Forward hedging
# ---------------------------------------------------------------------------

@app.post("/api/forwards", response_model=ForwardHedgingResponse)
async def forwards(req: ForwardHedgingRequest) -> ForwardHedgingResponse:
    positions = [p.model_dump() for p in req.positions]
    interest_rates = [ir.model_dump() for ir in req.interest_rates]
    result = compute_hedged_exposure(
        positions, req.spot_rates, interest_rates,
        req.hedge_ratios, req.tenor_years, req.base_currency,
    )
    return ForwardHedgingResponse(**result)


# ---------------------------------------------------------------------------
# FX VaR
# ---------------------------------------------------------------------------

@app.post("/api/fx-var", response_model=FxVarResponse)
async def fx_var(req: FxVarRequest) -> FxVarResponse:
    surface = compute_var_surface(
        req.fx_returns, req.exposures, req.confidences, req.holding_periods,
    )
    currencies, corr = compute_correlation_matrix(req.fx_returns)
    contributions = compute_component_var(req.fx_returns, req.exposures)
    div_benefit = compute_diversification_benefit(req.fx_returns, req.exposures)
    port_returns = compute_portfolio_returns(req.fx_returns, req.exposures)
    distribution = compute_return_distribution(port_returns)

    return FxVarResponse(
        var_surface=surface,
        correlation_matrix=corr,
        currencies=currencies,
        var_contributions=contributions,
        diversification_benefit=div_benefit,
        portfolio_distribution=distribution,
    )


# ---------------------------------------------------------------------------
# Hedge effectiveness
# ---------------------------------------------------------------------------

@app.post("/api/hedge-effectiveness", response_model=HedgeEffectivenessResponse)
async def hedge_effectiveness(req: HedgeEffectivenessRequest) -> HedgeEffectivenessResponse:
    unhedged = np.array(req.unhedged_returns, dtype=float)
    hedged = np.array(req.hedged_returns, dtype=float)

    dollar_offset = hedge_effectiveness_dollar_offset(unhedged, hedged)
    regression = hedge_effectiveness_regression(unhedged, hedged)

    unhedged_dist = compute_return_distribution(unhedged)
    hedged_dist = compute_return_distribution(hedged)

    unhedged_vol = float(unhedged.std(ddof=1))
    hedged_vol = float(hedged.std(ddof=1))
    vol_reduction = (1 - hedged_vol / unhedged_vol) * 100 if unhedged_vol > 0 else 0.0

    return HedgeEffectivenessResponse(
        dollar_offset_ratio=dollar_offset,
        regression_r_squared=regression["r_squared"],
        regression_beta=regression["beta"],
        regression_intercept=regression["intercept"],
        unhedged_distribution=unhedged_dist,
        hedged_distribution=hedged_dist,
        unhedged_vol=unhedged_vol,
        hedged_vol=hedged_vol,
        vol_reduction_pct=vol_reduction,
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------

from mangum import Mangum

handler = Mangum(app)
