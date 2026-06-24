import numpy as np
import pytest

from app.var_engine import (
    compute_component_var,
    compute_correlation_matrix,
    compute_diversification_benefit,
    compute_portfolio_returns,
    compute_return_distribution,
    compute_var_surface,
    var_historical,
    var_parametric,
)


def _make_returns(seed=42, n_days=500):
    rng = np.random.default_rng(seed)
    currencies = ["EUR", "GBP", "JPY"]
    corr = np.array([[1.0, 0.6, 0.2], [0.6, 1.0, 0.1], [0.2, 0.1, 1.0]])
    vols = np.array([0.08, 0.09, 0.10]) / np.sqrt(252)
    D = np.diag(vols)
    cov = D @ corr @ D
    L = np.linalg.cholesky(cov)
    Z = rng.standard_normal((n_days, 3))
    raw = Z @ L.T
    return {c: raw[:, i].tolist() for i, c in enumerate(currencies)}


class TestHistoricalVar:
    def test_positive_var(self):
        returns = np.random.default_rng(42).normal(0, 0.01, 500)
        v, cv = var_historical(returns, 0.95, 1)
        assert v > 0

    def test_cvar_ge_var(self):
        returns = np.random.default_rng(42).normal(0, 0.01, 500)
        v, cv = var_historical(returns, 0.95, 1)
        assert cv >= v

    def test_monotonic_in_confidence(self):
        returns = np.random.default_rng(42).normal(0, 0.01, 500)
        v90, _ = var_historical(returns, 0.90, 1)
        v95, _ = var_historical(returns, 0.95, 1)
        v99, _ = var_historical(returns, 0.99, 1)
        assert v99 > v95 > v90


class TestParametricVar:
    def test_positive_var(self):
        returns = np.random.default_rng(42).normal(0, 0.01, 500)
        v, cv = var_parametric(returns, 0.95, 1)
        assert v > 0

    def test_cvar_ge_var(self):
        returns = np.random.default_rng(42).normal(0, 0.01, 500)
        v, cv = var_parametric(returns, 0.95, 1)
        assert cv >= v


class TestPortfolioReturns:
    def test_shape(self):
        fx = _make_returns()
        exposures = {"EUR": 10.0, "GBP": 5.0, "JPY": 3.0}
        pr = compute_portfolio_returns(fx, exposures)
        assert len(pr) == 500


class TestCorrelationMatrix:
    def test_diagonal_is_one(self):
        fx = _make_returns()
        currencies, corr = compute_correlation_matrix(fx)
        for i in range(len(currencies)):
            assert corr[i][i] == pytest.approx(1.0, abs=1e-10)

    def test_symmetric(self):
        fx = _make_returns()
        _, corr = compute_correlation_matrix(fx)
        n = len(corr)
        for i in range(n):
            for j in range(n):
                assert corr[i][j] == pytest.approx(corr[j][i], abs=1e-10)

    def test_values_in_range(self):
        fx = _make_returns()
        _, corr = compute_correlation_matrix(fx)
        for row in corr:
            for val in row:
                assert -1.0 <= val <= 1.0


class TestVarSurface:
    def test_correct_length(self):
        fx = _make_returns()
        exposures = {"EUR": 10.0, "GBP": 5.0, "JPY": 3.0}
        surface = compute_var_surface(fx, exposures, [0.90, 0.95, 0.99], [1, 5, 10])
        assert len(surface) == 9


class TestComponentVar:
    def test_components_sum_to_total(self):
        fx = _make_returns()
        exposures = {"EUR": 10.0, "GBP": 5.0, "JPY": 3.0}
        components = compute_component_var(fx, exposures, 0.95)
        total_component = sum(c["component_var"] for c in components)
        port_returns = compute_portfolio_returns(fx, exposures)
        total_var, _ = var_parametric(port_returns, 0.95, 1)
        assert total_component == pytest.approx(total_var, rel=0.01)

    def test_pct_contributions_sum_to_one(self):
        fx = _make_returns()
        exposures = {"EUR": 10.0, "GBP": 5.0, "JPY": 3.0}
        components = compute_component_var(fx, exposures, 0.95)
        total_pct = sum(c["pct_contribution"] for c in components)
        assert total_pct == pytest.approx(1.0, abs=0.01)


class TestDiversificationBenefit:
    def test_positive_benefit(self):
        fx = _make_returns()
        exposures = {"EUR": 10.0, "GBP": 5.0, "JPY": 3.0}
        benefit = compute_diversification_benefit(fx, exposures, 0.95)
        assert benefit > 0


class TestReturnDistribution:
    def test_bin_count(self):
        returns = np.random.default_rng(42).normal(0, 0.01, 500)
        dist = compute_return_distribution(returns, n_bins=30)
        assert len(dist["counts"]) == 30
        assert len(dist["bin_edges"]) == 31
        assert len(dist["normal_pdf"]) == 30
