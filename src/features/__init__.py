"""Features package for Antardhi alternative credit engine.

Exposes:
- engineer_features: Transforms raw alternative data into behavioral credit indices.
"""

from src.features.feature_engineering import engineer_features

__all__ = ["engineer_features"]
