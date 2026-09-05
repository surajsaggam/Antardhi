"""Adverse action and positive credit reason codes mapping.

Follows Section 10 and Section 13 of PROJECT_SPEC.md.
Maps top 5 |SHAP value| features to regulatory-grade human-readable reason codes.
"""

from typing import Dict, List

# Section 10 authoritative mapping table
REASON_CODE_CATALOG: Dict[str, Dict[str, str]] = {
    "cashflow_stability": {
        "+": "Consistent monthly inflow pattern",
        "-": "Volatile/inconsistent cash inflow",
    },
    "payment_discipline": {
        "+": "Regular utility & recharge payments",
        "-": "Irregular bill payment history",
    },
    "business_activity_index": {
        "+": "Growing, consistent business turnover",
        "-": "Declining/inconsistent business activity",
    },
    "livelihood_activity": {
        "+": "Stable, active work pattern",
        "-": "Irregular work activity",
    },
    "existing_bureau_score_partial": {
        "+": "Some positive formal credit history",
        "-": "No formal credit history available",
    },
    # Extended human-readable catalog for other features in top 5
    "income_proxy": {
        "+": "Strong monthly income proxy from digital transactions",
        "-": "Low estimated monthly income proxy",
    },
    "upi_monthly_inflow_avg": {
        "+": "Healthy average monthly UPI inflow volume",
        "-": "Subdued monthly UPI transaction volume",
    },
    "upi_active_days_per_month": {
        "+": "Frequent daily digital transaction activity",
        "-": "Sporadic digital transaction days per month",
    },
    "utility_payment_regularity": {
        "+": "Consistent and timely utility bill payment track record",
        "-": "Delayed or irregular utility bill payments",
    },
    "telecom_recharge_consistency": {
        "+": "Dependable and recurring mobile recharge pattern",
        "-": "Inconsistent mobile recharge cadence",
    },
    "months_of_data_available": {
        "+": "Deep transaction history and seasoned digital profile",
        "-": "Short operating history available for assessment",
    },
    "num_sources_available": {
        "+": "High alternative data source footprint and verification",
        "-": "Limited data sources available for underwriting",
    },
}


def map_to_reason_codes(shap_dict: Dict[str, float]) -> List[Dict[str, str]]:
    """Map top 5 absolute SHAP features to human-readable reason codes.

    CONTRACT (PROJECT_SPEC.md Section 10 & 13):
        Returns:
            list of [{'factor': str, 'impact': '+' | '-', 'description': str}, ...]

    Note on direction:
        In default prediction (y=1 default):
        - Negative SHAP reduces default risk -> Positive impact (+) on creditworthiness.
        - Positive SHAP increases default risk -> Negative impact (-) / Adverse action.

    Args:
        shap_dict (dict): Feature name to SHAP value.

    Returns:
        list[dict]: Top 5 reason code dictionaries.
    """
    if not shap_dict:
        return []

    # Sort features by absolute SHAP value in descending order
    sorted_features = sorted(
        shap_dict.items(),
        key=lambda item: abs(item[1]),
        reverse=True
    )

    reason_codes: List[Dict[str, str]] = []
    top_5 = sorted_features[:5]

    for feature, shap_val in top_5:
        # shap_val < 0 lowers default prob -> '+' impact on creditworthiness
        # shap_val > 0 raises default prob -> '-' impact on creditworthiness
        impact = "+" if shap_val < 0 else "-"

        if feature in REASON_CODE_CATALOG:
            desc = REASON_CODE_CATALOG[feature][impact]
        else:
            clean_name = feature.replace("_", " ").title()
            desc = (
                f"Favorable {clean_name} contributing positively to score"
                if impact == "+"
                else f"Adverse {clean_name} requiring improvement"
            )

        reason_codes.append({
            "factor": feature,
            "impact": impact,
            "description": desc
        })

    return reason_codes
