# Antardhi

> "Don't ask if the customer has a credit history. Ask what their financial behavior already proves."

Antardhi is a consent-led alternative-data credit-scoring prototype for first-time borrowers, gig workers, small merchants, and informal-sector workers. It is built for the TVS Credit e.p.i.c 8 challenge.

The Streamlit demo presents five screens: explicit source-by-source consent, data connection coverage, a Capacity/Stability/Discipline fingerprint, a credit decision with separate evidence confidence, and adverse-action-style reason codes with an interactive path-to-eligibility rescore.

## Prototype note

This repository uses a parameterized synthetic data generator due to the absence of production GST/UPI/AA access; see `src/data/synthetic_generator.py`. The Streamlit demo scores complete rows from that local synthetic dataset through the public model interface. It does not access production customer data and its output is not a lending decision.

The app imports only `score_customer` from `src.models` and does not call model internals directly.

## Run locally

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

Run tests from the repository root:

```bash
pytest
```

## Integration contract

The sole application-to-model interface is:

```python
score_customer(customer_row: pd.Series) -> dict
```

It returns a 300–900 score, risk tier, separate confidence and anomaly flags, reason codes, and indicative loan terms. Model, explainability, simulation, and data modules are implemented independently under their own ownership boundaries.
