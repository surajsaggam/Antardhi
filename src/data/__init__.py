"""Data module for Antardhi alternative credit engine.

Exposes:
- generate_synthetic_dataset: Generates correlated synthetic credit dataset.
- PersonaMedianImputer: Imputes missing values by persona median.
- impute_missing_by_persona: Functional interface for persona-median imputation.
"""

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

__all__ = [
    "generate_synthetic_dataset",
    "generate_with_latent",
    "PERSONAS",
    "SCHEMA_COLUMNS",
    "PersonaMedianImputer",
    "impute_missing_by_persona",
]
