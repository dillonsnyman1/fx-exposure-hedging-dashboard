# FX Exposure & Hedging Dashboard

[![CI/CD](https://github.com/dillonsnyman1/fx-exposure-hedging-dashboard/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/dillonsnyman1/fx-exposure-hedging-dashboard/actions/workflows/ci-cd.yml)

A full-stack demo that calculates FX portfolio exposure, models forward
hedging via covered interest rate parity, computes currency-level VaR,
and measures hedging effectiveness.

- **Backend**: Python + FastAPI for the FX risk engine
- **Frontend**: React + Vite + TypeScript dashboard (exposure breakdown,
  forward hedging, FX VaR, hedge effectiveness)

> **Live demo**: [d1165825icva9n.cloudfront.net](https://d1165825icva9n.cloudfront.net) - load the sample portfolio, adjust hedge ratios and tenors, explore the VaR surface across confidence levels and holding periods, and check hedge effectiveness metrics.
>
> The backend is fully stateless: all risk calculations are done in-request with no database or storage of any kind.

> **Disclaimer**: Simplified demo built for portfolio purposes. Not a
> production risk system and should not be used for regulatory reporting or
> live risk management. All data is synthetic.

---

## Background

Foreign exchange risk arises whenever a portfolio holds assets or
liabilities denominated in currencies other than the base (reporting)
currency. A UK-based fund holding USD-denominated bonds, or a European
corporate with JPY payables, faces potential losses from adverse
currency movements even if the underlying positions are otherwise
sound.

Treasury and ALM teams manage this risk through a combination of
exposure monitoring, forward hedging, and portfolio-level VaR analysis.
This tool covers the core workflow:

1. **Exposure aggregation** - consolidate positions across currencies
   into a single view of gross and net exposure against a base currency.

2. **Forward hedging** - model the cost and effect of locking in future
   exchange rates using FX forwards, priced via covered interest rate
   parity.

3. **FX portfolio VaR** - quantify the potential loss on the
   multi-currency portfolio using historical simulation and
   variance-covariance methods, with risk decomposition showing each
   currency's contribution to total risk.

4. **Hedge effectiveness** - assess whether the hedging strategy is
   working, using both the dollar-offset method (IAS 39 / IFRS 9) and
   regression-based analysis.

---

## Methodology

### 1. Net Exposure Calculation

Positions are aggregated by currency. Each position has a notional
amount, direction (long/short), and is converted to the base currency
using the prevailing spot rate:

```
Exposure_base(CCY) = Net_notional(CCY) * Spot(CCY/BASE)
```

Gross exposure sums absolute values across all currencies. Net exposure
reflects the directional total after offsetting long and short positions
within each currency.

### 2. Forward Rate Pricing (Covered Interest Rate Parity)

FX forward rates are derived from the spot rate and the interest rate
differential between the two currencies. Under continuous compounding:

```
F = S * exp((r_d - r_f) * T)
```

where S is the spot rate, r_d is the domestic (base currency) risk-free
rate, r_f is the foreign currency rate, and T is the tenor in years.
Forward points are the difference F - S.

A hedge ratio of h means h% of the net exposure in each currency is
locked at the forward rate, with the remainder left unhedged at the
current spot rate. The hedge cost is the notional hedged multiplied by
the forward points.

### 3. FX Portfolio VaR

Two methods are computed side-by-side:

**Historical Simulation**

```
VaR(alpha) = -Percentile(portfolio_returns, 1 - alpha)
CVaR(alpha) = -Mean(returns where return <= -VaR)
```

Portfolio returns are the exposure-weighted sum of individual currency
log returns. Multi-day VaR is scaled by the square-root-of-time rule.

**Variance-Covariance (Parametric)**

```
sigma_p = sqrt(w' * Sigma * w)
VaR(alpha) = -(mu * h - z_alpha * sigma_p * sqrt(h))
CVaR(alpha) = -(mu * h - sigma_p * sqrt(h) * phi(z_alpha) / (1 - alpha))
```

where w is the vector of currency weights, Sigma is the covariance
matrix, z_alpha is the standard normal quantile, and phi is the standard
normal PDF.

**Risk Decomposition**

Component VaR breaks the total portfolio VaR into per-currency
contributions that sum to the total. Each currency's component is
proportional to its marginal contribution to portfolio variance:

```
ComponentVaR_i = w_i * (Sigma * w)_i / sigma_p^2 * PortfolioVaR
```

The diversification benefit is the difference between the sum of
standalone VaRs and the portfolio VaR - it quantifies how much risk is
reduced by holding a diversified basket of currency exposures.

### 4. Hedge Effectiveness

**Dollar-Offset Method**

The ratio of cumulative hedge P&L to cumulative exposure P&L. Under IAS
39, a hedge is considered effective if this ratio falls between -0.80
and -1.25:

```
Dollar-offset = -Sum(hedge_changes) / Sum(exposure_changes)
```

A perfect hedge yields a ratio of -1.0 (hedge gains exactly offset
exposure losses).

**Regression Method**

OLS regression of hedge instrument changes against hedged item changes.
An effective hedge has R-squared close to 1.0 and a slope (beta) close
to -1.0.

### 5. Synthetic Data Generation

The sample portfolio endpoint generates a six-currency portfolio with
500 days of correlated daily FX log returns. The correlation structure
is generated using Cholesky decomposition of a preset correlation
matrix calibrated to realistic major-pair relationships (e.g.
EUR-CHF ~0.80, AUD-CAD ~0.50, JPY-CHF ~0.40 as safe havens). Daily
volatilities are calibrated to annualised levels of 7.5-11% depending
on the pair.

### 6. Live Spot Rates

Spot rates can be pulled from Yahoo Finance for any currency in the
portfolio. Currencies quoted directly against USD (EUR, GBP, AUD, NZD)
use the `CCYUSD=X` ticker; currencies quoted as USD per unit of foreign
currency (JPY, CHF, CAD, SEK, NOK, SGD) use `USDCCY=X` and the rate is
inverted so all spot rates are expressed as USD per unit of foreign
currency. Interest rates remain manual inputs, since there is no single
reliable source for short-term risk-free rates across currencies.

---

## Roadmap

### Phase 1: Backend engine and API *(complete)*

FastAPI backend with FX exposure, forward hedging, FX VaR, hedge
effectiveness, and synthetic data generation. All endpoints tested
with 32 passing pytest tests. See [`backend/`](backend/).

### Phase 2: Full-stack local demo *(complete)*

React + Vite + TypeScript dashboard with four tabs: Exposure (summary
cards, exposure bar chart), Hedging (interactive forward rate table
with hedge ratio and tenor controls), VaR Analysis (correlation
heatmap, component VaR chart, VaR surface table, confidence/holding
period selectors), and Hedge Effectiveness (dollar-offset and
regression metrics, overlaid hedged vs unhedged return distributions).

The portfolio builder at the top of every tab supports adding, editing
and removing positions, with a "Fetch Live Spot Rates" button that
pulls real-time FX rates from Yahoo Finance for every currency in the
portfolio. Manually edited spot rates are highlighted with a one-click
reset back to the fetched value, and a freshness timer flags rates as
stale after 60 seconds - the same pattern used in the
[options pricer dashboard](https://github.com/dillonsnyman1/options-pricer-dashboard)'s
ticker lookup. See [`frontend/`](frontend/).

### Phase 3: AWS deployment *(complete)*

Terraform infrastructure (Lambda, API Gateway, S3, CloudFront) and a
GitHub Actions CI/CD pipeline. See [`infra/`](infra/).

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sample-portfolio` | Demo portfolio with synthetic correlated FX data |
| POST | `/api/exposure` | Net exposure per currency vs base currency |
| POST | `/api/forwards` | Forward rates and hedged vs unhedged exposure |
| POST | `/api/fx-var` | Portfolio VaR surface, VaR contributions, correlation matrix |
| POST | `/api/hedge-effectiveness` | Dollar-offset ratio, regression R-squared, P&L distributions |
| POST | `/api/live-rates` | Live FX spot rates from Yahoo Finance for a list of currencies |
| GET | `/api/health` | Health check |

---

## Known limitations and possible extensions

- **No live interest rates.** Spot rates can be fetched live from
  Yahoo Finance, but interest rates remain manual inputs - there is no
  single reliable source for short-term risk-free rates across
  currencies. A future extension could pull government bond yields as
  a proxy.

- **Linear hedging only.** Only FX forwards are modelled. Options-based
  hedging strategies (protective puts, collars) would provide a richer
  set of hedging alternatives.

- **Square-root-of-time scaling.** Multi-day VaR uses the sqrt(t) rule,
  which assumes i.i.d. returns. This breaks down for longer horizons.

- **No cross-currency basis.** Forward rates are derived from covered
  interest rate parity without accounting for the cross-currency basis
  spread, which can be material for certain pairs.

- **Simplified hedge effectiveness.** The dollar-offset and regression
  methods are the standard IAS 39 tests. IFRS 9 allows a broader
  qualitative assessment that is not modelled here.

---

## Running locally

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Tests**
```bash
cd backend
source .venv/bin/activate
pytest
```

---

## Infrastructure

FastAPI on AWS Lambda (arm64) behind API Gateway, with the frontend on
S3 + CloudFront. Deployed via Terraform on every push to `main`. See
[`infra/`](infra/).
