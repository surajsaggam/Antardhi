"""Models package for Antardhi credit engine.

Exposes the single public integration function for inference:
    score_customer(customer_row: pd.Series) -> dict

Owned and implemented by Agent 2.
"""

from typing import Any, Dict
import numpy as np
import pandas as pd

from src.models.confidence import compute_confidence_score
from src.models.anomaly import compute_anomaly_flag
from src.models.train import get_or_train_models
from src.explainability.shap_explainer import get_shap_values
from src.explainability.reason_codes import map_to_reason_codes


def _calculate_loan_offer(score: int, income_proxy: float) -> tuple[float, int, float]:
    """Calculate recommended loan amount, tenure, and monthly EMI based on risk tier and capacity.

    # ASSUMPTION: Alternative data credit sizing policy:
    # - Low Risk (score >= 750): Up to 3.5x monthly income proxy (max INR 300,000), 18 mo, 14% APR
    # - Medium Risk (600 <= score < 750): Up to 2.0x monthly income proxy (max INR 150,000), 12 mo, 18% APR
    # - High Risk (score < 600): Micro-ticket up to 0.5x monthly income proxy (max INR 25,000), 6 mo, 24% APR
    """
    safe_income = max(float(income_proxy), 0.0)

    if score >= 750:
        loan = min(round(safe_income * 3.5, -2), 300000.0)
        tenure = 18
        annual_rate = 0.14
    elif score >= 600:
        loan = min(round(safe_income * 2.0, -2), 150000.0)
        tenure = 12
        annual_rate = 0.18
    else:
        loan = min(round(safe_income * 0.5, -2), 25000.0)
        tenure = 6
        annual_rate = 0.24

    if loan <= 0.0:
        return 0.0, tenure, 0.0

    # Monthly reducing balance amortization
    r = annual_rate / 12.0
    emi = loan * (r * ((1.0 + r) ** tenure)) / (((1.0 + r) ** tenure) - 1.0)

    return float(round(loan, 2)), int(tenure), float(round(emi, 2))


def score_customer(customer_row: pd.Series) -> Dict[str, Any]:
    """Score a customer and return credit decision, explainability, and loan recommendations.

    MASTER ORCHESTRATOR — single public integration function exposed by Agent 2
    for consumption by app.py (Agent 3).

    CONTRACT (PROJECT_SPEC.md Section 13):
        Returns:
        {
          'score': int,                     # 300-900
          'tier': str,                      # Low/Medium/High risk
          'confidence': float,              # 0-100
          'anomaly_flag': str,              # 'Low' | 'Medium' | 'High'
          'reason_codes': list[dict],       # Top SHAP reason codes
          'recommended_loan': float,        # Recommended loan amount in INR
          'recommended_tenure_months': int, # Recommended tenure in months
          'recommended_emi': float          # Recommended monthly EMI in INR
        }

    Args:
        customer_row (pd.Series): Feature vector for a single applicant.

    Returns:
        dict matching exact Section 13 specification.
    """
    # 1. Retrieve or train models
    _, challenger_model = get_or_train_models()

    # 2. Compute Credit Score [300, 900]
    raw_score = challenger_model.score(customer_row)
    score = int(np.clip(raw_score, 300, 900))

    # 3. Determine Risk Tier
    if score >= 750:
        tier = "Low Risk"
    elif score >= 600:
        tier = "Medium Risk"
    else:
        tier = "High Risk"

    # 4. Compute Confidence Score [0.0, 100.0] (Section 8)
    confidence = compute_confidence_score(customer_row)

    # 5. Compute Anomaly / Fraud Flag (Section 9)
    # HARD RULE: Anomaly flag MUST NOT alter or blend into the credit score!
    anomaly_flag = compute_anomaly_flag(customer_row)

    # 6. TreeSHAP Explainability & Top 5 Reason Codes (Section 10)
    shap_values = get_shap_values(challenger_model, customer_row)
    reason_codes = map_to_reason_codes(shap_values)

    # 7. Loan recommendations
    upi_inflow = float(customer_row.get("upi_monthly_inflow_avg", 30000.0))
    active_days = float(customer_row.get("upi_active_days_per_month", 25.0))
    income_proxy = upi_inflow * min(max(active_days, 0.0), 30.0) / 30.0

    recommended_loan, recommended_tenure, recommended_emi = _calculate_loan_offer(score, income_proxy)

    return {
        "score": int(score),
        "tier": tier,
        "confidence": float(confidence),
        "anomaly_flag": anomaly_flag,
        "reason_codes": reason_codes,
        "recommended_loan": float(recommended_loan),
        "recommended_tenure_months": int(recommended_tenure),
        "recommended_emi": float(recommended_emi),
    }


__all__ = ["score_customer"]
