"""Synthetic data generator for Antardhi alternative credit engine.

Generates realistic multi-vertical datasets for thin-file and informal borrowers
across four personas:
1. Small Merchant
2. Gig Worker
3. First-time Borrower
4. Informal/Rural Worker

Note on Sourcing:
Prototype uses a parameterized synthetic data generator due to the absence of
production GST/UPI/AA access; see src/data/synthetic_generator.py.

All features are generated as functions of a latent 'true creditworthiness'
signal plus persona-specific noise and deliberate missingness conforming to
Section 4 and Section 5.1 of PROJECT_SPEC.md.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Final
import uuid

import numpy as np
import pandas as pd
from scipy.special import expit

# Personas matching Section 4 & Section 7
PERSONAS: Final[list[str]] = [
    "Small Merchant",
    "Gig Worker",
    "First-time Borrower",
    "Informal/Rural Worker",
]

# Section 5.1 Exact Schema (20 columns)
SCHEMA_COLUMNS: Final[list[str]] = [
    "customer_id",
    "persona",
    "upi_monthly_inflow_avg",
    "upi_inflow_volatility",
    "upi_active_days_per_month",
    "gst_monthly_turnover",
    "gst_filing_consistency",
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
    "default_label",
]


def _allocate_personas(n_samples: int) -> list[str]:
    """Allocate persona labels ensuring approximately 25% for each of the 4 personas.

    Args:
        n_samples (int): Total number of samples.

    Returns:
        list[str]: Array of persona strings evenly partitioned.
    """
    base_count = n_samples // len(PERSONAS)
    remainder = n_samples % len(PERSONAS)

    persona_list: list[str] = []
    for idx, persona in enumerate(PERSONAS):
        count = base_count + (1 if idx < remainder else 0)
        persona_list.extend([persona] * count)

    return persona_list


def generate_with_latent(
    n_samples: int = 8000,
    seed: int = 42,
) -> tuple[pd.DataFrame, pd.Series]:
    """Generate synthetic dataset along with the unobservable latent creditworthiness.

    Used for validation and statistical inspection of correlation structures.

    Args:
        n_samples (int): Number of synthetic customer records. Defaults to 8000.
        seed (int): Random seed for reproducibility. Defaults to 42.

    Returns:
        tuple[pd.DataFrame, pd.Series]: (DataFrame conforming to Section 5.1,
            Series of latent creditworthiness values in [0, 1]).
    """
    if n_samples <= 0:
        raise ValueError("n_samples must be a positive integer.")

    rng = np.random.default_rng(seed)

    # 1. Latent true creditworthiness (continuous in [0, 1])
    # Drawn from Beta(2.5, 2.5) for a realistic bell-shaped borrower population
    latent_creditworthiness = rng.beta(a=2.5, b=2.5, size=n_samples)

    # Assign personas in balanced ~25% proportions
    personas = _allocate_personas(n_samples)
    # Shuffle alignment slightly while maintaining deterministic seed
    perm = rng.permutation(n_samples)
    personas = [personas[i] for i in perm]
    persona_arr = np.array(personas)

    customer_ids = [str(uuid.UUID(bytes=rng.bytes(16), version=4)) for _ in range(n_samples)]

    # Arrays for features
    upi_inflow = np.zeros(n_samples, dtype=float)
    upi_volatility = np.zeros(n_samples, dtype=float)
    upi_active_days = np.zeros(n_samples, dtype=int)

    gst_turnover = np.full(n_samples, np.nan, dtype=float)
    gst_filing = np.full(n_samples, np.nan, dtype=float)

    utility_regularity = np.full(n_samples, np.nan, dtype=float)
    utility_delay = np.full(n_samples, np.nan, dtype=float)

    telecom_freq = np.full(n_samples, np.nan, dtype=float)
    telecom_consistency = np.full(n_samples, np.nan, dtype=float)

    ecom_freq = np.full(n_samples, np.nan, dtype=float)
    ecom_return_rate = np.full(n_samples, np.nan, dtype=float)

    mobility_days = np.full(n_samples, np.nan, dtype=float)
    mobility_trend = np.full(n_samples, np.nan, dtype=float)

    bureau_flag = np.zeros(n_samples, dtype=bool)
    bureau_score = np.full(n_samples, np.nan, dtype=float)

    months_data = np.zeros(n_samples, dtype=int)

    for i in range(n_samples):
        theta = latent_creditworthiness[i]
        p = persona_arr[i]

        # -------------------------------------------------------------
        # Vertical 1: UPI Cashflow (Universal alt-data rail)
        # -------------------------------------------------------------
        if p == "Small Merchant":
            base_inflow = 35000.0 + 175000.0 * theta
            inflow_noise = rng.normal(0.0, 15000.0)
            upi_inflow[i] = np.clip(base_inflow + inflow_noise, 15000.0, 500000.0)

            base_vol = 0.48 - 0.28 * theta
            vol_noise = rng.normal(0.0, 0.05)
            upi_volatility[i] = np.clip(base_vol + vol_noise, 0.08, 0.80)

            base_days = 19.0 + 9.5 * theta
            days_noise = rng.normal(0.0, 1.5)
            upi_active_days[i] = int(np.clip(np.round(base_days + days_noise), 1, 30))

        elif p == "Gig Worker":
            base_inflow = 16000.0 + 38000.0 * theta
            inflow_noise = rng.normal(0.0, 4500.0)
            upi_inflow[i] = np.clip(base_inflow + inflow_noise, 8000.0, 85000.0)

            base_vol = 0.54 - 0.30 * theta
            vol_noise = rng.normal(0.0, 0.06)
            upi_volatility[i] = np.clip(base_vol + vol_noise, 0.12, 0.85)

            base_days = 17.0 + 11.0 * theta
            days_noise = rng.normal(0.0, 1.8)
            upi_active_days[i] = int(np.clip(np.round(base_days + days_noise), 1, 30))

        elif p == "First-time Borrower":
            base_inflow = 22000.0 + 68000.0 * theta
            inflow_noise = rng.normal(0.0, 6000.0)
            upi_inflow[i] = np.clip(base_inflow + inflow_noise, 12000.0, 150000.0)

            base_vol = 0.32 - 0.22 * theta
            vol_noise = rng.normal(0.0, 0.04)
            upi_volatility[i] = np.clip(base_vol + vol_noise, 0.05, 0.65)

            base_days = 12.0 + 15.0 * theta
            days_noise = rng.normal(0.0, 2.0)
            upi_active_days[i] = int(np.clip(np.round(base_days + days_noise), 1, 30))

        else:  # Informal/Rural Worker
            base_inflow = 7500.0 + 26000.0 * theta
            inflow_noise = rng.normal(0.0, 2800.0)
            upi_inflow[i] = np.clip(base_inflow + inflow_noise, 4000.0, 60000.0)

            base_vol = 0.65 - 0.35 * theta
            vol_noise = rng.normal(0.0, 0.07)
            upi_volatility[i] = np.clip(base_vol + vol_noise, 0.15, 0.95)

            base_days = 7.0 + 14.0 * theta
            days_noise = rng.normal(0.0, 2.2)
            upi_active_days[i] = int(np.clip(np.round(base_days + days_noise), 1, 30))

        # -------------------------------------------------------------
        # Vertical 2: GST Turnover & Compliance (Merchants only)
        # -------------------------------------------------------------
        if p == "Small Merchant":
            # ~96% of small merchants have active GSTN filing footprint
            if rng.random() < 0.96:
                base_turnover = 65000.0 + 380000.0 * theta
                t_noise = rng.normal(0.0, 25000.0)
                gst_turnover[i] = np.clip(base_turnover + t_noise, 25000.0, 800000.0)

                base_filing = 0.48 + 0.49 * theta
                f_noise = rng.normal(0.0, 0.06)
                gst_filing[i] = np.clip(base_filing + f_noise, 0.10, 1.0)
        # For Gig Worker, First-time Borrower, Informal/Rural: remains np.nan (absent)

        # -------------------------------------------------------------
        # Vertical 3: Utility Bill Payments
        # -------------------------------------------------------------
        # Availability: Small Merchant (95%), First-time Borrower (95%), Informal/Rural (90%), Gig Worker (weak: 25%)
        has_utility = (
            (p == "Small Merchant" and rng.random() < 0.95)
            or (p == "First-time Borrower" and rng.random() < 0.95)
            or (p == "Informal/Rural Worker" and rng.random() < 0.90)
            or (p == "Gig Worker" and rng.random() < 0.25)
        )
        if has_utility:
            base_reg = 0.42 + 0.54 * theta
            reg_noise = rng.normal(0.0, 0.06)
            utility_regularity[i] = np.clip(base_reg + reg_noise, 0.0, 1.0)

            base_delay = 18.0 * (1.0 - theta)
            delay_noise = rng.normal(0.0, 2.0)
            utility_delay[i] = np.clip(base_delay + delay_noise, 0.0, 45.0)

        # -------------------------------------------------------------
        # Vertical 4: Telecom Recharge Activity
        # -------------------------------------------------------------
        # Availability: Gig Worker (95%), Informal/Rural (95%), Small Merchant (weak: 30%), First-time Borrower (weak: 35%)
        has_telecom = (
            (p == "Gig Worker" and rng.random() < 0.95)
            or (p == "Informal/Rural Worker" and rng.random() < 0.95)
            or (p == "Small Merchant" and rng.random() < 0.30)
            or (p == "First-time Borrower" and rng.random() < 0.35)
        )
        if has_telecom:
            base_freq = 1.0 + 2.6 * theta
            freq_noise = rng.normal(0.0, 0.3)
            telecom_freq[i] = np.clip(base_freq + freq_noise, 0.5, 6.0)

            base_t_cons = 0.40 + 0.56 * theta
            t_noise = rng.normal(0.0, 0.06)
            telecom_consistency[i] = np.clip(base_t_cons + t_noise, 0.05, 1.0)

        # -------------------------------------------------------------
        # Vertical 5: E-Commerce Activity
        # -------------------------------------------------------------
        # Availability: Small Merchant (90%), Gig Worker (weak: 25%), First-time Borrower (weak/moderate: 45%), Informal/Rural (absent: 0%)
        has_ecom = (
            (p == "Small Merchant" and rng.random() < 0.90)
            or (p == "First-time Borrower" and rng.random() < 0.45)
            or (p == "Gig Worker" and rng.random() < 0.25)
        )
        if has_ecom:
            base_ecom_freq = 1.5 + 8.5 * theta
            e_noise = rng.normal(0.0, 1.0)
            ecom_freq[i] = np.clip(base_ecom_freq + e_noise, 0.5, 25.0)

            base_ret = 0.26 - 0.19 * theta
            ret_noise = rng.normal(0.0, 0.03)
            ecom_return_rate[i] = np.clip(base_ret + ret_noise, 0.0, 0.45)

        # -------------------------------------------------------------
        # Vertical 6: Mobility & Location Telemetry
        # -------------------------------------------------------------
        # Availability: Gig Worker (95%), Small Merchant (weak: 15%), First-time Borrower (weak: 12%), Informal/Rural (absent: 0%)
        has_mobility = (
            (p == "Gig Worker" and rng.random() < 0.95)
            or (p == "Small Merchant" and rng.random() < 0.15)
            or (p == "First-time Borrower" and rng.random() < 0.12)
        )
        if has_mobility:
            base_mob_days = 11.0 + 17.0 * theta
            mob_noise = rng.normal(0.0, 2.0)
            mobility_days[i] = np.clip(base_mob_days + mob_noise, 0.0, 30.0)

            base_trend = -0.15 + 0.38 * theta
            trend_noise = rng.normal(0.0, 0.06)
            mobility_trend[i] = np.clip(base_trend + trend_noise, -0.50, 0.65)

        # -------------------------------------------------------------
        # Bureau Status (Thin or NTC)
        # -------------------------------------------------------------
        # First-time borrower has thin bureau file flag (~72%), Small Merchant (~24%), Gig (~12%), Rural (~4%)
        bureau_prob = (
            0.72 if p == "First-time Borrower"
            else 0.24 if p == "Small Merchant"
            else 0.12 if p == "Gig Worker"
            else 0.04
        )
        has_bureau = rng.random() < bureau_prob
        bureau_flag[i] = has_bureau
        if has_bureau:
            # Score in [300, 900]
            base_b_score = 420.0 + 410.0 * theta
            b_noise = rng.normal(0.0, 35.0)
            bureau_score[i] = np.clip(np.round(base_b_score + b_noise), 300.0, 900.0)
        else:
            bureau_score[i] = np.nan

        # -------------------------------------------------------------
        # Data Maturity (months available)
        # -------------------------------------------------------------
        base_months = 6.0 + 26.0 * theta
        m_noise = rng.normal(0.0, 3.0)
        months_data[i] = int(np.clip(np.round(base_months + m_noise), 3, 36))

    # Calculate exact num_sources_available out of 6 verticals for each applicant
    num_sources = np.zeros(n_samples, dtype=int)
    for i in range(n_samples):
        count = 1  # UPI is always present
        if not np.isnan(gst_turnover[i]):
            count += 1
        if not np.isnan(utility_regularity[i]):
            count += 1
        if not np.isnan(telecom_freq[i]):
            count += 1
        if not np.isnan(ecom_freq[i]):
            count += 1
        if not np.isnan(mobility_days[i]):
            count += 1
        num_sources[i] = count

    # -----------------------------------------------------------------
    # Ground Truth Default Label
    # Real-world non-deterministic credit default:
    # Logistic probability inversely coupled to latent creditworthiness
    # -----------------------------------------------------------------
    logit = -1.8 - 5.5 * (latent_creditworthiness - 0.50) + rng.normal(0.0, 0.20, size=n_samples)
    default_prob = expit(logit)
    default_label = (rng.random(size=n_samples) < default_prob).astype(int)

    df = pd.DataFrame(
        {
            "customer_id": customer_ids,
            "persona": persona_arr,
            "upi_monthly_inflow_avg": np.round(upi_inflow, 2),
            "upi_inflow_volatility": np.round(upi_volatility, 4),
            "upi_active_days_per_month": upi_active_days,
            "gst_monthly_turnover": np.round(gst_turnover, 2),
            "gst_filing_consistency": np.round(gst_filing, 4),
            "utility_payment_regularity": np.round(utility_regularity, 4),
            "utility_avg_delay_days": np.round(utility_delay, 2),
            "telecom_recharge_frequency": np.round(telecom_freq, 2),
            "telecom_recharge_consistency": np.round(telecom_consistency, 4),
            "ecommerce_txn_frequency": np.round(ecom_freq, 2),
            "ecommerce_return_rate": np.round(ecom_return_rate, 4),
            "mobility_active_days": np.round(mobility_days, 2),
            "mobility_distance_trend": np.round(mobility_trend, 4),
            "existing_bureau_flag": bureau_flag,
            "existing_bureau_score_partial": np.round(bureau_score, 1),
            "months_of_data_available": months_data,
            "num_sources_available": num_sources,
            "default_label": default_label,
        }
    )

    # Ensure column ordering matches Section 5.1 exactly
    df = df[SCHEMA_COLUMNS]

    latent_series = pd.Series(
        latent_creditworthiness,
        name="latent_creditworthiness",
        index=df.index,
    )
    return df, latent_series


def generate_synthetic_dataset(
    n_samples: int = 8000,
    seed: int = 42,
) -> pd.DataFrame:
    """Generate the synthetic alternative credit dataset conforming to Section 13 contract.

    Args:
        n_samples (int): Total number of rows to generate. Defaults to 8000.
        seed (int): Random seed for reproducibility. Defaults to 42.

    Returns:
        pd.DataFrame: DataFrame containing exactly the 20 columns specified in Section 5.1.
    """
    df, _ = generate_with_latent(n_samples=n_samples, seed=seed)
    return df


def main() -> None:
    """CLI entry point for parameterized synthetic data generation."""
    parser = argparse.ArgumentParser(
        description="Antardhi Alternative Credit Data Synthesizer (Section 5.1 & 5.2)."
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=8000,
        help="Number of customer records to synthesize (default: 8000).",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/synthetic_credit_data.csv",
        help="Target output CSV filepath (default: data/synthetic_credit_data.csv).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed (default: 42).",
    )

    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating {args.samples} synthetic alternative credit profiles (seed={args.seed})...")
    df = generate_synthetic_dataset(n_samples=args.samples, seed=args.seed)

    df.to_csv(out_path, index=False)
    print(f"Successfully saved {len(df)} records to {out_path}.")
    print(f"Schema columns ({len(df.columns)}): {list(df.columns)}")
    print("Persona distribution:")
    print(df["persona"].value_counts(normalize=True).to_string())


if __name__ == "__main__":
    main()
