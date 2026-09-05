"""Model evaluation module.

Follows Section 13 and Section 14 of PROJECT_SPEC.md:
Computes ROC-AUC, PR-AUC, KS-statistic, and Brier score.
Never relies on accuracy alone under credit class imbalance.
"""

from typing import Any, Dict
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss, roc_curve


def evaluate_model(model: Any, X_test: pd.DataFrame, y_test: np.ndarray | pd.Series) -> Dict[str, float]:
    """Evaluate credit risk model performance across regulatory metrics.

    CONTRACT (PROJECT_SPEC.md Section 13 & 14):
        Returns:
            {
                'roc_auc': float,
                'pr_auc': float,
                'ks_stat': float,
                'brier': float
            }

    Args:
        model: Trained model with `predict_proba(X)` method.
        X_test: Test features.
        y_test: Ground truth binary labels (0 = non-default, 1 = default).

    Returns:
        dict containing roc_auc, pr_auc, ks_stat, and brier score.
    """
    y_true = np.asarray(y_test)

    # Get predicted probabilities for positive class (default = 1)
    if hasattr(model, "predict_proba"):
        prob_arr = model.predict_proba(X_test)
        if prob_arr.ndim == 2:
            y_prob = prob_arr[:, 1]
        else:
            y_prob = prob_arr
    elif hasattr(model, "predict"):
        y_prob = model.predict(X_test)
    else:
        raise ValueError("Model must implement predict_proba or predict method.")

    # 1. ROC-AUC
    try:
        roc_auc = float(roc_auc_score(y_true, y_prob))
    except ValueError:
        roc_auc = 0.5

    # 2. PR-AUC (Average Precision)
    try:
        pr_auc = float(average_precision_score(y_true, y_prob))
    except ValueError:
        pr_auc = float(np.mean(y_true))

    # 3. KS-Statistic: max difference between TPR and FPR
    try:
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        ks_stat = float(np.max(np.abs(tpr - fpr)))
    except Exception:
        ks_stat = 0.0

    # 4. Brier Score Loss: mean squared error of predicted probabilities
    try:
        brier = float(brier_score_loss(y_true, y_prob))
    except Exception:
        brier = float(np.mean((y_prob - y_true) ** 2))

    return {
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "ks_stat": round(ks_stat, 4),
        "brier": round(brier, 4),
    }
