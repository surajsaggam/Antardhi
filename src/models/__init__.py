"""Models package for Antardhi credit engine.

Exposes the single public integration function for inference:
    score_customer(customer_row: pd.Series) -> dict

Owned and implemented by Agent 2.
"""

from typing import Any
import pandas as pd


def score_customer(customer_row: pd.Series) -> dict[str, Any]:
    """Score a customer and return credit decision, explainability, and loan recommendations.

    MASTER ORCHESTRATOR — single public integration function exposed by Agent 2
    for consumption by app.py (Agent 3).

    Args:
        customer_row (pd.Series): Feature vector for a single applicant.

    Returns:
        dict: Exact Section 13 contract:
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
    """
    raise NotImplementedError(
        "score_customer() is an interface contract placeholder. "
        "Agent 2 will implement the orchestrator logic."
    )


__all__ = ["score_customer"]
