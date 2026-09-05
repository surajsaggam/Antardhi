# AGENTS.md — Rules for AI Coding Agents Working on Antardhi

This repo is being built by three AI agents working in parallel (Antigravity IDE, Antigravity CLI, Codex/CLI). Read this file and `PROJECT_SPEC.md` in full before writing any code.

## 1. Source of truth

`PROJECT_SPEC.md` is authoritative for: data schema, formulas, model architecture, and function signatures (Section 13). If your task seems to require deviating from it, STOP and leave a `# TODO(spec-conflict): <reason>` comment instead of silently improvising — financial scoring logic must not be guessed.

## 2. File ownership — stay in your lane

See Section 15 of `PROJECT_SPEC.md` for the exact ownership map. Do not edit files outside your assigned scope:
- **Agent 1:** `src/data/*`, `src/features/*`, `notebooks/01_exploratory_analysis.ipynb`, `data/*`
- **Agent 2:** `src/models/*` (including `src/models/__init__.py`), `src/explainability/*`, `src/simulation/*`, `notebooks/02_model_benchmarking.ipynb`, `tests/test_model_inference.py`
- **Agent 3:** `app.py`, `src/utils/*`, `assets/*`, `tests/test_feature_engineering.py`, `setup.py`, `requirements.txt`, `README.md`

Key ownership rules:
- Agent 2 owns `src/models/__init__.py`, implements, and exposes `score_customer()`.
- Agent 3 must never modify `src/models/__init__.py`.
- Agent 3 must never import internal model or explainability functions directly.
- `app.py` may only call `score_customer()` for scoring/inference.
- If you need something from another agent's module that doesn't exist yet, write against the interface contract in Section 13 and use a temporary stub/mock — do not implement the other agent's logic yourself.

## 3. The one shared contract

`src/models/__init__.py` exposes the single public integration function:
```python
def score_customer(customer_row: pd.Series) -> dict
```

This function is owned and implemented by Agent 2.

`app.py`, owned by Agent 3, may import only this public function:
```python
from src.models import score_customer
```

`app.py` must not directly call:
- `train_baseline_model()`
- `train_challenger_model()`
- `evaluate_model()`
- `compute_confidence_score()`
- `compute_anomaly_flag()`
- `get_shap_values()`
- `map_to_reason_codes()`
- `simulate_improvement()`

Those are internal implementation details of Agent 2.

Agent 3 must not modify `src/models/__init__.py`. This is the only integration point between the model/explainability layer and the app layer. Never bypass it.

## 4. Coding standards

- Python 3.10+, type hints on all public functions, docstrings in Google style.
- No hardcoded magic numbers — pull constants from `src/config.py`.
- Every function in `src/` should be unit-testable in isolation (no hidden global state).
- Prefer explicit over clever. This code will be walked through live in front of judges — readability matters more than brevity.

## 5. Data & modeling integrity rules

- Never fabricate features a persona wouldn't realistically have (see Section 4 missingness table). Impute with persona-median, not zero.
- Never blend the anomaly/fraud flag into the credit score. They are separate outputs (Section 2/9 of spec). This is a hard rule, not a style preference.
- Never report accuracy as the only/primary model metric. Always include ROC-AUC, PR-AUC, KS-statistic, Brier score (Section 14).
- All claimed performance numbers must come from an actual run against the synthetic test set — do not invent illustrative statistics.

## 6. When blocked or ambiguous

1. Check `PROJECT_SPEC.md` again.
2. If still ambiguous, make the most reasonable assumption, implement it, and clearly comment `# ASSUMPTION: <what and why>` so a human can review it later.
3. Do not silently skip a required deliverable — if you can't complete something, leave a clearly marked stub and say so in your final summary.

## 7. Testing — definition of done

Before considering any task complete:
- Relevant unit tests in `tests/` pass.
- New functions have at least one test covering a normal case and one edge case (e.g., missing data, zero-confidence customer).
- Run `pytest` from repo root and confirm no failures before reporting completion.

## 8. Commit hygiene

- Small, scoped commits. One logical change per commit.
- Commit message format: `[agent-1|agent-2|agent-3] <what changed>`
- Never commit `data/synthetic_credit_data.csv` if it exceeds a few MB — regenerate via script instead if needed (`.gitignore` should already cover large data artifacts).

## 9. Explainability is not optional polish

Every model-facing agent task should treat SHAP/reason-code output as a first-class deliverable, not an afterthought bolted on at the end. This is the single most heavily judged aspect of the entire prototype per the hackathon's stated criteria (original research, critical thinking).

## 10. Tone for any generated docs/comments

Be factual and specific. Avoid hackathon-buzzword language ("revolutionary," "cutting-edge," "next-gen") in code comments and docstrings — describe what the code actually does.