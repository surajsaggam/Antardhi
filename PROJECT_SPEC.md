# Antardhi — Project Specification

**Status:** Source of truth for all contributors (human + AI agents).
**Rule:** No agent changes a function signature defined in Section 13 without updating this file first and flagging the change in its PR/commit message.

---

## 1. Vision & Philosophy

TVS Credit e.p.i.c 8 — Problem Statement (d): *Alternative Data Credit Engine for the Invisible Customer.*

Core philosophy (use this line everywhere — pitch deck, README, code comments):
> "Don't ask if the customer has a credit history. Ask what their financial behavior already proves."

Target personas: first-time borrowers, gig workers, small merchants, informal-sector workers — people with thin or no bureau file, concentrated in Tier 3/4 towns.

---

## 2. System Overview

```
CONSENT → DATA INTEGRATION → FEATURE ENGINEERING → SEGMENTATION (persona)
        → [BASELINE SCORECARD (WOE+LogReg)]  +  [CHALLENGER MODEL (LightGBM)]
        → CONFIDENCE SCORE (separate)   → ANOMALY/FRAUD FLAG (separate)
        → SHAP EXPLAINABILITY → REASON CODES
        → CREDIT DECISION + LOAN RECOMMENDATION
        → PATH-TO-ELIGIBILITY (what-if simulator)
```

**Critical design rule:** Credit Score, Confidence Score, and Anomaly Flag are THREE SEPARATE OUTPUTS. Never blend fraud/anomaly signal into the creditworthiness score — they answer different questions and should never be a single hybrid number.

---

## 3. Repository Structure

```
antardhi/
├── assets/
├── data/
│   └── synthetic_credit_data.csv
├── notebooks/
│   ├── 01_exploratory_analysis.ipynb
│   └── 02_model_benchmarking.ipynb
├── src/
│   ├── config.py
│   ├── data/
│   │   ├── synthetic_generator.py
│   │   └── preprocessor.py
│   ├── features/
│   │   └── feature_engineering.py
│   ├── models/
│   │   ├── train.py
│   │   ├── evaluate.py
│   │   ├── confidence.py
│   │   └── anomaly.py
│   ├── explainability/
│   │   ├── shap_explainer.py
│   │   └── reason_codes.py
│   ├── simulation/
│   │   └── what_if.py
│   └── utils/
│       └── helpers.py
├── tests/
│   ├── test_feature_engineering.py
│   └── test_model_inference.py
├── app.py
├── requirements.txt
├── setup.py
├── AGENTS.md
├── PROJECT_SPEC.md
└── README.md
```

---

## 4. Personas

| Persona | Available sources | Missing sources |
|---|---|---|
| Small Merchant | GST, UPI, E-commerce, Utility | Mobility (weak), Telecom (weak) |
| Gig Worker | UPI, Mobility, Telecom | GST (absent), E-commerce (weak) |
| First-time Borrower (salaried, thin file) | UPI, Utility, thin bureau flag | GST (absent), Mobility (weak) |
| Informal/Rural Worker | UPI, Utility, Telecom | GST (absent), E-commerce (absent) |

Each persona should be ~25% of the synthetic dataset, with deliberate missingness matching the table above (this is what makes the Confidence Score meaningful — don't fabricate data the persona wouldn't realistically have).

---

## 5. Data Specification

### 5.1 Schema (synthetic_credit_data.csv)

| Column | Type | Notes |
|---|---|---|
| customer_id | str | UUID |
| persona | str | one of 4 above |
| upi_monthly_inflow_avg | float | ₹, last 6 months |
| upi_inflow_volatility | float | coefficient of variation |
| upi_active_days_per_month | int | 0-30 |
| gst_monthly_turnover | float | ₹, NaN if not applicable |
| gst_filing_consistency | float | 0-1, NaN if not applicable |
| utility_payment_regularity | float | 0-1 (fraction paid on time) |
| utility_avg_delay_days | float | avg days late |
| telecom_recharge_frequency | float | recharges/month |
| telecom_recharge_consistency | float | 0-1 |
| ecommerce_txn_frequency | float | txns/month, NaN if not applicable |
| ecommerce_return_rate | float | 0-1, NaN if not applicable |
| mobility_active_days | float | days/month, NaN if not applicable |
| mobility_distance_trend | float | % change over 3 months |
| existing_bureau_flag | bool | has any (even thin) bureau file |
| existing_bureau_score_partial | float | NaN if no file, else 300-900 |
| months_of_data_available | int | drives confidence score |
| num_sources_available | int | out of 6, drives confidence score |
| default_label | int | 0/1, HIDDEN ground truth for training/eval only |

### 5.2 Generation logic (non-negotiable)

1. Draw a **latent "true creditworthiness"** value per synthetic customer (0-1).
2. Generate every feature as a function of that latent value **plus persona-specific noise** — features must be correlated with the same underlying truth, not independently random, or the model will learn nothing meaningful.
3. Apply persona-specific missingness per Section 4 table.
4. `default_label` = 1 with probability inversely related to latent creditworthiness (add noise so it's not perfectly separable — real defaults aren't deterministic).
5. Target size: 8,000–10,000 rows.
6. Ship the generator as a documented, parameterized script — this is a feature, not a limitation. State clearly in the README: *"Prototype uses a parameterized synthetic data generator due to the absence of production GST/UPI/AA access; see `src/data/synthetic_generator.py`."*

---

## 6. Feature Engineering Formulas

```
cashflow_stability      = 1 - upi_inflow_volatility
payment_discipline      = (utility_payment_regularity + telecom_recharge_consistency) / 2
business_activity_index = gst_filing_consistency * log1p(gst_monthly_turnover)   [merchants only]
livelihood_activity     = (mobility_active_days / 30) * (1 + mobility_distance_trend)  [gig workers only]
income_proxy            = upi_monthly_inflow_avg * upi_active_days_per_month / 30
```

Missing-source features are imputed as **persona-median**, never zero (zero implies "very bad," missing means "unknown" — these are different and the Confidence Score exists to capture that difference).

---

## 7. Model Architecture

**Layer A — Transparent baseline:** Weight-of-Evidence (WOE) binning + Logistic Regression. This is the industry-standard, fully auditable scorecard approach — use it as your regulatory-grade fallback and cite it explicitly as such.

**Layer B — Challenger:** LightGBM (or XGBoost), trained on the same feature set, benchmarked against Layer A in `02_model_benchmarking.ipynb`. Report the lift of B over A.

**Composite formula:**
```
Composite = w1*Capacity + w2*Stability + w3*Discipline

Capacity   = f(income_proxy, business_activity_index)
Stability  = f(cashflow_stability, gst MoM variance)
Discipline = f(payment_discipline, existing_bureau_score_partial if available)

Persona weights (w1, w2, w3):
  Merchant:            (0.50, 0.30, 0.20)
  Gig Worker:           (0.40, 0.20, 0.40)
  First-time Borrower: (0.35, 0.25, 0.40)
  Informal/Rural:       (0.35, 0.35, 0.30)

Final Score = scale(Composite, 300, 900)   # via WOE-consistent scaling, not raw sigmoid
```

If `existing_bureau_flag` is True, blend `existing_bureau_score_partial` into Discipline at 30% weight — reflects the real-world best practice of blending thin bureau signal with alt-data rather than discarding it.

---

## 8. Confidence Score (SEPARATE from credit score)

```
Confidence = clip(
    20 * log1p(months_of_data_available) + 10 * num_sources_available,
    0, 100
)
```
Display prominently next to the score. A score of 742 with 40% confidence must visually read differently from 742 with 95% confidence.

---

## 9. Anomaly / Fraud Flag (SEPARATE from credit score)

Use Isolation Forest on the full feature set independent of the scoring model. Output tier: Low / Medium / High. High anomaly → route to manual review regardless of credit score. Never let this flag silently reduce the credit score — it gates the decision, it doesn't blend into it.

---

## 10. Explainability

Use TreeSHAP on the Layer B model. Map top 5 |SHAP value| features to human-readable reason codes:

| Feature | Reason code text (positive) | Reason code text (negative) |
|---|---|---|
| cashflow_stability | "Consistent monthly inflow pattern" | "Volatile/inconsistent cash inflow" |
| payment_discipline | "Regular utility & recharge payments" | "Irregular bill payment history" |
| business_activity_index | "Growing, consistent business turnover" | "Declining/inconsistent business activity" |
| livelihood_activity | "Stable, active work pattern" | "Irregular work activity" |
| existing_bureau_score_partial | "Some positive formal credit history" | "No formal credit history available" |

This mirrors real "adverse action reason code" terminology used in actual scorecards — use that term in your pitch.

---

## 11. Path-to-Eligibility (What-If Simulator)

Given a customer's current feature vector and a target change (e.g., "+18% average inflow for 3 months"), recompute the Composite score and report the delta in score/tier/eligible loan amount. This is your single best demo moment — do not rush it in the walkthrough.

---

## 12. Application (Streamlit) — 5 Screens

1. **Onboarding & Consent** — name, occupation, explicit consent checkbox per data source (never silent collection)
2. **Data Connection Status** — checklist of sources connected + % data coverage
3. **Financial Fingerprint** — bar/radar visualization of Capacity/Stability/Discipline
4. **Credit Decision** — Score, Tier, Confidence %, Recommended Loan/Tenure/EMI
5. **Explainability + What-If** — reason codes (+/-) and interactive sliders for the what-if simulator

---

## 13. Module Interfaces (CONTRACTS — do not change without updating this file)

```python
# src/data/synthetic_generator.py
def generate_synthetic_dataset(n_samples: int = 8000, seed: int = 42) -> pd.DataFrame: ...

# src/features/feature_engineering.py
def engineer_features(df: pd.DataFrame) -> pd.DataFrame: ...

# src/models/train.py
def train_baseline_model(X_train, y_train): ...
def train_challenger_model(X_train, y_train): ...

# src/models/evaluate.py
def evaluate_model(model, X_test, y_test) -> dict:
    # returns {'roc_auc':.., 'pr_auc':.., 'ks_stat':.., 'brier':..}

# src/models/confidence.py
def compute_confidence_score(customer_row: pd.Series) -> float: ...   # 0-100

# src/models/anomaly.py
def compute_anomaly_flag(customer_row: pd.Series) -> str: ...          # 'Low'|'Medium'|'High'

# src/explainability/shap_explainer.py
def get_shap_values(model, X_row) -> dict: ...

# src/explainability/reason_codes.py
def map_to_reason_codes(shap_dict: dict) -> list[dict]: ...
    # [{'factor':.., 'impact': '+'|'-', 'description':..}, ...]

# src/simulation/what_if.py
def simulate_improvement(customer_row: pd.Series, target_change: dict) -> dict: ...
    # {'new_score':.., 'new_tier':.., 'delta':..}

# MASTER ORCHESTRATOR
# Implemented in src/models/__init__.py
# app.py should ONLY ever call this function

def score_customer(customer_row: pd.Series) -> dict:
    """
    Returns:
    {
      'score': int,                    # 300-900
      'tier': str,                     # Low/Medium/High risk
      'confidence': float,             # 0-100
      'anomaly_flag': str,             # Low/Medium/High
      'reason_codes': list[dict],
      'recommended_loan': float,
      'recommended_tenure_months': int,
      'recommended_emi': float
    }
    """
```

---

## 14. Testing & Evaluation Requirements

Report ROC-AUC, PR-AUC, KS-statistic, and Brier score — never accuracy alone (meaningless under class imbalance in lending). Unit tests must assert: score always in [300,900], confidence always in [0,100], anomaly flag is one of the three valid strings.

---

## 15. Task Ownership (maps to the 3-agent build plan)

| Owner | Files |
|---|---|
| **Agent 1 — Data & Features** | `src/data/*`, `src/features/*`, `notebooks/01_*`, `data/*` |
| **Agent 2 — Models & Explainability** | `src/models/*`, `src/explainability/*`, `src/simulation/*`, `notebooks/02_*`, `tests/test_model_inference.py` |
| **Agent 3 — App & Integration** | `app.py`, `src/utils/*`, `assets/*`, `tests/test_feature_engineering.py`, `setup.py`, `requirements.txt`, `README.md` |

Agent 2 owns `src/models/__init__.py` and implements `score_customer()`. Agent 3 owns `app.py` and must only call `score_customer()` — never reach into Agent 2's internal functions directly, and never modify `src/models/__init__.py`. This is what lets all three work in parallel without merge conflicts.

---

## 16. Round 2 / Round 3 Deliverables

- Round 2: PPT + working PoC/wireframes (this repo, screens 1-5 functional with mock or real model)
- Round 3: live demo + full code walkthrough (all modules real, no mocks remaining)