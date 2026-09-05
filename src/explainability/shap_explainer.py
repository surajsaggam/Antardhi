"""TreeSHAP explainability module.

Follows Section 10 and Section 13 of PROJECT_SPEC.md.
Uses TreeSHAP on the Layer B Challenger model.
"""

import warnings
from typing import Any, Dict, Optional
import numpy as np
import pandas as pd
import shap

from src.models.features import extract_features, FEATURE_COLUMNS

_TREE_EXPLAINER_CACHE: Optional[shap.TreeExplainer] = None
_CACHED_MODEL_ID: Optional[int] = None


def get_tree_explainer(model: Any) -> shap.TreeExplainer:
    """Get or create cached TreeExplainer for the challenger model."""
    global _TREE_EXPLAINER_CACHE, _CACHED_MODEL_ID
    underlying = getattr(model, "clf", model)

    if _TREE_EXPLAINER_CACHE is None or _CACHED_MODEL_ID != id(underlying):
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=UserWarning)
            _TREE_EXPLAINER_CACHE = shap.TreeExplainer(underlying)
        _CACHED_MODEL_ID = id(underlying)

    return _TREE_EXPLAINER_CACHE


def get_shap_values(model: Any, X_row: pd.DataFrame | pd.Series) -> Dict[str, float]:
    """Compute TreeSHAP values for a single customer record on the challenger model.

    CONTRACT (PROJECT_SPEC.md Section 10 & 13):
        def get_shap_values(model, X_row) -> dict: ...

    Args:
        model: Trained challenger model (ChallengerModel or LGBMClassifier).
        X_row: Feature vector for a single applicant (pd.Series or single-row DataFrame).

    Returns:
        dict: Mapping of feature name to SHAP value float.
              Positive SHAP value for default risk means negative impact on creditworthiness.
    """
    if isinstance(X_row, pd.Series):
        df_features = extract_features(X_row)
    elif isinstance(X_row, pd.DataFrame):
        df_features = extract_features(X_row.iloc[0])
    else:
        df_features = pd.DataFrame(X_row)

    feature_cols = getattr(model, "feature_names_", FEATURE_COLUMNS)
    X_input = df_features[feature_cols]

    explainer = get_tree_explainer(model)
    raw_shap = explainer.shap_values(X_input)

    # Handle different return shapes from SHAP versions
    if isinstance(raw_shap, list):
        # Binary classification: index 1 represents probability/log-odds of default
        shap_vec = raw_shap[1][0] if len(raw_shap) > 1 else raw_shap[0][0]
    elif isinstance(raw_shap, np.ndarray):
        if raw_shap.ndim == 3:
            shap_vec = raw_shap[0, :, 1]
        elif raw_shap.ndim == 2:
            shap_vec = raw_shap[0]
        else:
            shap_vec = raw_shap
    else:
        # shap.Explanation object
        shap_vec = raw_shap.values[0]

    shap_dict = {
        col: round(float(val), 4)
        for col, val in zip(feature_cols, shap_vec)
    }
    return shap_dict
