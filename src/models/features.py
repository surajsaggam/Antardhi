"""Internal feature engineering and preprocessing for models.

Follows Section 6 of PROJECT_SPEC.md.
Implements persona-median imputation for missing values.
"""

from typing import Optional
import numpy as np
import pandas as pd


# Authoritative persona median values per Section 6 and src/features/feature_engineering.py
PERSONA_MEDIANS = {
    "Small Merchant": {
        "upi_monthly_inflow_avg": 125000.0,
        "upi_inflow_volatility": 0.34,
        "upi_active_days_per_month": 24.0,
        "gst_monthly_turnover": 250000.0,
        "gst_filing_consistency": 0.72,
        "utility_payment_regularity": 0.69,
        "utility_avg_delay_days": 8.5,
        "telecom_recharge_frequency": 2.3,
        "telecom_recharge_consistency": 0.68,
        "ecommerce_txn_frequency": 5.8,
        "ecommerce_return_rate": 0.16,
        "mobility_active_days": 19.0,
        "mobility_distance_trend": 0.04,
        "existing_bureau_score_partial": 625.0,
        "months_of_data_available": 19.0,
        "num_sources_available": 4.0,
    },
    "Gig Worker": {
        "upi_monthly_inflow_avg": 35000.0,
        "upi_inflow_volatility": 0.38,
        "upi_active_days_per_month": 22.0,
        "gst_monthly_turnover": 0.0,
        "gst_filing_consistency": 0.0,
        "utility_payment_regularity": 0.65,
        "utility_avg_delay_days": 9.5,
        "telecom_recharge_frequency": 2.4,
        "telecom_recharge_consistency": 0.68,
        "ecommerce_txn_frequency": 4.5,
        "ecommerce_return_rate": 0.17,
        "mobility_active_days": 20.0,
        "mobility_distance_trend": 0.05,
        "existing_bureau_score_partial": 610.0,
        "months_of_data_available": 18.0,
        "num_sources_available": 3.0,
    },
    "First-time Borrower": {
        "upi_monthly_inflow_avg": 56000.0,
        "upi_inflow_volatility": 0.21,
        "upi_active_days_per_month": 20.0,
        "gst_monthly_turnover": 0.0,
        "gst_filing_consistency": 0.0,
        "utility_payment_regularity": 0.70,
        "utility_avg_delay_days": 8.0,
        "telecom_recharge_frequency": 2.2,
        "telecom_recharge_consistency": 0.67,
        "ecommerce_txn_frequency": 5.0,
        "ecommerce_return_rate": 0.16,
        "mobility_active_days": 18.0,
        "mobility_distance_trend": 0.03,
        "existing_bureau_score_partial": 630.0,
        "months_of_data_available": 20.0,
        "num_sources_available": 3.0,
    },
    "Informal/Rural Worker": {
        "upi_monthly_inflow_avg": 20000.0,
        "upi_inflow_volatility": 0.48,
        "upi_active_days_per_month": 14.0,
        "gst_monthly_turnover": 0.0,
        "gst_filing_consistency": 0.0,
        "utility_payment_regularity": 0.68,
        "utility_avg_delay_days": 9.0,
        "telecom_recharge_frequency": 2.3,
        "telecom_recharge_consistency": 0.67,
        "ecommerce_txn_frequency": 0.0,
        "ecommerce_return_rate": 0.0,
        "mobility_active_days": 0.0,
        "mobility_distance_trend": 0.0,
        "existing_bureau_score_partial": 590.0,
        "months_of_data_available": 18.0,
        "num_sources_available": 3.0,
    },
}
# Backward compatibility alias
PERSONA_MEDIANS["First-time Borrower (salaried, thin file)"] = PERSONA_MEDIANS["First-time Borrower"]

FEATURE_COLUMNS = [
    "cashflow_stability",
    "payment_discipline",
    "business_activity_index",
    "livelihood_activity",
    "income_proxy",
    "upi_monthly_inflow_avg",
    "upi_inflow_volatility",
    "upi_active_days_per_month",
    "utility_payment_regularity",
    "utility_avg_delay_days",
    "telecom_recharge_frequency",
    "telecom_recharge_consistency",
    "ecommerce_txn_frequency",
    "ecommerce_return_rate",
    "mobility_active_days",
    "mobility_distance_trend",
    "existing_bureau_flag",
    "existing_bureau_score_partial",
    "months_of_data_available",
    "num_sources_available",
]


def extract_features(
    df_or_series: pd.DataFrame | pd.Series,
    medians: Optional[dict] = None
) -> pd.DataFrame:
    """Extract Section 6 derived features and impute missing sources.

    Formulas per Section 6:
      cashflow_stability      = 1 - upi_inflow_volatility
      payment_discipline      = (utility_payment_regularity + telecom_recharge_consistency) / 2
      business_activity_index = gst_filing_consistency * log1p(gst_monthly_turnover) [merchants only]
      livelihood_activity     = (mobility_active_days / 30) * (1 + mobility_distance_trend) [gig workers only]
      income_proxy            = upi_monthly_inflow_avg * upi_active_days_per_month / 30

    Args:
        df_or_series: Single pd.Series customer row or pd.DataFrame.
        medians: Optional persona median dictionary for imputation.

    Returns:
        pd.DataFrame with engineered features and imputed values.
    """
    if isinstance(df_or_series, pd.Series):
        df = pd.DataFrame([df_or_series])
    else:
        df = df_or_series.copy()

    # Impute missing values per persona
    if medians is None:
        medians = PERSONA_MEDIANS

    for idx, row in df.iterrows():
        raw_persona = row.get("persona", "First-time Borrower")
        persona = str(raw_persona) if not pd.isna(raw_persona) else "First-time Borrower"
        if persona == "First-time Borrower (salaried, thin file)":
            persona = "First-time Borrower"
        p_med = medians.get(persona, medians.get("First-time Borrower", list(medians.values())[0]))
        for col, default_val in p_med.items():
            if col in df.columns and pd.isna(df.at[idx, col]):
                df.at[idx, col] = default_val

    # Ensure numeric columns are floats/ints
    numeric_cols = [
        "upi_monthly_inflow_avg", "upi_inflow_volatility", "upi_active_days_per_month",
        "gst_monthly_turnover", "gst_filing_consistency", "utility_payment_regularity",
        "utility_avg_delay_days", "telecom_recharge_frequency", "telecom_recharge_consistency",
        "ecommerce_txn_frequency", "ecommerce_return_rate", "mobility_active_days",
        "mobility_distance_trend", "existing_bureau_score_partial", "months_of_data_available",
        "num_sources_available"
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
        else:
            df[col] = 0.0

    if "existing_bureau_flag" in df.columns:
        df["existing_bureau_flag"] = df["existing_bureau_flag"].astype(bool).astype(int)
    else:
        df["existing_bureau_flag"] = 0

    # Derive Section 6 formulas
    df["cashflow_stability"] = (1.0 - df["upi_inflow_volatility"]).clip(0.0, 1.0)
    df["payment_discipline"] = (
        (df["utility_payment_regularity"] + df["telecom_recharge_consistency"]) / 2.0
    ).clip(0.0, 1.0)

    # business_activity_index [merchants only, else 0]
    gst_turnover = np.maximum(df["gst_monthly_turnover"].values, 0.0)
    is_merchant = (
        df["persona"].apply(lambda p: isinstance(p, str) and ("merchant" in p.lower() or "kirana" in p.lower())).values
        if "persona" in df.columns
        else np.zeros(len(df), dtype=bool)
    )
    df["business_activity_index"] = np.where(
        is_merchant,
        df["gst_filing_consistency"].clip(0.0, 1.0).values * np.log1p(gst_turnover),
        0.0
    )

    # livelihood_activity [gig workers only, else 0]
    is_gig = (
        df["persona"].apply(lambda p: isinstance(p, str) and ("gig" in p.lower() or "driver" in p.lower())).values
        if "persona" in df.columns
        else np.zeros(len(df), dtype=bool)
    )
    raw_livelihood = (df["mobility_active_days"].clip(0.0, 30.0).values / 30.0) * (1.0 + df["mobility_distance_trend"].values)
    df["livelihood_activity"] = np.maximum(np.where(is_gig, raw_livelihood, 0.0), 0.0)

    df["income_proxy"] = (
        df["upi_monthly_inflow_avg"] * df["upi_active_days_per_month"].clip(0.0, 30.0) / 30.0
    )

    return df[FEATURE_COLUMNS]
