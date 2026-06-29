from __future__ import annotations

import numpy as np
from scipy.stats import linregress

# Currencies quoted directly against USD as CCY/USD (e.g. EURUSD=X)
DIRECT_QUOTE_CURRENCIES = {"EUR", "GBP", "AUD", "NZD"}
# Currencies quoted as USD/CCY (e.g. USDJPY=X) - spot must be inverted
INVERTED_QUOTE_CURRENCIES = {"JPY", "CHF", "CAD", "SEK", "NOK", "SGD", "MXN", "ZAR"}


def fetch_live_spot_rates(currencies: list[str], base_currency: str = "USD") -> dict:
    import yfinance as yf  # lazy import - heavy, only needed for this endpoint

    spot_rates: dict[str, float] = {}
    unavailable: list[str] = []

    for ccy in currencies:
        if ccy == base_currency:
            spot_rates[ccy] = 1.0
            continue

        if ccy in DIRECT_QUOTE_CURRENCIES:
            ticker_symbol = f"{ccy}{base_currency}=X"
            invert = False
        else:
            ticker_symbol = f"{base_currency}{ccy}=X"
            invert = True

        try:
            tk = yf.Ticker(ticker_symbol)
            hist = tk.history(period="1d")
            if hist.empty:
                unavailable.append(ccy)
                continue
            rate = float(hist["Close"].iloc[-1])
            spot_rates[ccy] = (1.0 / rate) if invert else rate
        except Exception:
            unavailable.append(ccy)

    return {"spot_rates": spot_rates, "unavailable": unavailable}


def compute_forward_rate(
    spot: float, r_domestic: float, r_foreign: float, tenor: float
) -> tuple[float, float]:
    forward = spot * np.exp((r_domestic - r_foreign) * tenor)
    forward_points = forward - spot
    return float(forward), float(forward_points)


def compute_net_exposure(
    positions: list[dict], spot_rates: dict[str, float], base_currency: str
) -> dict:
    currency_map: dict[str, dict] = {}

    for pos in positions:
        ccy = pos["currency"]
        notional = pos["notional"]
        direction = 1.0 if pos["direction"] == "long" else -1.0
        signed = notional * direction

        if ccy not in currency_map:
            currency_map[ccy] = {"gross_long": 0.0, "gross_short": 0.0, "net": 0.0}

        if direction > 0:
            currency_map[ccy]["gross_long"] += notional
        else:
            currency_map[ccy]["gross_short"] += notional
        currency_map[ccy]["net"] += signed

    exposures = []
    total_gross = 0.0
    total_net = 0.0

    for ccy, vals in currency_map.items():
        rate = spot_rates.get(ccy, 1.0)
        net_base = vals["net"] * rate
        gross_long_base = vals["gross_long"] * rate
        gross_short_base = vals["gross_short"] * rate

        exposures.append({
            "currency": ccy,
            "gross_long": gross_long_base,
            "gross_short": gross_short_base,
            "net_exposure": vals["net"],
            "net_exposure_base": net_base,
            "pct_of_total": 0.0,
        })
        total_gross += gross_long_base + gross_short_base
        total_net += abs(net_base)

    for exp in exposures:
        if total_net > 0:
            exp["pct_of_total"] = abs(exp["net_exposure_base"]) / total_net

    return {
        "base_currency": base_currency,
        "currency_exposures": exposures,
        "total_gross_exposure": total_gross,
        "total_net_exposure": total_net,
    }


def compute_hedged_exposure(
    positions: list[dict],
    spot_rates: dict[str, float],
    interest_rates: list[dict],
    hedge_ratios: dict[str, float],
    tenor_years: float,
    base_currency: str,
) -> dict:
    rate_map = {ir["currency"]: ir for ir in interest_rates}

    exposure = compute_net_exposure(positions, spot_rates, base_currency)

    forwards = []
    total_unhedged = 0.0
    total_hedged = 0.0
    total_hedge_cost = 0.0

    for exp in exposure["currency_exposures"]:
        ccy = exp["currency"]
        spot = spot_rates.get(ccy, 1.0)
        net_base = exp["net_exposure_base"]
        hedge_ratio = hedge_ratios.get(ccy, 0.0)

        ir = rate_map.get(ccy, {"domestic_rate": 0.0, "foreign_rate": 0.0})
        r_d = ir["domestic_rate"]
        r_f = ir["foreign_rate"]

        fwd_rate, fwd_points = compute_forward_rate(spot, r_d, r_f, tenor_years)

        hedged_notional = exp["net_exposure"] * hedge_ratio
        unhedged_notional = exp["net_exposure"] - hedged_notional

        hedged_base = hedged_notional * fwd_rate
        unhedged_base = unhedged_notional * spot
        hedge_cost = hedged_notional * fwd_points

        total_unhedged += abs(net_base)
        total_hedged += abs(hedged_base + unhedged_base)
        total_hedge_cost += hedge_cost

        forwards.append({
            "currency": ccy,
            "spot_rate": spot,
            "forward_rate": fwd_rate,
            "forward_points": fwd_points,
            "hedge_ratio": hedge_ratio,
            "unhedged_exposure": float(unhedged_base),
            "hedged_exposure": float(hedged_base),
            "hedge_cost": float(hedge_cost),
        })

    return {
        "forwards": forwards,
        "total_unhedged_exposure": total_unhedged,
        "total_hedged_exposure": total_hedged,
        "total_hedge_cost": total_hedge_cost,
    }


def hedge_effectiveness_dollar_offset(
    unhedged_returns: np.ndarray, hedged_returns: np.ndarray
) -> float:
    diff_unhedged = np.diff(unhedged_returns)
    diff_hedged = np.diff(hedged_returns)

    cum_unhedged = np.sum(diff_unhedged)
    cum_hedge = np.sum(diff_hedged) - np.sum(diff_unhedged)

    if abs(cum_unhedged) < 1e-12:
        return 0.0

    return float(-cum_hedge / cum_unhedged)


def hedge_effectiveness_regression(
    unhedged_returns: np.ndarray, hedged_returns: np.ndarray
) -> dict:
    hedge_changes = np.diff(hedged_returns) - np.diff(unhedged_returns)
    exposure_changes = np.diff(unhedged_returns)

    if len(exposure_changes) < 3:
        return {"r_squared": 0.0, "beta": 0.0, "intercept": 0.0}

    result = linregress(exposure_changes, -hedge_changes)
    return {
        "r_squared": float(result.rvalue ** 2),
        "beta": float(result.slope),
        "intercept": float(result.intercept),
    }


def generate_sample_portfolio(
    base_currency: str = "USD", n_days: int = 500, seed: int = 42
) -> dict:
    rng = np.random.default_rng(seed)

    positions = [
        {"currency": "EUR", "notional": 10_000_000, "direction": "long", "label": "EUR Receivables"},
        {"currency": "GBP", "notional": 5_000_000, "direction": "short", "label": "GBP Payables"},
        {"currency": "JPY", "notional": 800_000_000, "direction": "long", "label": "JPY Bond Holdings"},
        {"currency": "CHF", "notional": 3_000_000, "direction": "long", "label": "CHF Deposits"},
        {"currency": "AUD", "notional": 7_000_000, "direction": "short", "label": "AUD Payables"},
        {"currency": "CAD", "notional": 4_000_000, "direction": "long", "label": "CAD Receivables"},
    ]

    spot_rates = {
        "EUR": 1.0900,
        "GBP": 1.2700,
        "JPY": 1.0 / 155.0,
        "CHF": 1.0 / 0.88,
        "AUD": 0.6600,
        "CAD": 1.0 / 1.36,
    }

    interest_rates = [
        {"currency": "EUR", "domestic_rate": 0.0525, "foreign_rate": 0.0425},
        {"currency": "GBP", "domestic_rate": 0.0525, "foreign_rate": 0.0500},
        {"currency": "JPY", "domestic_rate": 0.0525, "foreign_rate": 0.0010},
        {"currency": "CHF", "domestic_rate": 0.0525, "foreign_rate": 0.0175},
        {"currency": "AUD", "domestic_rate": 0.0525, "foreign_rate": 0.0435},
        {"currency": "CAD", "domestic_rate": 0.0525, "foreign_rate": 0.0450},
    ]

    currencies = ["EUR", "GBP", "JPY", "CHF", "AUD", "CAD"]

    annual_vols = {
        "EUR": 0.080, "GBP": 0.090, "JPY": 0.100,
        "CHF": 0.075, "AUD": 0.110, "CAD": 0.085,
    }

    correlation = np.array([
        [1.00, 0.60, 0.15, 0.80, 0.30, 0.25],  # EUR
        [0.60, 1.00, 0.10, 0.55, 0.35, 0.30],  # GBP
        [0.15, 0.10, 1.00, 0.40, 0.05, 0.05],  # JPY
        [0.80, 0.55, 0.40, 1.00, 0.20, 0.15],  # CHF
        [0.30, 0.35, 0.05, 0.20, 1.00, 0.50],  # AUD
        [0.25, 0.30, 0.05, 0.15, 0.50, 1.00],  # CAD
    ])

    daily_vols = np.array([annual_vols[c] / np.sqrt(252) for c in currencies])
    D = np.diag(daily_vols)
    cov = D @ correlation @ D

    L = np.linalg.cholesky(cov)
    Z = rng.standard_normal((n_days, len(currencies)))
    returns = Z @ L.T

    fx_returns = {}
    dates = []
    base_date = np.datetime64("2024-01-02")
    for i in range(n_days):
        dates.append(str(base_date + np.timedelta64(i, "D")))

    for j, ccy in enumerate(currencies):
        fx_returns[ccy] = returns[:, j].tolist()

    return {
        "positions": positions,
        "spot_rates": spot_rates,
        "interest_rates": interest_rates,
        "fx_returns": fx_returns,
        "dates": dates,
    }
