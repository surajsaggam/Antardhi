"""Training module for Antardhi credit scoring models.

Implements Section 7 and Section 13 of PROJECT_SPEC.md:
- Layer A (Baseline): Weight-of-Evidence (WOE) scorecard + Logistic Regression
- Layer B (Challenger): LightGBM Gradient Boosted Decision Trees
"""

import os
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
import lightgbm as lgb

from src.models.features import extract_features, FEATURE_COLUMNS


# Persona weights (w1: Capacity, w2: Stability, w3: Discipline) per Section 7
PERSONA_WEIGHTS = {
    "Small Merchant": (0.50, 0.30, 0.20),
    "Gig Worker": (0.40, 0.20, 0.40),
    "First-time Borrower": (0.35, 0.25, 0.40),
    "Informal/Rural Worker": (0.35, 0.35, 0.30),
}
# Backward compatibility alias
PERSONA_WEIGHTS["First-time Borrower (salaried, thin file)"] = PERSONA_WEIGHTS["First-time Borrower"]


def compute_composite_components(row: pd.Series) -> Dict[str, float]:
    """Compute Capacity, Stability, Discipline and Composite per Section 7."""
    raw_persona = row.get("persona", "First-time Borrower")
    persona = str(raw_persona) if not pd.isna(raw_persona) else "First-time Borrower"
    if "merchant" in persona.lower() or "kirana" in persona.lower():
        clean_persona = "Small Merchant"
    elif "gig" in persona.lower() or "driver" in persona.lower():
        clean_persona = "Gig Worker"
    elif "informal" in persona.lower() or "rural" in persona.lower():
        clean_persona = "Informal/Rural Worker"
    else:
        clean_persona = "First-time Borrower"

    w1, w2, w3 = PERSONA_WEIGHTS.get(clean_persona, PERSONA_WEIGHTS["First-time Borrower"])

    # If engineered features are not already present, extract them
    if "income_proxy" in row and not pd.isna(row.get("income_proxy")):
        feat_row = row
    else:
        feat_df = extract_features(row)
        feat_row = feat_df.iloc[0]

    income_proxy = float(feat_row.get("income_proxy", 30000.0))
    biz_idx = float(feat_row.get("business_activity_index", 0.0))
    stability = float(feat_row.get("cashflow_stability", 0.7))
    discipline_base = float(feat_row.get("payment_discipline", 0.7))

    # Capacity: f(income_proxy, business_activity_index)
    capacity = float(np.clip((income_proxy / 100000.0) * 0.7 + (biz_idx / 15.0) * 0.3, 0.0, 1.0))

    # Stability: f(cashflow_stability, gst MoM variance)
    stability_norm = float(np.clip(stability, 0.0, 1.0))

    # Discipline: blend partial bureau score if available at 30% weight
    has_bureau = bool(feat_row.get("existing_bureau_flag", False))
    bureau_score = feat_row.get("existing_bureau_score_partial", np.nan)
    if has_bureau and not pd.isna(bureau_score) and float(bureau_score) > 0:
        norm_bureau = float(np.clip((float(bureau_score) - 300.0) / 600.0, 0.0, 1.0))
        discipline = 0.7 * discipline_base + 0.3 * norm_bureau
    else:
        discipline = discipline_base
    discipline_norm = float(np.clip(discipline, 0.0, 1.0))

    composite = w1 * capacity + w2 * stability_norm + w3 * discipline_norm
    return {
        "capacity": capacity,
        "stability": stability_norm,
        "discipline": discipline_norm,
        "composite": composite,
    }


def compute_composite_score(row: pd.Series) -> int:
    """Scale Composite score to [300, 900] per Section 7."""
    comps = compute_composite_components(row)
    raw_score = 300.0 + comps["composite"] * 600.0
    return int(np.clip(round(raw_score), 300, 900))


class WOEBinner:
    """Weight of Evidence (WOE) binning transformer for numeric features."""

    def __init__(self, n_bins: int = 5):
        self.n_bins = n_bins
        self.bins_: Dict[str, np.ndarray] = {}
        self.woe_map_: Dict[str, Dict[int, float]] = {}

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "WOEBinner":
        total_bads = max(float(np.sum(y == 1)), 1.0)
        total_goods = max(float(np.sum(y == 0)), 1.0)

        for col in X.columns:
            vals = pd.to_numeric(X[col], errors="coerce").fillna(0.0).values
            unique_vals = np.unique(vals)
            if len(unique_vals) <= self.n_bins:
                bin_edges = unique_vals
            else:
                quantiles = np.linspace(0, 100, self.n_bins + 1)
                bin_edges = np.unique(np.percentile(vals, quantiles))

            self.bins_[col] = bin_edges
            bin_indices = np.digitize(vals, bin_edges) - 1

            col_woe = {}
            for b in np.unique(bin_indices):
                mask = bin_indices == b
                bads = np.sum((y == 1) & mask)
                goods = np.sum((y == 0) & mask)

                # Laplace smoothing to prevent division by zero or inf
                dist_good = (goods + 0.5) / (total_goods + 1.0)
                dist_bad = (bads + 0.5) / (total_bads + 1.0)
                woe = float(np.log(dist_good / dist_bad))
                col_woe[int(b)] = woe

            self.woe_map_[col] = col_woe
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        X_woe = pd.DataFrame(index=X.index)
        for col in X.columns:
            if col in self.bins_:
                vals = pd.to_numeric(X[col], errors="coerce").fillna(0.0).values
                bin_edges = self.bins_[col]
                bin_indices = np.digitize(vals, bin_edges) - 1
                col_woe = self.woe_map_[col]
                default_woe = np.mean(list(col_woe.values())) if col_woe else 0.0
                X_woe[col] = [col_woe.get(int(b), default_woe) for b in bin_indices]
            else:
                X_woe[col] = 0.0
        return X_woe


class BaselineScorecard:
    """Layer A: WOE binning + Logistic Regression regulatory scorecard."""

    def __init__(self, n_bins: int = 5):
        self.binner = WOEBinner(n_bins=n_bins)
        self.clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
        self.is_fitted: bool = False
        self.feature_names_: List[str] = []

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "BaselineScorecard":
        self.feature_names_ = list(X.columns)
        self.binner.fit(X, y)
        X_woe = self.binner.transform(X)
        self.clf.fit(X_woe, y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        X_woe = self.binner.transform(X[self.feature_names_])
        return self.clf.predict_proba(X_woe)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict(self.binner.transform(X[self.feature_names_]))

    def compute_composite_components(self, row: pd.Series) -> Dict[str, float]:
        """Compute Capacity, Stability, Discipline and Composite per Section 7."""
        return compute_composite_components(row)

    def score(self, row: pd.Series) -> int:
        """Scale Composite score to [300, 900] per Section 7."""
        return compute_composite_score(row)


class ChallengerModel:
    """Layer B: LightGBM gradient boosted decision tree classifier."""

    def __init__(self, **lgb_params: Any):
        default_params = {
            "n_estimators": 120,
            "learning_rate": 0.04,
            "max_depth": 5,
            "num_leaves": 20,
            "min_child_samples": 15,
            "random_state": 42,
            "verbose": -1,
            "n_jobs": -1
        }
        default_params.update(lgb_params)
        self.clf = lgb.LGBMClassifier(**default_params)
        self.feature_names_: List[str] = []
        self.is_fitted: bool = False

    def fit(self, X: pd.DataFrame, y: np.ndarray) -> "ChallengerModel":
        self.feature_names_ = list(X.columns)
        self.clf.fit(X[self.feature_names_], y)
        self.is_fitted = True
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict_proba(X[self.feature_names_])

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self.clf.predict(X[self.feature_names_])

    def score(self, row: pd.Series | pd.DataFrame) -> int:
        """Score customer using the authoritative Composite credit score architecture."""
        s = row if isinstance(row, pd.Series) else row.iloc[0]
        return compute_composite_score(s)

    def predict_default_prob(self, row: pd.Series | pd.DataFrame) -> float:
        """Predict default probability P(y=1) using LightGBM challenger model."""
        if isinstance(row, pd.Series):
            df_features = extract_features(row)
        else:
            df_features = row
        return float(self.predict_proba(df_features[self.feature_names_])[0, 1])

    def predict_calibrated_score(self, row: pd.Series | pd.DataFrame) -> int:
        """Map default probability P(y=1) to calibrated score [300, 900] for model benchmarking."""
        prob_default = self.predict_default_prob(row)
        scaled_score = 900.0 - prob_default * 600.0
        return int(np.clip(round(scaled_score), 300, 900))


def train_baseline_model(X_train: pd.DataFrame, y_train: np.ndarray | pd.Series) -> BaselineScorecard:
    """Train Layer A transparent baseline model: WOE binning + Logistic Regression.

    CONTRACT (PROJECT_SPEC.md Section 7 & 13):
        def train_baseline_model(X_train, y_train): ...
    """
    y_arr = np.asarray(y_train)
    model = BaselineScorecard()
    model.fit(X_train, y_arr)
    return model


def train_challenger_model(X_train: pd.DataFrame, y_train: np.ndarray | pd.Series) -> ChallengerModel:
    """Train Layer B challenger model: LightGBM.

    CONTRACT (PROJECT_SPEC.md Section 7 & 13):
        def train_challenger_model(X_train, y_train): ...
    """
    y_arr = np.asarray(y_train)
    model = ChallengerModel()
    model.fit(X_train, y_arr)
    return model


# Module-level model cache
_MODEL_CACHE: Dict[str, Any] = {}


def get_or_train_models(
    csv_path: str = "data/synthetic_credit_data.csv"
) -> Tuple[BaselineScorecard, ChallengerModel]:
    """Retrieve cached models or train on synthetic dataset."""
    global _MODEL_CACHE
    if "baseline" in _MODEL_CACHE and "challenger" in _MODEL_CACHE:
        return _MODEL_CACHE["baseline"], _MODEL_CACHE["challenger"]

    if not os.path.exists(csv_path):
        alt_path = os.path.join("..", csv_path)
        if os.path.exists(alt_path):
            csv_path = alt_path

    df = pd.read_csv(csv_path)
    X = extract_features(df)
    y = df["default_label"].values

    baseline = train_baseline_model(X, y)
    challenger = train_challenger_model(X, y)

    _MODEL_CACHE["baseline"] = baseline
    _MODEL_CACHE["challenger"] = challenger
    return baseline, challenger
