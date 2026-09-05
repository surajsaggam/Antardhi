"""Antardhi's consent-led alternative-data credit demo."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from src.models import score_customer
from src.utils.helpers import (PERSONA_SOURCES, SOURCE_LABELS, coverage_percent,
                               fingerprint_indicators, load_demo_customers,
                               risk_tier_label, source_connection_status)

APP_TITLE = "Antardhi"
SCORE_MAX = 900
DATASET_PATH = Path(__file__).parent / "data" / "synthetic_credit_data.csv"


@st.cache_data(show_spinner=False)
def load_customers() -> pd.DataFrame:
    """Load the real synthetic records used for interactive demo scoring."""
    return load_demo_customers(DATASET_PATH)


def initialise_session(customers: pd.DataFrame) -> None:
    """Create app state without storing or collecting external source data."""
    defaults: dict[str, Any] = {
        "customer_name": "Demo Applicant",
        "persona": "Gig Worker",
        "consents": {key: False for key in SOURCE_LABELS},
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value
    customer_ids = customers.loc[customers["persona"] == st.session_state.persona, "customer_id"].tolist()
    if customer_ids and st.session_state.get("demo_customer_id") not in customer_ids:
        st.session_state.demo_customer_id = customer_ids[0]


def selected_customer(customers: pd.DataFrame) -> pd.Series:
    """Return the selected complete Section 5.1 customer record.

    Raises:
        ValueError: If the selected synthetic profile cannot be found.
    """
    matches = customers.loc[customers["customer_id"] == st.session_state.demo_customer_id]
    if matches.empty:
        raise ValueError("The selected synthetic demo profile is unavailable.")
    return matches.iloc[0].copy()


def get_score_result(customer_row: pd.Series) -> dict[str, Any] | None:
    """Invoke the sole model boundary and display a safe UI error on failure."""
    try:
        return score_customer(customer_row)
    except Exception:
        st.error("Unable to score this demo profile right now. Please choose another profile or try again.")
        return None


def render_onboarding(customers: pd.DataFrame) -> None:
    """Show source-specific, revocable onboarding consent controls."""
    st.subheader("Onboarding & consent")
    st.caption("Nothing is connected or collected without a separate opt-in.")
    st.session_state.customer_name = st.text_input("Customer name", st.session_state.customer_name)
    st.session_state.persona = st.selectbox("Occupation / persona", list(PERSONA_SOURCES),
                                             index=list(PERSONA_SOURCES).index(st.session_state.persona))
    customer_ids = customers.loc[customers["persona"] == st.session_state.persona, "customer_id"].tolist()
    if st.session_state.get("demo_customer_id") not in customer_ids:
        st.session_state.demo_customer_id = customer_ids[0]
    st.selectbox("Synthetic demo customer", customer_ids, key="demo_customer_id",
                 format_func=lambda customer_id: f"Profile {customer_id[:8]}")
    st.caption("The selected profile comes from the local synthetic dataset; it is not a live customer-data connection.")
    st.markdown("#### Data permissions")
    for key, label in SOURCE_LABELS.items():
        applicable = key in PERSONA_SOURCES[st.session_state.persona]
        state_key = f"consent_{key}"
        if state_key not in st.session_state:
            st.session_state[state_key] = st.session_state.consents[key]
        st.checkbox(f"I consent to use my {label.lower()} for this assessment", key=state_key,
                    disabled=not applicable,
                    help=None if applicable else "Not normally available for this persona.")
        st.session_state.consents[key] = bool(st.session_state[state_key]) if applicable else False
    st.info("You may withdraw any permission by unchecking it. Unavailable sources are not bad-data signals.")


def render_connections(statuses: list[dict[str, Any]]) -> None:
    """Show source coverage without treating unavailable sources as poor quality."""
    st.subheader("Data connection status")
    coverage = coverage_percent(statuses)
    left, right = st.columns([1, 2])
    left.metric("Consented coverage", f"{coverage}%")
    left.progress(coverage / 100)
    with right:
        for item in statuses:
            text = "Unavailable for this persona" if not item["available_for_persona"] else (
                "Connected with consent" if item["connected"] else "Available, but not shared")
            st.write(f"{'✅' if item['connected'] else '○'} **{item['source']}** — {text}")
    st.caption("Unavailable describes persona fit; it does not mean bad data or higher customer risk.")


def render_fingerprint(customer_row: pd.Series) -> None:
    """Show raw-data supporting indicators, not unexposed model components."""
    st.subheader("Financial fingerprint")
    st.caption("Transparent raw-data supporting signals from the selected synthetic record — not model-returned components.")
    indicators = fingerprint_indicators(customer_row)
    available = {label: value for label, value in indicators.items() if value is not None}
    if not available:
        st.info("No supporting source signals are available for this profile.")
        return
    figure = go.Figure(go.Bar(x=list(available.values()), y=list(available), orientation="h",
                              marker_color="#2e7d68", text=[f"{value:.0f}" for value in available.values()],
                              textposition="auto"))
    figure.update_layout(xaxis={"range": [0, 100], "title": "Supporting signal (0–100)"},
                         height=300, margin={"l": 25, "r": 25, "t": 25, "b": 25})
    visual, details = st.columns([3, 2])
    visual.plotly_chart(figure, use_container_width=True, config={"displayModeBar": False})
    with details:
        for label, value in indicators.items():
            details.metric(label, "Not available" if value is None else f"{value:.0f} / 100")


def render_decision(result: dict[str, Any]) -> None:
    """Show the real model decision with distinct score and confidence outputs."""
    st.subheader("Credit decision")
    score_col, confidence_col, tier_col = st.columns(3)
    score_col.metric("Credit score", f"{result['score']} / {SCORE_MAX}")
    confidence_col.metric("Evidence confidence", f"{result['confidence']:.0f}%")
    tier_col.metric("Risk tier", risk_tier_label(result["tier"]))
    st.caption("Credit score measures creditworthiness; evidence confidence measures available history. They are separate outputs.")
    if result["anomaly_flag"] == "High":
        st.warning("Data anomaly flag: High — manual review is required. It does not reduce the credit score.")
    else:
        st.caption(f"Data anomaly flag: {result['anomaly_flag']} (separate from the score)")
    loan_col, tenure_col, emi_col = st.columns(3)
    loan_col.metric("Recommended loan", f"₹{result['recommended_loan']:,.0f}")
    tenure_col.metric("Suggested tenure", f"{result['recommended_tenure_months']} months")
    emi_col.metric("Indicative EMI", f"₹{result['recommended_emi']:,.0f} / month")


def render_what_if(customer_row: pd.Series, result: dict[str, Any]) -> None:
    """Render model-returned reasons and rescore a changed valid customer row."""
    st.subheader("Explainability + what-if")
    positive, negative = st.columns(2)
    with positive:
        st.markdown("**Positive reason codes**")
        reasons = [reason for reason in result["reason_codes"] if reason.get("impact") == "+"]
        if reasons:
            for reason in reasons:
                st.success(reason.get("description", reason.get("factor", "Positive factor")))
        else:
            st.caption("No positive reason code was returned for this profile.")
    with negative:
        st.markdown("**Improvement opportunities**")
        reasons = [reason for reason in result["reason_codes"] if reason.get("impact") == "-"]
        if reasons:
            for reason in reasons:
                st.warning(reason.get("description", reason.get("factor", "Improvement opportunity")))
        else:
            st.caption("No negative reason code was returned for this profile.")

    st.markdown("#### Try a path to eligibility")
    st.caption("The controls adjust a copy of this real synthetic record and rescore it through the same public model API.")
    inflow_change = st.slider("Average UPI inflow change (%)", min_value=-50, max_value=50, value=0, step=5)
    simulated_row = customer_row.copy()
    simulated_row["upi_monthly_inflow_avg"] = float(customer_row["upi_monthly_inflow_avg"]) * (1 + inflow_change / 100)
    if pd.notna(customer_row["utility_payment_regularity"]):
        simulated_row["utility_payment_regularity"] = st.slider(
            "Utility payment regularity", min_value=0.0, max_value=1.0,
            value=float(customer_row["utility_payment_regularity"]), step=0.05,
        )
    if pd.notna(customer_row["telecom_recharge_consistency"]):
        simulated_row["telecom_recharge_consistency"] = st.slider(
            "Telecom recharge consistency", min_value=0.0, max_value=1.0,
            value=float(customer_row["telecom_recharge_consistency"]), step=0.05,
        )
    simulated = get_score_result(simulated_row)
    if simulated is None:
        return
    old, new, delta, tier = st.columns(4)
    old.metric("Current score", result["score"])
    new.metric("New score", simulated["score"])
    delta.metric("Score change", f"{simulated['score'] - result['score']:+d}")
    tier.metric("New tier", risk_tier_label(simulated["tier"]))
    st.write(f"**Eligibility change:** ₹{result['recommended_loan']:,.0f} → **₹{simulated['recommended_loan']:,.0f}** recommended loan")


def main() -> None:
    """Run the five-screen app using the public model integration only."""
    st.set_page_config(page_title=APP_TITLE, page_icon="◐", layout="wide")
    st.markdown("""<style>
        .block-container{max-width:1120px;padding-top:1.5rem}
        [data-testid=stMetric]{background:#f6faf8;border:1px solid #dcebe6;border-radius:12px;padding:12px;color:#102d25}
        [data-testid=stMetricLabel],[data-testid=stMetricLabel] *,[data-testid=stMetricValue],[data-testid=stMetricValue] *{color:#102d25!important}
        [data-testid=stMetricDelta],[data-testid=stMetricDelta] *{color:#245f4f!important}
    </style>""", unsafe_allow_html=True)
    try:
        customers = load_customers()
    except (OSError, ValueError) as error:
        st.error(f"Unable to load synthetic demo customers: {error}")
        return
    initialise_session(customers)
    st.title(APP_TITLE)
    st.markdown("*Don’t ask if the customer has a credit history. Ask what their financial behavior already proves.*")
    st.caption("Consent-led alternative-data credit demo")
    screens = ["1. Onboarding & Consent", "2. Data Connection Status", "3. Financial Fingerprint",
               "4. Credit Decision", "5. Explainability + What-If"]
    selected = st.radio("Demo screen", screens, horizontal=True, label_visibility="collapsed")
    if selected == screens[0]:
        render_onboarding(customers)
        return
    try:
        customer_row = selected_customer(customers)
    except ValueError as error:
        st.error(str(error))
        return
    statuses = source_connection_status(st.session_state.persona, st.session_state.consents)
    if selected == screens[1]:
        render_connections(statuses)
    elif selected == screens[2]:
        render_fingerprint(customer_row)
    else:
        result = get_score_result(customer_row)
        if result is None:
            return
        if selected == screens[3]:
            render_decision(result)
        elif selected == screens[4]:
            render_what_if(customer_row, result)


if __name__ == "__main__":
    main()
