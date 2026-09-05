"""Data preprocessor for Antardhi alternative credit engine.

Implements persona-aware median imputation matching Section 6 of PROJECT_SPEC.md:
"Missing-source features are imputed as persona-median, never zero
(zero implies 'very bad', missing means 'unknown' — these are different
and the Confidence Score exists to capture that difference)."
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd


class PersonaMedianImputer:
    """Imputes missing feature values using persona-specific medians.

    Stores persona-level medians during `fit()` and applies them during `transform()`.
    Falls back to dataset-wide global medians or neutral defaults when persona-level
    values are completely missing (e.g., GST features for non-merchants).
    """

    def __init__(self, persona_column: str = "persona") -> None:
        """Initialize the PersonaMedianImputer.

        Args:
            persona_column (str): Name of the persona categorical column.
        """
        self.persona_column = persona_column
        self.persona_medians_: dict[str, dict[str, float]] = {}
        self.global_medians_: dict[str, float] = {}
        self.numeric_cols_: list[str] = []
        self.is_fitted_: bool = False

    def fit(self, df: pd.DataFrame) -> PersonaMedianImputer:
        """Fit persona-level and global medians on numeric features.

        Args:
            df (pd.DataFrame): Training DataFrame containing customer records.

        Returns:
            PersonaMedianImputer: Fitted imputer instance.
        """
        if df.empty:
            raise ValueError("Cannot fit on an empty DataFrame.")

        # Identify numeric columns excluding ID and targets/flags
        cols_to_exclude = {self.persona_column, "customer_id", "default_label"}
        self.numeric_cols_ = [
            c
            for c in df.columns
            if c not in cols_to_exclude and pd.api.types.is_numeric_dtype(df[c])
        ]

        # Compute global medians for fallback
        for col in self.numeric_cols_:
            valid_series = df[col].dropna()
            self.global_medians_[col] = float(valid_series.median()) if not valid_series.empty else 0.0

        # Compute persona-specific medians
        self.persona_medians_ = {}
        if self.persona_column in df.columns:
            for persona_name, group in df.groupby(self.persona_column):
                persona_key = str(persona_name)
                self.persona_medians_[persona_key] = {}
                for col in self.numeric_cols_:
                    valid_vals = group[col].dropna()
                    if valid_vals.empty:
                        # If the whole persona has NaN for this column (e.g., GST for Gig Workers),
                        # fall back to global median or 0.0
                        self.persona_medians_[persona_key][col] = self.global_medians_.get(col, 0.0)
                    else:
                        self.persona_medians_[persona_key][col] = float(valid_vals.median())

        self.is_fitted_ = True
        return self

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Impute missing numeric values using fitted persona medians.

        Args:
            df (pd.DataFrame): Input DataFrame (or single row converted to DataFrame).

        Returns:
            pd.DataFrame: Imputed DataFrame with preserved schema and non-null numeric values.
        """
        if not self.is_fitted_:
            raise RuntimeError("PersonaMedianImputer must be fitted before calling transform().")

        df_out = df.copy()

        # Ensure numeric columns are proper numeric types before imputation
        for col in self.numeric_cols_:
            if col in df_out.columns:
                df_out[col] = pd.to_numeric(df_out[col], errors="coerce")

        # If persona column is present, impute group by group
        if self.persona_column in df_out.columns:
            for persona_name, persona_dict in self.persona_medians_.items():
                mask = df_out[self.persona_column] == persona_name
                if not mask.any():
                    continue
                for col in self.numeric_cols_:
                    if col in df_out.columns and df_out.loc[mask, col].isna().any():
                        median_val = persona_dict.get(col, self.global_medians_.get(col, 0.0))
                        df_out.loc[mask, col] = df_out.loc[mask, col].fillna(median_val)

        # Catch-all: fill any remaining NaNs with global medians
        for col in self.numeric_cols_:
            if col in df_out.columns and df_out[col].isna().any():
                df_out[col] = df_out[col].fillna(self.global_medians_.get(col, 0.0))

        return df_out

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fit imputer on DataFrame and return transformed copy.

        Args:
            df (pd.DataFrame): Input DataFrame.

        Returns:
            pd.DataFrame: Imputed DataFrame.
        """
        return self.fit(df).transform(df)


def impute_missing_by_persona(
    df: pd.DataFrame,
    imputer: PersonaMedianImputer | None = None,
) -> pd.DataFrame:
    """Convenience function to impute missing values by persona median.

    Args:
        df (pd.DataFrame): Input DataFrame.
        imputer (PersonaMedianImputer | None): Pre-fitted imputer, or None to fit on df.

    Returns:
        pd.DataFrame: Imputed DataFrame.
    """
    if imputer is None:
        imputer = PersonaMedianImputer()
        return imputer.fit_transform(df)
    return imputer.transform(df)
