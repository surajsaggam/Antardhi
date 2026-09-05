"""Confidence score module.

Follows Section 8 and Section 13 of PROJECT_SPEC.md.
Confidence is strictly separated from the creditworthiness score.
"""

import numpy as np
import pandas as pd


def compute_confidence_score(customer_row: pd.Series) -> float:
    """Compute confidence score reflecting data coverage and history depth.

    Formula (PROJECT_SPEC.md Section 8):
        Confidence = clip(
            20 * log1p(months_of_data_available) + 10 * num_sources_available,
            0, 100
        )

    Args:
        customer_row (pd.Series): Customer record containing
            'months_of_data_available' and 'num_sources_available'.

    Returns:
        float: Confidence score in range [0.0, 100.0].
    """
    months = float(customer_row.get("months_of_data_available", 0.0))
    sources = float(customer_row.get("num_sources_available", 0.0))

    # Handle missing or invalid inputs gracefully
    if pd.isna(months) or months < 0:
        months = 0.0
    if pd.isna(sources) or sources < 0:
        sources = 0.0

    confidence = 20.0 * np.log1p(months) + 10.0 * sources
    clipped_confidence = float(np.clip(confidence, 0.0, 100.0))

    return round(clipped_confidence, 2)
