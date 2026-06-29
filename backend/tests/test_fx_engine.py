import numpy as np
import pytest

from app.fx_engine import (
    compute_forward_rate,
    compute_hedged_exposure,
    compute_net_exposure,
    fetch_live_spot_rates,
    generate_sample_portfolio,
    hedge_effectiveness_dollar_offset,
    hedge_effectiveness_regression,
)


class TestForwardRate:
    def test_zero_rate_differential_returns_spot(self):
        fwd, pts = compute_forward_rate(1.09, 0.05, 0.05, 0.25)
        assert fwd == pytest.approx(1.09, abs=1e-10)
        assert pts == pytest.approx(0.0, abs=1e-10)

    def test_forward_above_spot_when_rd_gt_rf(self):
        fwd, pts = compute_forward_rate(1.09, 0.05, 0.03, 0.25)
        assert fwd > 1.09
        assert pts > 0

    def test_forward_below_spot_when_rd_lt_rf(self):
        fwd, pts = compute_forward_rate(1.09, 0.03, 0.05, 0.25)
        assert fwd < 1.09
        assert pts < 0

    def test_known_textbook_value(self):
        fwd, _ = compute_forward_rate(1.09, 0.0525, 0.0425, 0.25)
        expected = 1.09 * np.exp((0.0525 - 0.0425) * 0.25)
        assert fwd == pytest.approx(expected, rel=1e-10)

    def test_longer_tenor_amplifies_differential(self):
        fwd_short, _ = compute_forward_rate(1.09, 0.05, 0.03, 0.25)
        fwd_long, _ = compute_forward_rate(1.09, 0.05, 0.03, 1.0)
        assert abs(fwd_long - 1.09) > abs(fwd_short - 1.09)


class TestNetExposure:
    def test_single_long_position(self):
        positions = [{"currency": "EUR", "notional": 1_000_000, "direction": "long", "label": ""}]
        spot_rates = {"EUR": 1.10}
        result = compute_net_exposure(positions, spot_rates, "USD")
        assert len(result["currency_exposures"]) == 1
        assert result["currency_exposures"][0]["net_exposure_base"] == pytest.approx(1_100_000)

    def test_opposing_positions_net_correctly(self):
        positions = [
            {"currency": "EUR", "notional": 10_000_000, "direction": "long", "label": ""},
            {"currency": "EUR", "notional": 4_000_000, "direction": "short", "label": ""},
        ]
        spot_rates = {"EUR": 1.10}
        result = compute_net_exposure(positions, spot_rates, "USD")
        assert len(result["currency_exposures"]) == 1
        assert result["currency_exposures"][0]["net_exposure"] == pytest.approx(6_000_000)
        assert result["currency_exposures"][0]["net_exposure_base"] == pytest.approx(6_600_000)

    def test_multiple_currencies(self):
        positions = [
            {"currency": "EUR", "notional": 1_000_000, "direction": "long", "label": ""},
            {"currency": "GBP", "notional": 500_000, "direction": "short", "label": ""},
        ]
        spot_rates = {"EUR": 1.10, "GBP": 1.27}
        result = compute_net_exposure(positions, spot_rates, "USD")
        assert len(result["currency_exposures"]) == 2
        assert result["total_gross_exposure"] == pytest.approx(1_100_000 + 635_000)


class TestHedgedExposure:
    def _make_inputs(self):
        positions = [{"currency": "EUR", "notional": 10_000_000, "direction": "long", "label": ""}]
        spot_rates = {"EUR": 1.09}
        interest_rates = [{"currency": "EUR", "domestic_rate": 0.05, "foreign_rate": 0.04}]
        return positions, spot_rates, interest_rates

    def test_zero_hedge_leaves_exposure_unchanged(self):
        positions, spot_rates, interest_rates = self._make_inputs()
        result = compute_hedged_exposure(
            positions, spot_rates, interest_rates, {"EUR": 0.0}, 0.25, "USD"
        )
        assert result["forwards"][0]["hedge_ratio"] == 0.0
        assert result["forwards"][0]["unhedged_exposure"] == pytest.approx(10_000_000 * 1.09)

    def test_full_hedge_uses_forward_rate(self):
        positions, spot_rates, interest_rates = self._make_inputs()
        result = compute_hedged_exposure(
            positions, spot_rates, interest_rates, {"EUR": 1.0}, 0.25, "USD"
        )
        fwd = result["forwards"][0]["forward_rate"]
        assert result["forwards"][0]["hedged_exposure"] == pytest.approx(10_000_000 * fwd)
        assert result["forwards"][0]["unhedged_exposure"] == pytest.approx(0.0)

    def test_half_hedge(self):
        positions, spot_rates, interest_rates = self._make_inputs()
        result = compute_hedged_exposure(
            positions, spot_rates, interest_rates, {"EUR": 0.5}, 0.25, "USD"
        )
        assert result["forwards"][0]["hedge_ratio"] == 0.5


class TestHedgeEffectiveness:
    def test_perfect_hedge_dollar_offset(self):
        rng = np.random.default_rng(42)
        unhedged = np.cumsum(rng.normal(0, 0.01, 100))
        hedged = np.zeros_like(unhedged)
        ratio = hedge_effectiveness_dollar_offset(unhedged, hedged)
        assert ratio == pytest.approx(1.0, abs=0.01)

    def test_no_hedge_dollar_offset(self):
        rng = np.random.default_rng(42)
        unhedged = np.cumsum(rng.normal(0, 0.01, 100))
        ratio = hedge_effectiveness_dollar_offset(unhedged, unhedged)
        assert ratio == pytest.approx(0.0, abs=0.01)

    def test_perfect_hedge_regression(self):
        rng = np.random.default_rng(42)
        unhedged = np.cumsum(rng.normal(0, 0.01, 100))
        hedged = np.zeros_like(unhedged)
        result = hedge_effectiveness_regression(unhedged, hedged)
        assert result["r_squared"] > 0.99

    def test_uncorrelated_regression(self):
        rng = np.random.default_rng(42)
        unhedged = rng.normal(0, 0.01, 500)
        hedged = rng.normal(0, 0.01, 500)
        result = hedge_effectiveness_regression(
            np.cumsum(unhedged), np.cumsum(unhedged) + np.cumsum(hedged)
        )
        assert result["r_squared"] < 0.5


class TestSamplePortfolio:
    def test_deterministic_with_seed(self):
        p1 = generate_sample_portfolio(seed=42)
        p2 = generate_sample_portfolio(seed=42)
        assert p1["fx_returns"]["EUR"] == p2["fx_returns"]["EUR"]

    def test_correct_number_of_currencies(self):
        p = generate_sample_portfolio()
        assert len(p["fx_returns"]) == 6
        assert len(p["positions"]) == 6
        assert len(p["interest_rates"]) == 6

    def test_correct_number_of_days(self):
        p = generate_sample_portfolio(n_days=250)
        for ccy in p["fx_returns"]:
            assert len(p["fx_returns"][ccy]) == 250
        assert len(p["dates"]) == 250


class _FakeTicker:
    def __init__(self, symbol, price):
        self.symbol = symbol
        self._price = price

    def history(self, period="1d"):
        import pandas as pd
        if self._price is None:
            return pd.DataFrame()
        return pd.DataFrame({"Close": [self._price]})


class TestFetchLiveSpotRates:
    def test_base_currency_returns_one(self):
        result = fetch_live_spot_rates(["USD"], "USD")
        assert result["spot_rates"]["USD"] == 1.0
        assert result["unavailable"] == []

    def test_direct_quote_currency(self, monkeypatch):
        import app.fx_engine as fx_engine

        def fake_ticker(symbol):
            assert symbol == "EURUSD=X"
            return _FakeTicker(symbol, 1.09)

        monkeypatch.setattr("yfinance.Ticker", fake_ticker)
        result = fetch_live_spot_rates(["EUR"], "USD")
        assert result["spot_rates"]["EUR"] == pytest.approx(1.09)
        assert result["unavailable"] == []

    def test_inverted_quote_currency(self, monkeypatch):
        def fake_ticker(symbol):
            assert symbol == "USDJPY=X"
            return _FakeTicker(symbol, 155.0)

        monkeypatch.setattr("yfinance.Ticker", fake_ticker)
        result = fetch_live_spot_rates(["JPY"], "USD")
        assert result["spot_rates"]["JPY"] == pytest.approx(1 / 155.0)

    def test_unavailable_currency(self, monkeypatch):
        def fake_ticker(symbol):
            return _FakeTicker(symbol, None)

        monkeypatch.setattr("yfinance.Ticker", fake_ticker)
        result = fetch_live_spot_rates(["EUR"], "USD")
        assert result["unavailable"] == ["EUR"]
        assert "EUR" not in result["spot_rates"]
