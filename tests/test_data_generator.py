"""Unit tests for synthetic data generation, preprocessing, and feature engineering.

Owned by Agent 1 (Data & Features).
Validates Section 4 missingness, Section 5.1 schema, Section 5.2 latent correlation,
and Section 6 feature formulas.
"""

from __future__ import annotations

import uuid
import numpy as np
import pandas as pd
import pytest

from src.data.synthetic_generator import (
    generate_synthetic_dataset,
    generate_with_latent,
    PERSONAS,
    SCHEMA_COLUMNS,
)
from src.data.preprocessor import (
    PersonaMedianImputer,
    impute_missing_by_persona,
)
from src.features.feature_engineering import engineer_features


# =============================================================================
# 1. Synthetic Dataset Schema & Generation Tests
# =============================================================================

def test_generate_synthetic_dataset_row_count():
    """Verify generated dataset row count matches default 8,000 (within 8,000-10,000 range)."""
    df = generate_synthetic_dataset(n_samples=8000, seed=42)
    assert len(df) == 8000
    assert 8000 <= len(df) <= 10000


def test_generate_synthetic_dataset_custom_samples():
    """Verify generator scales accurately with small and custom sample sizes (edge case)."""
    df_small = generate_synthetic_dataset(n_samples=16, seed=123)
    assert len(df_small) == 16

    df_10k = generate_synthetic_dataset(n_samples=10000, seed=42)
    assert len(df_10k) == 10000
    assert 8000 <= len(df_10k) <= 10000


def test_schema_exact_columns_and_order():
    """Verify DataFrame contains EXACTLY the 20 columns from Section 5.1 in exact order."""
    df = generate_synthetic_dataset(n_samples=100, seed=42)
    assert list(df.columns) == SCHEMA_COLUMNS
    assert len(df.columns) == 20
    # Crucial rule: latent_creditworthiness must NOT be in the shipped dataset
    assert "latent_creditworthiness" not in df.columns


def test_schema_data_types_and_ranges():
    """Verify data types and value constraints for Section 5.1 schema."""
    df = generate_synthetic_dataset(n_samples=500, seed=42)

    # 1. customer_id: valid UUID format
    for cid in df["customer_id"].head(50):
        val = uuid.UUID(cid, version=4)
        assert str(val) == cid

    # 2. persona: exactly one of 4 defined personas
    assert set(df["persona"].unique()).issubset(set(PERSONAS))

    # 3. numeric ranges
    assert (df["upi_monthly_inflow_avg"] > 0).all()
    assert (df["upi_inflow_volatility"] >= 0).all()
    assert df["upi_active_days_per_month"].between(0, 30).all()

    # 4. utility & telecom
    valid_util = df["utility_payment_regularity"].dropna()
    assert valid_util.between(0.0, 1.0).all()

    valid_tele_cons = df["telecom_recharge_consistency"].dropna()
    assert valid_tele_cons.between(0.0, 1.0).all()

    # 5. bureau flag and score logic
    no_bureau = df[~df["existing_bureau_flag"]]
    assert no_bureau["existing_bureau_score_partial"].isna().all(), (
        "bureau score must be NaN when existing_bureau_flag is False"
    )

    has_bureau = df[df["existing_bureau_flag"]]
    if not has_bureau.empty:
        assert has_bureau["existing_bureau_score_partial"].notna().all()
        assert has_bureau["existing_bureau_score_partial"].between(300.0, 900.0).all()

    # 6. confidence score drivers
    assert df["months_of_data_available"].min() >= 3
    assert df["num_sources_available"].between(1, 6).all()

    # 7. default_label
    assert set(df["default_label"].unique()).issubset({0, 1})


def test_persona_proportions_balanced():
    """Verify persona proportions are approximately 25% each."""
    df = generate_synthetic_dataset(n_samples=8000, seed=42)
    proportions = df["persona"].value_counts(normalize=True)

    for persona in PERSONAS:
        prop = proportions.get(persona, 0.0)
        # Should be within 24% to 26% (tight balance)
        assert 0.24 <= prop <= 0.26, f"Persona '{persona}' proportion {prop} is outside ~25%."


# =============================================================================
# 2. Section 4 Persona-Specific Missingness Tests
# =============================================================================

def test_persona_specific_missingness():
    """Verify deliberate missingness strictly matching Section 4 matrix."""
    df = generate_synthetic_dataset(n_samples=8000, seed=42)

    merchants = df[df["persona"] == "Small Merchant"]
    gigs = df[df["persona"] == "Gig Worker"]
    first_time = df[df["persona"] == "First-time Borrower"]
    rural = df[df["persona"] == "Informal/Rural Worker"]

    # 1. GST: Absent for Gig Worker, First-time Borrower, and Informal/Rural
    assert gigs["gst_monthly_turnover"].isna().all()
    assert gigs["gst_filing_consistency"].isna().all()
    assert first_time["gst_monthly_turnover"].isna().all()
    assert first_time["gst_filing_consistency"].isna().all()
    assert rural["gst_monthly_turnover"].isna().all()
    assert rural["gst_filing_consistency"].isna().all()

    # GST must be predominantly available for Small Merchants (>90%)
    assert merchants["gst_monthly_turnover"].notna().mean() > 0.90
    assert merchants["gst_filing_consistency"].notna().mean() > 0.90

    # 2. E-commerce: Absent for Informal/Rural
    assert rural["ecommerce_txn_frequency"].isna().all()
    assert rural["ecommerce_return_rate"].isna().all()

    # E-commerce available for Small Merchant (>80%)
    assert merchants["ecommerce_txn_frequency"].notna().mean() > 0.80

    # 3. Mobility: Absent for Informal/Rural
    assert rural["mobility_active_days"].isna().all()
    assert rural["mobility_distance_trend"].isna().all()

    # Mobility available for Gig Worker (>90%)
    assert gigs["mobility_active_days"].notna().mean() > 0.90

    # Mobility weak for Merchants and First-time borrowers (>70% missing)
    assert merchants["mobility_active_days"].isna().mean() > 0.70
    assert first_time["mobility_active_days"].isna().mean() > 0.70


# =============================================================================
# 3. Latent Creditworthiness Correlation Tests
# =============================================================================

def test_features_correlated_with_latent():
    """Verify alternative data features have meaningful correlation with latent creditworthiness."""
    df, latent = generate_with_latent(n_samples=8000, seed=42)

    # 1. UPI Inflow: Positive correlation
    corr_inflow = np.corrcoef(latent, df["upi_monthly_inflow_avg"])[0, 1]
    assert corr_inflow > 0.35, f"Inflow correlation {corr_inflow} too low."

    # 2. UPI Volatility: Negative correlation (higher creditworthiness -> lower volatility)
    corr_vol = np.corrcoef(latent, df["upi_inflow_volatility"])[0, 1]
    assert corr_vol < -0.35, f"Volatility correlation {corr_vol} should be negative."

    # 3. UPI Active Days: Positive correlation
    corr_days = np.corrcoef(latent, df["upi_active_days_per_month"])[0, 1]
    assert corr_days > 0.35, f"Active days correlation {corr_days} too low."

    # 4. Utility delay: Negative correlation (higher creditworthiness -> lower delay)
    valid_util = df["utility_avg_delay_days"].notna()
    corr_delay = np.corrcoef(latent[valid_util], df.loc[valid_util, "utility_avg_delay_days"])[0, 1]
    assert corr_delay < -0.35, f"Utility delay correlation {corr_delay} should be negative."

    # 5. Default Label: Significant negative correlation with latent creditworthiness
    corr_default = np.corrcoef(latent, df["default_label"])[0, 1]
    assert corr_default < -0.30, f"Default correlation {corr_default} should be strongly negative."

    # Default rate should be realistic (10% - 25%)
    default_rate = df["default_label"].mean()
    assert 0.10 <= default_rate <= 0.25, f"Unrealistic default rate: {default_rate}."


# =============================================================================
# 4. Persona Median Imputation Tests
# =============================================================================

def test_persona_median_imputer():
    """Verify PersonaMedianImputer imputes missing values with persona medians, never zero."""
    df = generate_synthetic_dataset(n_samples=400, seed=42)
    imputer = PersonaMedianImputer()
    imputer.fit(df)

    # Create test sample with NaN values
    test_sample = df.head(10).copy()
    test_sample.loc[test_sample.index[0], "telecom_recharge_consistency"] = np.nan
    test_sample.loc[test_sample.index[1], "utility_payment_regularity"] = np.nan

    imputed = imputer.transform(test_sample)

    assert not imputed["telecom_recharge_consistency"].isna().any()
    assert not imputed["utility_payment_regularity"].isna().any()

    # Confirm imputed value is positive median, not zero
    assert (imputed["telecom_recharge_consistency"] > 0).all()
    assert (imputed["utility_payment_regularity"] > 0).all()


def test_persona_median_imputer_edge_cases():
    """Verify PersonaMedianImputer edge cases: empty DataFrame and unfitted transform."""
    imputer = PersonaMedianImputer()
    with pytest.raises(ValueError):
        imputer.fit(pd.DataFrame())

    with pytest.raises(RuntimeError):
        imputer.transform(pd.DataFrame({"persona": ["Gig Worker"]}))


# =============================================================================
# 5. Feature Engineering Tests
# =============================================================================

def test_engineer_features_formulas():
    """Verify Section 6 feature engineering formulas."""
    df = generate_synthetic_dataset(n_samples=200, seed=42)
    feat_df = engineer_features(df)

    # 1. cashflow_stability = 1 - upi_inflow_volatility
    assert "cashflow_stability" in feat_df.columns
    assert feat_df["cashflow_stability"].between(0.0, 1.0).all()

    # 2. payment_discipline = (utility_payment_regularity + telecom_recharge_consistency) / 2
    assert "payment_discipline" in feat_df.columns
    assert feat_df["payment_discipline"].between(0.0, 1.0).all()

    # 3. business_activity_index = gst_filing_consistency * log1p(gst_monthly_turnover) [merchants only]
    assert "business_activity_index" in feat_df.columns
    merchants = feat_df[feat_df["persona"] == "Small Merchant"]
    non_merchants = feat_df[feat_df["persona"] != "Small Merchant"]
    assert (merchants["business_activity_index"] > 0).mean() > 0.85
    assert (non_merchants["business_activity_index"] == 0.0).all()

    # 4. livelihood_activity = (mobility_active_days / 30) * (1 + mobility_distance_trend) [gig workers only]
    assert "livelihood_activity" in feat_df.columns
    gigs = feat_df[feat_df["persona"] == "Gig Worker"]
    non_gigs = feat_df[feat_df["persona"] != "Gig Worker"]
    assert (gigs["livelihood_activity"] > 0).mean() > 0.85
    assert (non_gigs["livelihood_activity"] == 0.0).all()

    # 5. income_proxy = upi_monthly_inflow_avg * upi_active_days_per_month / 30
    assert "income_proxy" in feat_df.columns
    assert (feat_df["income_proxy"] > 0).all()


def test_engineer_features_single_row_and_empty():
    """Verify feature engineering handles single-row input and empty DataFrame (edge cases)."""
    df = generate_synthetic_dataset(n_samples=10, seed=42)

    # Single row DataFrame
    row_df = df.iloc[[0]]
    single_res = engineer_features(row_df)
    assert len(single_res) == 1
    assert "cashflow_stability" in single_res.columns

    # Single Series
    series = df.iloc[0]
    series_res = engineer_features(series)
    assert "cashflow_stability" in series_res.columns

    # Empty DataFrame
    empty_df = pd.DataFrame(columns=SCHEMA_COLUMNS)
    empty_res = engineer_features(empty_df)
    assert "cashflow_stability" in empty_res.columns
    assert len(empty_res) == 0


def test_generator_deterministic_reproducibility():
    """Verify identical random seeds produce byte-for-byte identical datasets."""
    df1 = generate_synthetic_dataset(n_samples=500, seed=99)
    df2 = generate_synthetic_dataset(n_samples=500, seed=99)
    pd.testing.assert_frame_equal(df1, df2)
