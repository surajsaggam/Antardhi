"""Pydantic schemas for Antardhi FastAPI backend wrapper."""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = "ok"


class ApplicantSummary(BaseModel):
    """Minimal applicant metadata for selection dropdowns."""
    customer_id: str
    persona: str


class AssessmentRequest(BaseModel):
    """Assessment request containing target customer_id."""
    customer_id: str = Field(..., min_length=1, description="Unique customer ID")


class WhatIfRequest(BaseModel):
    """What-if simulation request with proposed target behavioral changes."""
    customer_id: str = Field(..., min_length=1, description="Unique customer ID")
    target_change: Dict[str, Any] = Field(..., description="Proposed behavioral adjustments")


class ReasonCode(BaseModel):
    """SHAP-derived reason code factor and explanation."""
    factor: str
    impact: str
    description: str


class AssessmentResponse(BaseModel):
    """Full credit assessment response matching score_customer() contract."""
    model_config = ConfigDict(extra="allow")

    score: int
    tier: str
    confidence: float
    anomaly_flag: str
    reason_codes: List[ReasonCode]
    recommended_loan: float
    recommended_tenure_months: int
    recommended_emi: float


class WhatIfResponse(BaseModel):
    """What-if simulation outcome matching simulate_improvement() contract."""
    model_config = ConfigDict(extra="allow")

    current_score: int
    current_tier: str
    new_score: int
    new_tier: str
    delta: int
    current_loan: float
    new_loan: float
    loan_delta: float
    recommended_loan: float
    recommended_tenure_months: int
    recommended_emi: float


class DataCoverage(BaseModel):
    """Data source availability status across 6 alternative verticals."""
    upi: bool
    gst: bool
    utility: bool
    telecom: bool
    ecommerce: bool
    mobility: bool
    available_count: int
    total_count: int = 6


class FinancialSignals(BaseModel):
    """Raw supporting financial indicators (0-100 scale)."""
    upi_activity: Optional[float] = None
    cashflow_stability: Optional[float] = None
    payment_consistency: Optional[float] = None


class ApplicantProfileResponse(BaseModel):
    """Read-only profile response for an applicant."""
    customer_id: str
    persona: str
    data_coverage: DataCoverage
    financial_signals: FinancialSignals

