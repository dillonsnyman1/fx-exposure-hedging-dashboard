from __future__ import annotations

import numpy as np
from scipy.stats import norm


def compute_return_distribution(returns: np.ndarray, n_bins: int = 50) -> dict:
    counts, bin_edges = np.histogram(returns, bins=n_bins)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    bin_width = bin_edges[1] - bin_edges[0]

    mu = returns.mean()
    sigma = returns.std(ddof=1)
    pdf_values = norm.pdf(bin_centers, mu, sigma) * len(returns) * bin_width

    return {
        "bin_edges": bin_edges.tolist(),
        "counts": counts.tolist(),
        "normal_pdf": pdf_values.tolist(),
    }


def var_historical(
    returns: np.ndarray, confidence: float, holding_period: int
) -> tuple[float, float]:
    var_1d = -np.percentile(returns, (1 - confidence) * 100)
    var_val = float(var_1d * np.sqrt(holding_period))

    threshold = np.percentile(returns, (1 - confidence) * 100)
    tail = returns[returns <= threshold]
    cvar_1d = -tail.mean() if len(tail) > 0 else -threshold
    cvar_val = float(cvar_1d * np.sqrt(holding_period))

    return var_val, cvar_val


def var_parametric(
    returns: np.ndarray, confidence: float, holding_period: int
) -> tuple[float, float]:
    mu = returns.mean()
    sigma = returns.std(ddof=1)
    z = norm.ppf(confidence)
    h = holding_period
    alpha = 1 - confidence

    var_val = float(-(mu * h - z * sigma * np.sqrt(h)))
    cvar_val = float(-(mu * h - sigma * np.sqrt(h) * norm.pdf(z) / alpha))

    return var_val, cvar_val


def _align_returns(currency_returns: dict[str, list[float]]) -> tuple[list[str], np.ndarray]:
    currencies = sorted(currency_returns.keys())
    min_len = min(len(currency_returns[c]) for c in currencies)
    aligned = np.column_stack([
        np.array(currency_returns[c][-min_len:], dtype=float)
        for c in currencies
    ])
    return currencies, aligned


def compute_portfolio_returns(
    currency_returns: dict[str, list[float]],
    exposures: dict[str, float],
) -> np.ndarray:
    currencies, aligned = _align_returns(currency_returns)
    total_abs = sum(abs(v) for v in exposures.values())
    if total_abs == 0:
        return np.zeros(aligned.shape[0])
    weights = np.array([exposures.get(c, 0.0) / total_abs for c in currencies])
    return aligned @ weights


def compute_correlation_matrix(currency_returns: dict[str, list[float]]) -> tuple[list[str], list[list[float]]]:
    currencies, aligned = _align_returns(currency_returns)
    corr = np.corrcoef(aligned, rowvar=False)
    return currencies, corr.tolist()


def compute_covariance_matrix(currency_returns: dict[str, list[float]]) -> tuple[list[str], np.ndarray]:
    currencies, aligned = _align_returns(currency_returns)
    cov = np.cov(aligned, rowvar=False, ddof=1)
    return currencies, np.atleast_2d(cov)


def compute_var_surface(
    currency_returns: dict[str, list[float]],
    exposures: dict[str, float],
    confidences: list[float],
    holding_periods: list[int],
) -> list[dict]:
    port_returns = compute_portfolio_returns(currency_returns, exposures)
    rows = []
    for conf in confidences:
        for hp in holding_periods:
            vh, cvh = var_historical(port_returns, conf, hp)
            vp, cvp = var_parametric(port_returns, conf, hp)
            rows.append({
                "confidence": conf,
                "holding_period": hp,
                "var_historical": vh,
                "cvar_historical": cvh,
                "var_parametric": vp,
                "cvar_parametric": cvp,
            })
    return rows


def compute_component_var(
    currency_returns: dict[str, list[float]],
    exposures: dict[str, float],
    confidence: float = 0.95,
) -> list[dict]:
    currencies, aligned = _align_returns(currency_returns)
    total_abs = sum(abs(v) for v in exposures.values())
    if total_abs == 0:
        return [{"currency": c, "standalone_var": 0.0, "component_var": 0.0,
                 "marginal_var": 0.0, "pct_contribution": 0.0} for c in currencies]

    weights = np.array([exposures.get(c, 0.0) / total_abs for c in currencies])
    port_returns = aligned @ weights

    mu_p = port_returns.mean()
    cov = np.cov(aligned, rowvar=False, ddof=1)
    cov = np.atleast_2d(cov)
    sigma_p = float(np.sqrt(weights @ cov @ weights))
    z = norm.ppf(confidence)

    port_var = -(mu_p - z * sigma_p)

    var_contributions = weights * (cov @ weights)
    pct_contributions = var_contributions / (sigma_p ** 2) if sigma_p > 0 else np.zeros_like(weights)
    component_vars = pct_contributions * port_var

    marginal_vars = (cov @ weights) / sigma_p * z if sigma_p > 0 else np.zeros_like(weights)

    result = []
    for i, c in enumerate(currencies):
        sv, _ = var_parametric(aligned[:, i], confidence, 1)
        result.append({
            "currency": c,
            "standalone_var": float(abs(weights[i]) * sv),
            "component_var": float(component_vars[i]),
            "marginal_var": float(marginal_vars[i]),
            "pct_contribution": float(pct_contributions[i]),
        })

    return result


def compute_diversification_benefit(
    currency_returns: dict[str, list[float]],
    exposures: dict[str, float],
    confidence: float = 0.95,
) -> float:
    components = compute_component_var(currency_returns, exposures, confidence)
    total_standalone = sum(c["standalone_var"] for c in components)
    total_component = sum(c["component_var"] for c in components)
    return total_standalone - total_component
