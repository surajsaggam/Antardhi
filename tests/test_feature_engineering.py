"""Tests for Agent 3's app-integration helpers."""

import pandas as pd

from src.utils.helpers import coverage_percent, fingerprint_indicators, source_connection_status


def test_source_coverage_counts_consented_applicable_sources() -> None:
    statuses = source_connection_status("Small Merchant", {"upi": True, "utility": True})
    assert coverage_percent(statuses) == 50


def test_source_coverage_handles_unknown_persona() -> None:
    assert coverage_percent(source_connection_status("Unknown", {"upi": True})) == 0


def test_fingerprint_indicators_use_available_real_customer_signals() -> None:
    row = pd.Series({"upi_active_days_per_month": 15, "upi_inflow_volatility": 0.25,
                     "utility_payment_regularity": 0.8, "telecom_recharge_consistency": 0.6})

    assert fingerprint_indicators(row) == {
        "UPI Activity": 50.0,
        "Cashflow Stability": 75.0,
        "Payment Consistency": 70.0,
    }


def test_fingerprint_indicators_do_not_treat_missing_sources_as_zero() -> None:
    row = pd.Series({"upi_active_days_per_month": None, "upi_inflow_volatility": None,
                     "utility_payment_regularity": None, "telecom_recharge_consistency": None})

    assert fingerprint_indicators(row) == {
        "UPI Activity": None,
        "Cashflow Stability": None,
        "Payment Consistency": None,
    }
