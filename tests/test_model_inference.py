"""Unit tests for Agent 2: Models, Explainability & Simulation.

Tests all Section 13 public functions and assertions:
- score_customer() return contract & range assertions
- score in [300, 900] and type int
- confidence in [0, 100] and type float
- anomaly_flag in {'Low', 'Medium', 'High'}
- anomaly flag DOES NOT alter the credit score
- reason_codes is list of dicts with factor, impact, description
- recommended_loan is float, recommended_tenure_months is int, recommended_emi is float
- train_baseline_model, train_challenger_model, evaluate_model
- compute_confidence_score, compute_anomaly_flag
- get_shap_values, map_to_reason_codes, simulate_improvement
"""

import os
import sys

# Ensure repository root is on sys.path for test runner discovery
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
import pandas as pd
import pytest

pytestmark = pytest.mark.filterwarnings("ignore::UserWarning")

from src.models import score_customer
from src.models.train import (
    train_baseline_model,
    train_challenger_model,
    get_or_train_models,
)
from src.models.evaluate import evaluate_model
from src.models.confidence import compute_confidence_score
from src.models.anomaly import compute_anomaly_flag, get_anomaly_model
from src.explainability.shap_explainer import get_shap_values
from src.explainability.reason_codes import map_to_reason_codes
from src.simulation.what_if import simulate_improvement
from src.models.features import extract_features


@pytest.fixture(scope="module")
def trained_models():
    """Module-level fixture to ensure models are trained."""
    return get_or_train_models()


@pytest.fixture
def sample_merchant():
    """Sample Small Merchant applicant."""
    return pd.Series({
        "customer_id": "cust-merchant-001",
        "persona": "Small Merchant",
        "upi_monthly_inflow_avg": 85000.0,
        "upi_inflow_volatility": 0.22,
        "upi_active_days_per_month": 27,
        "gst_monthly_turnover": 140000.0,
        "gst_filing_consistency": 0.92,
        "utility_payment_regularity": 0.88,
        "utility_avg_delay_days": 1.5,
        "telecom_recharge_frequency": np.nan,
        "telecom_recharge_consistency": np.nan,
        "ecommerce_txn_frequency": 15.0,
        "ecommerce_return_rate": 0.04,
        "mobility_active_days": np.nan,
        "mobility_distance_trend": np.nan,
        "existing_bureau_flag": False,
        "existing_bureau_score_partial": np.nan,
        "months_of_data_available": 18,
        "num_sources_available": 4,
    })


@pytest.fixture
def sample_gig_worker():
    """Sample Gig Worker applicant."""
    return pd.Series({
        "customer_id": "cust-gig-002",
        "persona": "Gig Worker",
        "upi_monthly_inflow_avg": 38000.0,
        "upi_inflow_volatility": 0.28,
        "upi_active_days_per_month": 28,
        "gst_monthly_turnover": np.nan,
        "gst_filing_consistency": np.nan,
        "utility_payment_regularity": 0.78,
        "utility_avg_delay_days": 4.0,
        "telecom_recharge_frequency": 4.0,
        "telecom_recharge_consistency": 0.85,
        "ecommerce_txn_frequency": np.nan,
        "ecommerce_return_rate": np.nan,
        "mobility_active_days": 26.0,
        "mobility_distance_trend": 0.12,
        "existing_bureau_flag": False,
        "existing_bureau_score_partial": np.nan,
        "months_of_data_available": 12,
        "num_sources_available": 3,
    })


@pytest.fixture
def sample_edge_thin_file():
    """Edge case: completely thin file, 0 months, 1 source, high volatility."""
    return pd.Series({
        "customer_id": "cust-edge-003",
        "persona": "Informal/Rural Worker",
        "upi_monthly_inflow_avg": 6000.0,
        "upi_inflow_volatility": 0.90,
        "upi_active_days_per_month": 4,
        "gst_monthly_turnover": np.nan,
        "gst_filing_consistency": np.nan,
        "utility_payment_regularity": 0.10,
        "utility_avg_delay_days": 25.0,
        "telecom_recharge_frequency": np.nan,
        "telecom_recharge_consistency": np.nan,
        "ecommerce_txn_frequency": np.nan,
        "ecommerce_return_rate": np.nan,
        "mobility_active_days": np.nan,
        "mobility_distance_trend": np.nan,
        "existing_bureau_flag": False,
        "existing_bureau_score_partial": np.nan,
        "months_of_data_available": 0,
        "num_sources_available": 1,
    })


# ====================================================================
# 1. Integration Contract Tests: score_customer()
# ====================================================================

def test_score_customer_contract_shape_and_types(trained_models, sample_merchant):
    """Assert score_customer returns the exact Section 13 contract shape and types."""
    result = score_customer(sample_merchant)

    assert isinstance(result, dict)
    expected_keys = {
        "score", "tier", "confidence", "anomaly_flag",
        "reason_codes", "recommended_loan",
        "recommended_tenure_months", "recommended_emi"
    }
    assert set(result.keys()) == expected_keys

    # Type guarantees
    assert isinstance(result["score"], int)
    assert isinstance(result["tier"], str)
    assert isinstance(result["confidence"], float)
    assert isinstance(result["anomaly_flag"], str)
    assert isinstance(result["reason_codes"], list)
    assert isinstance(result["recommended_loan"], float)
    assert isinstance(result["recommended_tenure_months"], int)
    assert isinstance(result["recommended_emi"], float)


def test_score_customer_value_constraints(trained_models, sample_merchant, sample_gig_worker, sample_edge_thin_file):
    """Assert numeric ranges and string constraints per Section 13 and 14."""
    for customer in [sample_merchant, sample_gig_worker, sample_edge_thin_file]:
        res = score_customer(customer)

        # Score always in [300, 900]
        assert 300 <= res["score"] <= 900

        # Tier is one of valid labels
        assert res["tier"] in {"Low Risk", "Medium Risk", "High Risk"}

        # Confidence always in [0, 100]
        assert 0.0 <= res["confidence"] <= 100.0

        # Anomaly flag is strictly one of 'Low', 'Medium', 'High'
        assert res["anomaly_flag"] in {"Low", "Medium", "High"}

        # Reason codes is a non-empty list of dicts with expected keys
        assert len(res["reason_codes"]) <= 5
        for rc in res["reason_codes"]:
            assert "factor" in rc
            assert rc["impact"] in {"+", "-"}
            assert "description" in rc
            assert isinstance(rc["description"], str)

        # Loan recommendations are valid non-negative values
        assert res["recommended_loan"] >= 0.0
        assert res["recommended_tenure_months"] > 0
        assert res["recommended_emi"] >= 0.0


def test_anomaly_flag_does_not_alter_credit_score(trained_models, sample_merchant):
    """Rule 5: Anomaly/fraud flag MUST NEVER blend into or alter the credit score."""
    _, challenger_model = trained_models

    # Expected raw score directly from model
    expected_score = challenger_model.score(sample_merchant)

    # Score from orchestrator
    result = score_customer(sample_merchant)

    # They must match exactly; anomaly flag cannot alter the score
    assert result["score"] == expected_score


# ====================================================================
# 2. Confidence Score Tests (Section 8)
# ====================================================================

def test_compute_confidence_score_formula():
    """Verify Section 8 exact formula: clip(20*log1p(months) + 10*sources, 0, 100)."""
    # 0 months, 0 sources -> 0.0
    c0 = compute_confidence_score(pd.Series({"months_of_data_available": 0, "num_sources_available": 0}))
    assert c0 == 0.0

    # 12 months, 4 sources -> clip(20*ln(13) + 40, 0, 100) = clip(20*2.5649 + 40, 0, 100) ~ 91.3
    c1 = compute_confidence_score(pd.Series({"months_of_data_available": 12, "num_sources_available": 4}))
    assert 90.0 <= c1 <= 95.0

    # Extreme high -> clips cleanly at 100.0
    c_max = compute_confidence_score(pd.Series({"months_of_data_available": 100, "num_sources_available": 10}))
    assert c_max == 100.0

    # Missing / NaN handles gracefully
    c_nan = compute_confidence_score(pd.Series({}))
    assert c_nan == 0.0


# ====================================================================
# 3. Anomaly Flag Tests (Section 9)
# ====================================================================

def test_compute_anomaly_flag_tiers(sample_merchant):
    """Verify Isolation Forest returns valid tiers and handles extreme outliers."""
    flag = compute_anomaly_flag(sample_merchant)
    assert flag in {"Low", "Medium", "High"}

    # An extreme outlier row (e.g. impossible volume with zero active days)
    outlier = pd.Series({
        "persona": "Informal/Rural Worker",
        "upi_monthly_inflow_avg": 50000000.0,
        "upi_inflow_volatility": 0.99,
        "upi_active_days_per_month": 1,
        "utility_payment_regularity": 0.0,
        "utility_avg_delay_days": 180.0,
        "months_of_data_available": 24,
        "num_sources_available": 1,
    })
    outlier_flag = compute_anomaly_flag(outlier)
    assert outlier_flag in {"Medium", "High"}


# ====================================================================
# 4. Model Training & Evaluation Tests (Section 7, 13, 14)
# ====================================================================

def test_baseline_and_challenger_training(trained_models):
    """Verify baseline and challenger models fit and produce probabilities."""
    baseline_model, challenger_model = trained_models

    df = pd.read_csv("data/synthetic_credit_data.csv")
    X = extract_features(df)
    y = df["default_label"].values

    # Test baseline scorecard
    proba_base = baseline_model.predict_proba(X)
    assert proba_base.shape == (len(X), 2)
    assert np.all((proba_base >= 0.0) & (proba_base <= 1.0))

    # Test challenger model
    proba_chal = challenger_model.predict_proba(X)
    assert proba_chal.shape == (len(X), 2)
    assert np.all((proba_chal >= 0.0) & (proba_chal <= 1.0))


def test_evaluate_model_metrics(trained_models):
    """Verify evaluate_model returns ROC-AUC, PR-AUC, KS, and Brier score."""
    _, challenger_model = trained_models
    df = pd.read_csv("data/synthetic_credit_data.csv")
    X = extract_features(df)
    y = df["default_label"].values

    metrics = evaluate_model(challenger_model, X, y)
    assert "roc_auc" in metrics
    assert "pr_auc" in metrics
    assert "ks_stat" in metrics
    assert "brier" in metrics

    assert 0.0 <= metrics["roc_auc"] <= 1.0
    assert 0.0 <= metrics["pr_auc"] <= 1.0
    assert 0.0 <= metrics["ks_stat"] <= 1.0
    assert 0.0 <= metrics["brier"] <= 1.0


# ====================================================================
# 5. Explainability & Reason Codes Tests (Section 10)
# ====================================================================

def test_shap_values_and_reason_codes(trained_models, sample_merchant):
    """Verify TreeSHAP values and mapping to Section 10 reason codes."""
    _, challenger_model = trained_models

    shap_dict = get_shap_values(challenger_model, sample_merchant)
    assert isinstance(shap_dict, dict)
    assert len(shap_dict) > 0

    reason_codes = map_to_reason_codes(shap_dict)
    assert isinstance(reason_codes, list)
    assert 1 <= len(reason_codes) <= 5

    for rc in reason_codes:
        assert "factor" in rc
        assert rc["impact"] in {"+", "-"}
        assert len(rc["description"]) > 0


# ====================================================================
# 6. What-If Simulator Tests (Section 11)
# ====================================================================

def test_simulate_improvement(trained_models, sample_gig_worker):
    """Verify simulate_improvement returns updated score, tier, and delta."""
    # Ensure original customer row is not mutated
    original_inflow = sample_gig_worker["upi_monthly_inflow_avg"]
    original_regularity = sample_gig_worker["utility_payment_regularity"]

    sim = simulate_improvement(
        sample_gig_worker,
        {"inflow_pct": 25.0, "utility_payment_regularity": 0.98}
    )

    # Immutability verification
    assert sample_gig_worker["upi_monthly_inflow_avg"] == original_inflow
    assert sample_gig_worker["utility_payment_regularity"] == original_regularity

    assert "new_score" in sim
    assert "new_tier" in sim
    assert "delta" in sim
    assert "current_score" in sim
    assert "current_tier" in sim
    assert "recommended_loan" in sim
    assert "recommended_tenure_months" in sim
    assert "recommended_emi" in sim

    assert 300 <= sim["new_score"] <= 900
    assert 300 <= sim["current_score"] <= 900
    assert sim["new_tier"] in {"Low Risk", "Medium Risk", "High Risk"}
    assert sim["current_tier"] in {"Low Risk", "Medium Risk", "High Risk"}
    assert sim["delta"] == sim["new_score"] - sim["current_score"]
    # Positive behavioral change must increase credit score
    assert sim["new_score"] > sim["current_score"]
    assert sim["delta"] > 0


# ====================================================================
# 7. Persona Robustness & Explicit Spec Requirement Tests
# ====================================================================

@pytest.mark.parametrize("persona_name", [
    "Small Merchant",
    "Gig Worker",
    "First-time Borrower",
    "Informal/Rural Worker",
])
def test_all_four_persona_strings_accepted(trained_models, persona_name):
    """Assert all four authoritative persona strings are accepted and correctly processed."""
    customer = pd.Series({
        "customer_id": f"cust-test-{persona_name.lower().replace(' ', '-')[:8]}",
        "persona": persona_name,
        "upi_monthly_inflow_avg": 45000.0,
        "upi_inflow_volatility": 0.25,
        "upi_active_days_per_month": 22,
        "utility_payment_regularity": 0.85,
        "telecom_recharge_consistency": 0.80,
        "months_of_data_available": 14,
        "num_sources_available": 3,
    })

    res = score_customer(customer)

    # Exact Section 13 keys
    expected_keys = {
        "score", "tier", "confidence", "anomaly_flag",
        "reason_codes", "recommended_loan",
        "recommended_tenure_months", "recommended_emi"
    }
    assert set(res.keys()) == expected_keys

    # Constraints
    assert 300 <= res["score"] <= 900
    assert 0.0 <= res["confidence"] <= 100.0
    assert res["anomaly_flag"] in {"Low", "Medium", "High"}
    assert res["tier"] in {"Low Risk", "Medium Risk", "High Risk"}
    assert len(res["reason_codes"]) <= 5
    assert res["recommended_loan"] >= 0.0
    assert res["recommended_tenure_months"] in {6, 12, 18}
    assert res["recommended_emi"] >= 0.0


def test_anomaly_flag_strictly_independent_of_credit_score(trained_models):
    """Verify anomaly status does not penalize or alter credit score calculation."""
    base_customer = pd.Series({
        "persona": "First-time Borrower",
        "upi_monthly_inflow_avg": 50000.0,
        "upi_inflow_volatility": 0.20,
        "upi_active_days_per_month": 24,
        "utility_payment_regularity": 0.85,
        "telecom_recharge_consistency": 0.80,
        "months_of_data_available": 16,
        "num_sources_available": 3,
    })

    res_base = score_customer(base_customer)

    # Anomaly flag is computed separately and does not subtract from composite score
    from src.models.train import compute_composite_score
    composite_score = compute_composite_score(base_customer)
    assert res_base["score"] == composite_score

