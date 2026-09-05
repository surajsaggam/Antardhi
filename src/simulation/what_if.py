"""Path-to-Eligibility (What-If Simulator) module.

Follows Section 11 and Section 13 of PROJECT_SPEC.md.
Simulates candidate behavioral adjustments and recomputes credit score, tier, and delta.
"""

from typing import Any, Dict
import pandas as pd

from src.models.train import compute_composite_score
from src.models import _calculate_loan_offer


def get_tier_label(score: int) -> str:
    """Map credit score to standard risk tier."""
    if score >= 750:
        return "Low Risk"
    elif score >= 600:
        return "Medium Risk"
    else:
        return "High Risk"


def simulate_improvement(
    customer_row: pd.Series,
    target_change: Dict[str, Any]
) -> Dict[str, Any]:
    """Simulate credit score and tier improvement given target behavioral adjustments.

    Follows Section 11 and Section 13 of PROJECT_SPEC.md.
    Uses the exact same Composite credit score architecture as score_customer().
    Operates strictly on a copy of customer_row and does not mutate input data.

    Args:
        customer_row (pd.Series): Applicant's baseline feature record.
        target_change (dict): Dictionary of proposed behavioral adjustments.
            Can include absolute feature targets (e.g., {'utility_payment_regularity': 0.95})
            or percentage changes (e.g., {'inflow_pct': 25.0}).

    Returns:
        dict:
            'current_score' (int): Baseline credit score.
            'current_tier' (str): Baseline risk tier.
            'new_score' (int): Updated credit score [300, 900].
            'new_tier' (str): Updated risk tier ('Low Risk', 'Medium Risk', 'High Risk').
            'delta' (int): Score difference (new_score - current_score).
            'current_loan' (float): Baseline loan eligibility in INR.
            'new_loan' (float): Updated loan eligibility in INR.
            'loan_delta' (float): Increase in loan eligibility.
            'recommended_loan' (float): Updated recommended loan in INR.
            'recommended_tenure_months' (int): Updated recommended tenure in months.
            'recommended_emi' (float): Updated recommended monthly EMI in INR.
    """
    # 1. Baseline calculation
    current_score = compute_composite_score(customer_row)
    current_tier = get_tier_label(current_score)

    curr_upi = float(customer_row.get("upi_monthly_inflow_avg", 30000.0))
    curr_days = float(customer_row.get("upi_active_days_per_month", 25.0))
    curr_inc = curr_upi * min(max(curr_days, 0.0), 30.0) / 30.0
    curr_loan, _, _ = _calculate_loan_offer(current_score, curr_inc)

    # 2. Apply adjustments to a copy (NEVER mutate input data)
    modified_row = customer_row.copy()

    for key, val in target_change.items():
        if key in ("inflow_pct", "upi_inflow_pct", "inflow_pct_change", "inflow_increase"):
            curr_val = float(modified_row.get("upi_monthly_inflow_avg", 30000.0))
            modified_row["upi_monthly_inflow_avg"] = curr_val * (1.0 + float(val) / 100.0)
        elif key.endswith("_pct") or key.endswith("_pct_change"):
            base_col = key.replace("_pct_change", "").replace("_pct", "")
            if base_col in modified_row:
                curr_val = float(modified_row[base_col])
                modified_row[base_col] = curr_val * (1.0 + float(val) / 100.0)
        else:
            modified_row[key] = val

    # 3. New scenario calculation using identical Composite architecture
    new_score = compute_composite_score(modified_row)
    new_tier = get_tier_label(new_score)
    delta = int(new_score - current_score)

    new_upi = float(modified_row.get("upi_monthly_inflow_avg", 30000.0))
    new_days = float(modified_row.get("upi_active_days_per_month", 25.0))
    new_inc = new_upi * min(max(new_days, 0.0), 30.0) / 30.0
    new_loan, new_tenure, new_emi = _calculate_loan_offer(new_score, new_inc)
    loan_delta = float(round(new_loan - curr_loan, 2))

    return {
        "current_score": int(current_score),
        "current_tier": current_tier,
        "new_score": int(new_score),
        "new_tier": new_tier,
        "delta": int(delta),
        "current_loan": float(curr_loan),
        "new_loan": float(new_loan),
        "loan_delta": float(loan_delta),
        "recommended_loan": float(new_loan),
        "recommended_tenure_months": int(new_tenure),
        "recommended_emi": float(new_emi),
    }
