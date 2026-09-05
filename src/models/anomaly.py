"""Anomaly and fraud detection module.

Follows Section 9 and Section 13 of PROJECT_SPEC.md.
Uses Isolation Forest completely independent of the credit scoring model.
Output tier: 'Low', 'Medium', or 'High'.
Never blends into the credit score.
"""

import os
from typing import Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from src.models.features import extract_features, FEATURE_COLUMNS


class AnomalyDetector:
    """Isolation Forest anomaly detector with calibrated risk tier thresholds."""

    def __init__(self, contamination: float = 0.05, random_state: int = 42):
        self.model = IsolationForest(
            n_estimators=100,
            contamination=contamination,
            random_state=random_state,
            n_jobs=-1
        )
        self.high_threshold: float = -0.12
        self.medium_threshold: float = 0.00
        self.is_fitted: bool = False

    def fit(self, X: pd.DataFrame) -> "AnomalyDetector":
        """Fit Isolation Forest on features and calibrate tier thresholds."""
        # Ensure numerical columns only
        features = X[FEATURE_COLUMNS] if all(c in X.columns for c in FEATURE_COLUMNS) else X
        self.model.fit(features)
        scores = self.model.decision_function(features)

        # Calibrate thresholds based on percentiles:
        # Bottom 5% = High anomaly risk
        # 5% - 20% = Medium anomaly risk
        # Top 80% = Low anomaly risk
        self.high_threshold = float(np.percentile(scores, 5))
        self.medium_threshold = float(np.percentile(scores, 20))
        self.is_fitted = True
        return self

    def predict_tier(self, X_row: pd.DataFrame | pd.Series) -> str:
        """Predict anomaly tier: 'Low', 'Medium', or 'High'."""
        if not self.is_fitted:
            # Fallback heuristic if not yet fitted
            return "Low"

        if isinstance(X_row, pd.Series):
            df_features = extract_features(X_row)
        else:
            df_features = extract_features(X_row.iloc[0])

        score = float(self.model.decision_function(df_features[FEATURE_COLUMNS])[0])

        if score <= self.high_threshold:
            return "High"
        elif score <= self.medium_threshold:
            return "Medium"
        else:
            return "Low"


# Global singleton detector
_ANOMALY_DETECTOR: Optional[AnomalyDetector] = None


def train_anomaly_model(df: pd.DataFrame) -> AnomalyDetector:
    """Train and return a new IsolationForest AnomalyDetector."""
    global _ANOMALY_DETECTOR
    X = extract_features(df)
    detector = AnomalyDetector().fit(X)
    _ANOMALY_DETECTOR = detector
    return detector


def get_anomaly_model() -> AnomalyDetector:
    """Get the cached anomaly detector or train a default one on synthetic data."""
    global _ANOMALY_DETECTOR
    if _ANOMALY_DETECTOR is None:
        csv_path = "data/synthetic_credit_data.csv"
        if not os.path.exists(csv_path) and os.path.exists(os.path.join("..", csv_path)):
            csv_path = os.path.join("..", csv_path)
        try:
            df = pd.read_csv(csv_path)
            _ANOMALY_DETECTOR = train_anomaly_model(df)
        except Exception:
            # Create a fitted detector on a synthetic sample if CSV unreadable
            dummy_data = pd.DataFrame([
                {
                    "persona": "First-time Borrower",
                    "upi_monthly_inflow_avg": 40000,
                    "upi_inflow_volatility": 0.2,
                    "upi_active_days_per_month": 22,
                    "utility_payment_regularity": 0.9,
                    "months_of_data_available": 12,
                    "num_sources_available": 3,
                }
                for _ in range(50)
            ])
            _ANOMALY_DETECTOR = train_anomaly_model(dummy_data)
    return _ANOMALY_DETECTOR


def compute_anomaly_flag(
    customer_row: pd.Series,
    model: Optional[AnomalyDetector] = None
) -> str:
    """Compute anomaly/fraud flag for a single customer.

    CONTRACT (PROJECT_SPEC.md Section 9 & 13):
        Returns exactly one of: 'Low', 'Medium', 'High'.
        Completely separate from credit score.

    Args:
        customer_row (pd.Series): Single applicant record.
        model (Optional[AnomalyDetector]): Detector instance.

    Returns:
        str: 'Low', 'Medium', or 'High'
    """
    detector = model or get_anomaly_model()
    tier = detector.predict_tier(customer_row)
    if tier not in {"Low", "Medium", "High"}:
        tier = "Low"
    return tier
