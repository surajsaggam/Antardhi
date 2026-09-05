"""Feature engineering module for Antardhi alternative credit engine.

Implements core domain formulas defined in Section 6 of PROJECT_SPEC.md:
1. cashflow_stability = 1 - upi_inflow_volatility
2. payment_discipline = (utility_payment_regularity + telecom_recharge_consistency) / 2
3. business_activity_index = gst_filing_consistency * log1p(gst_monthly_turnover) [merchants only]
4. livelihood_activity = (mobility_active_days / 30) * (1 + mobility_distance_trend) [gig workers only]
5. income_proxy = upi_monthly_inflow_avg * upi_active_days_per_month / 30

Missing-source features are imputed as persona-median, never zero (Section 6 rule).
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd

from src.data.preprocessor import PersonaMedianImputer

# Default baseline persona medians used as backup for single-row inference
# when fitting a full dataset is not feasible in isolation.
DEFAULT_PERSONA_MEDIANS: dict[str, dict[str, float]] = {
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


def _is_merchant(persona_val: Any) -> bool:
    """Check if persona represents a merchant / small business."""
    if not isinstance(persona_val, str):
        return False
    p = persona_val.strip().lower()
    return "merchant" in p or "kirana" in p or "store" in p


def _is_gig_worker(persona_val: Any) -> bool:
    """Check if persona represents a gig/platform delivery/ride-hailing worker."""
    if not isinstance(persona_val, str):
        return False
    p = persona_val.strip().lower()
    return "gig" in p or "driver" in p or "delivery" in p


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Transform raw alternative credit features into domain indices (Section 6).

    Formulas:
    - cashflow_stability = 1 - upi_inflow_volatility
    - payment_discipline = (utility_payment_regularity + telecom_recharge_consistency) / 2
    - business_activity_index = gst_filing_consistency * log1p(gst_monthly_turnover) [merchants only]
    - livelihood_activity = (mobility_active_days / 30) * (1 + mobility_distance_trend) [gig workers only]
    - income_proxy = upi_monthly_inflow_avg * upi_active_days_per_month / 30

    Missing values are imputed with persona-medians (never zero), preserving distinction
    between unknown data and adverse credit behavior.

    Args:
        df (pd.DataFrame): Raw customer records (or single row converted to DataFrame).

    Returns:
        pd.DataFrame: Augmented DataFrame containing original (imputed) features
            plus the 5 engineered indicators.
    """
    if isinstance(df, pd.Series):
        df_work = df.to_frame().T
    else:
        df_work = df.copy()

    if df_work.empty:
        # Return empty DataFrame with expected engineered columns
        out = df_work.copy()
        for col in [
            "cashflow_stability",
            "payment_discipline",
            "business_activity_index",
            "livelihood_activity",
            "income_proxy",
        ]:
            out[col] = pd.Series(dtype=float)
        return out

    # Apply persona-median imputation per Section 6
    imputer = PersonaMedianImputer()
    if len(df_work) > 1 and df_work["persona"].nunique() > 0:
        imputed_df = imputer.fit_transform(df_work)
    else:
        # Single row or uniform persona fallback: seed with DEFAULT_PERSONA_MEDIANS
        imputer.persona_medians_ = DEFAULT_PERSONA_MEDIANS
        imputer.global_medians_ = {
            k: v for k, v in DEFAULT_PERSONA_MEDIANS["First-time Borrower"].items()
        }
        imputer.numeric_cols_ = list(
            DEFAULT_PERSONA_MEDIANS["First-time Borrower"].keys()
        )
        imputer.is_fitted_ = True
        imputed_df = imputer.transform(df_work)

    out = imputed_df.copy()

    # 1. cashflow_stability = 1 - upi_inflow_volatility
    volatility = pd.to_numeric(out["upi_inflow_volatility"], errors="coerce").fillna(0.35).astype(float)
    out["cashflow_stability"] = np.clip(1.0 - volatility, 0.0, 1.0)

    # 2. payment_discipline = (utility_payment_regularity + telecom_recharge_consistency) / 2
    util_reg = pd.to_numeric(out["utility_payment_regularity"], errors="coerce").fillna(0.5).astype(float)
    tele_cons = pd.to_numeric(out["telecom_recharge_consistency"], errors="coerce").fillna(0.5).astype(float)
    out["payment_discipline"] = np.clip((util_reg + tele_cons) / 2.0, 0.0, 1.0)

    # 3. business_activity_index = gst_filing_consistency * log1p(gst_monthly_turnover) [merchants only]
    gst_turnover = np.maximum(pd.to_numeric(out["gst_monthly_turnover"], errors="coerce").fillna(0.0).astype(float), 0.0)
    gst_filing = np.clip(pd.to_numeric(out["gst_filing_consistency"], errors="coerce").fillna(0.0).astype(float), 0.0, 1.0)
    raw_business_idx = gst_filing * np.log1p(gst_turnover)

    # Mask: merchants only; 0.0 for non-merchants
    is_merchant_mask = out["persona"].apply(_is_merchant) if "persona" in out.columns else pd.Series(True, index=out.index)
    out["business_activity_index"] = np.where(is_merchant_mask, raw_business_idx, 0.0)

    # 4. livelihood_activity = (mobility_active_days / 30) * (1 + mobility_distance_trend) [gig workers only]
    mob_days = np.clip(pd.to_numeric(out["mobility_active_days"], errors="coerce").fillna(0.0).astype(float), 0.0, 30.0)
    mob_trend = pd.to_numeric(out["mobility_distance_trend"], errors="coerce").fillna(0.0).astype(float)
    raw_livelihood = (mob_days / 30.0) * (1.0 + mob_trend)
    raw_livelihood = np.clip(raw_livelihood, 0.0, 2.0)

    # Mask: gig workers only; 0.0 for non-gig workers
    is_gig_mask = out["persona"].apply(_is_gig_worker) if "persona" in out.columns else pd.Series(True, index=out.index)
    out["livelihood_activity"] = np.where(is_gig_mask, raw_livelihood, 0.0)

    # 5. income_proxy = upi_monthly_inflow_avg * upi_active_days_per_month / 30
    inflow_avg = np.maximum(pd.to_numeric(out["upi_monthly_inflow_avg"], errors="coerce").fillna(0.0).astype(float), 0.0)
    active_days = np.clip(pd.to_numeric(out["upi_active_days_per_month"], errors="coerce").fillna(0.0).astype(float), 0.0, 30.0)
    out["income_proxy"] = (inflow_avg * active_days) / 30.0

    return out
