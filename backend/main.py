"""FastAPI backend application for Antardhi credit engine.

Thin API adapter exposing alternative data scoring and simulation endpoints.
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

# Ensure repository root is on sys.path for direct module discovery
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.models import score_customer
from src.simulation.what_if import simulate_improvement
from src.utils.helpers import fingerprint_indicators
from backend.schemas import (
    ApplicantProfileResponse,
    ApplicantSummary,
    AssessmentRequest,
    AssessmentResponse,
    HealthResponse,
    WhatIfRequest,
    WhatIfResponse,
)

DATA_PATH = REPO_ROOT / "data" / "synthetic_credit_data.csv"

_dataset: Optional[pd.DataFrame] = None


def get_dataset() -> pd.DataFrame:
    """Retrieve or load cached synthetic credit dataset.

    Raises:
        FileNotFoundError: If synthetic_credit_data.csv does not exist.
        ValueError: If required columns are missing.
    """
    global _dataset
    if _dataset is None:
        if not DATA_PATH.exists():
            raise FileNotFoundError(f"Synthetic credit dataset not found at {DATA_PATH}")
        df = pd.read_csv(DATA_PATH)
        if "customer_id" not in df.columns or "persona" not in df.columns:
            raise ValueError("Required columns ('customer_id', 'persona') missing from dataset")
        _dataset = df
    return _dataset


def get_customer_row(customer_id: str) -> pd.Series:
    """Lookup applicant row by customer_id.

    Raises:
        HTTPException: 400 if ID is blank, 500 if dataset missing, 404 if not found.
    """
    clean_id = customer_id.strip() if customer_id else ""
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customer_id must not be empty",
        )
    try:
        df = get_dataset()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset error: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading dataset: {str(e)}",
        )

    matches = df.loc[df["customer_id"] == clean_id]
    if matches.empty:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer '{clean_id}' not found",
        )
    return matches.iloc[0]


app = FastAPI(
    title="Antardhi Credit Engine API",
    description="Thin FastAPI API adapter wrapper for Antardhi alternative data credit scoring engine.",
    version="0.1.0",
)

# CORS configuration allowing frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/api/applicants", response_model=List[ApplicantSummary])
def get_applicants() -> List[Dict[str, str]]:
    """List applicant IDs and personas from synthetic dataset without calculating scores."""
    try:
        df = get_dataset()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dataset error: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading applicants: {str(e)}",
        )

    records = df[["customer_id", "persona"]].to_dict(orient="records")
    return records


@app.post("/api/assessment", response_model=AssessmentResponse)
def assessment(request: AssessmentRequest) -> Dict[str, Any]:
    """Score a customer and return credit decision, explainability, and loan recommendations.

    Calls score_customer(customer_row) and returns the exact dictionary returned by score_customer().
    Do not alter, rename, recalculate, or augment its values.
    """
    customer_row = get_customer_row(request.customer_id)
    try:
        result = score_customer(customer_row)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assessment error: {str(e)}",
        )


@app.post("/api/what-if", response_model=WhatIfResponse)
def what_if(request: WhatIfRequest) -> Dict[str, Any]:
    """Simulate credit score, tier, and loan eligibility improvement.

    Calls simulate_improvement(customer_row, target_change) and returns its result unchanged.
    """
    customer_row = get_customer_row(request.customer_id)
    try:
        result = simulate_improvement(customer_row, request.target_change)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"What-if simulation error: {str(e)}",
        )


@app.get("/api/applicants/{customer_id}/profile", response_model=ApplicantProfileResponse)
def get_applicant_profile(customer_id: str) -> Dict[str, Any]:
    """Retrieve applicant data source availability and supporting raw financial signals.

    Data sources (UPI, GST, Utility, Telecom, E-commerce, Mobility) are derived from
    the applicant's actual raw values in synthetic_credit_data.csv.
    Financial signals are derived using src.utils.helpers.fingerprint_indicators.
    """
    customer_row = get_customer_row(customer_id)

    upi_avail = bool(pd.notna(customer_row.get("upi_monthly_inflow_avg")))
    gst_avail = bool(pd.notna(customer_row.get("gst_monthly_turnover")))
    utility_avail = bool(pd.notna(customer_row.get("utility_payment_regularity")))
    telecom_avail = bool(pd.notna(customer_row.get("telecom_recharge_frequency")))
    ecommerce_avail = bool(pd.notna(customer_row.get("ecommerce_txn_frequency")))
    mobility_avail = bool(pd.notna(customer_row.get("mobility_active_days")))

    available_count = int(
        upi_avail
        + gst_avail
        + utility_avail
        + telecom_avail
        + ecommerce_avail
        + mobility_avail
    )

    signals = fingerprint_indicators(customer_row)
    upi_act = (
        round(float(signals["UPI Activity"]), 1)
        if signals.get("UPI Activity") is not None
        else None
    )
    cash_stab = (
        round(float(signals["Cashflow Stability"]), 1)
        if signals.get("Cashflow Stability") is not None
        else None
    )
    pay_cons = (
        round(float(signals["Payment Consistency"]), 1)
        if signals.get("Payment Consistency") is not None
        else None
    )

    return {
        "customer_id": str(customer_row["customer_id"]),
        "persona": str(customer_row["persona"]),
        "data_coverage": {
            "upi": upi_avail,
            "gst": gst_avail,
            "utility": utility_avail,
            "telecom": telecom_avail,
            "ecommerce": ecommerce_avail,
            "mobility": mobility_avail,
            "available_count": available_count,
            "total_count": 6,
        },
        "financial_signals": {
            "upi_activity": upi_act,
            "cashflow_stability": cash_stab,
            "payment_consistency": pay_cons,
        },
    }

