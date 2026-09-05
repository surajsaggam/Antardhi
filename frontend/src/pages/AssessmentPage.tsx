import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  RefreshCw,
  Users,
  ArrowLeft,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { useApplicant } from "../context/ApplicantContext";
import { getAssessment, type AssessmentResponse } from "../services/api";

export const AssessmentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedApplicant, selectCustomerById } = useApplicant();

  // Determine active customer ID from context or URL search param
  const customerIdFromUrl = searchParams.get("id")?.trim() || "";
  const [activeCustomer, setActiveCustomer] = useState<{
    customer_id: string;
    persona?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync active customer from Context or URL
  useEffect(() => {
    if (selectedApplicant) {
      setActiveCustomer(selectedApplicant);
    } else if (customerIdFromUrl) {
      const found = selectCustomerById(customerIdFromUrl);
      if (found) {
        setActiveCustomer(found);
      } else {
        setActiveCustomer({ customer_id: customerIdFromUrl });
      }
    } else {
      setActiveCustomer(null);
    }
  }, [selectedApplicant, customerIdFromUrl, selectCustomerById]);

  // Reset assessment result when active customer changes
  useEffect(() => {
    setAssessment(null);
    setError(null);
  }, [activeCustomer?.customer_id]);

  const handleRunAssessment = async () => {
    if (!activeCustomer?.customer_id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAssessment(activeCustomer.customer_id);
      setAssessment(data);
    } catch (err: any) {
      setError(err.message || "Failed to score applicant");
    } finally {
      setLoading(false);
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "Low Risk":
        return "badge-low-risk";
      case "Medium Risk":
        return "badge-medium-risk";
      case "High Risk":
        return "badge-high-risk";
      default:
        return "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200";
    }
  };

  // Case 1: EMPTY STATE - No applicant selected
  if (!activeCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Credit Assessment
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Alternative-data multi-model underwriting, SHAP explainability, and loan recommendations
            </p>
          </div>
        </div>

        {/* Empty State Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500 mb-4">
            <Users className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            No Applicant Selected
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            Please select an applicant profile from the Underwriting Queue to evaluate alternative creditworthiness, inspect adverse factor codes, and run Path-to-Eligibility simulations.
          </p>
          <div className="mt-6">
            <button
              onClick={() => navigate("/applicants")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span>Select an Applicant from Queue</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: ACTIVE APPLICANT SELECTED
  return (
    <div className="space-y-6">
      {/* Navigation Breadcrumb Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/applicants"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Applicants Queue</span>
        </Link>

        <button
          onClick={() => navigate("/applicants")}
          className="text-xs font-medium text-sky-700 hover:text-sky-900 transition-colors"
        >
          Switch Applicant
        </button>
      </div>

      {/* Selected Applicant Underwriter Header Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Selected Applicant
              </span>
              {activeCustomer.persona && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  {activeCustomer.persona}
                </span>
              )}
            </div>
            <div className="text-lg font-bold font-mono text-slate-900 mt-1">
              {activeCustomer.customer_id}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Alternative Data Profile &bull; Ready for multi-model inference
            </div>
          </div>

          <button
            onClick={handleRunAssessment}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Scoring via Backend..." : "Run Credit Assessment"}
          </button>
        </div>

        {error && (
          <div className="mt-4 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Assessment Scoring Results */}
        {assessment && (
          <div className="mt-6 pt-6 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Assessment Results (Backend Real-Time Inference)
              </div>
              <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Score Evaluated
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Credit Score</div>
                <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
                  {assessment.score}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Scale: 300–900</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Risk Tier</div>
                <div className="mt-1.5">
                  <span className={getTierBadge(assessment.tier)}>
                    {assessment.tier}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Policy Tier</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Confidence Score</div>
                <div className="text-xl font-bold text-slate-800 font-mono mt-1">
                  {assessment.confidence.toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Data Coverage</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Anomaly Flag</div>
                <div className="text-xl font-bold text-slate-800 mt-1">
                  {assessment.anomaly_flag}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Separate Signal</div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <span className="text-slate-500">Recommended Loan: </span>
                <strong className="text-slate-900 font-mono">
                  ₹{assessment.recommended_loan.toLocaleString()}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Tenure: </span>
                <strong className="text-slate-900 font-mono">
                  {assessment.recommended_tenure_months} months
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Monthly EMI: </span>
                <strong className="text-slate-900 font-mono">
                  ₹{assessment.recommended_emi.toLocaleString()}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subsequent Steps Placeholder Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-600 mb-4">
          <Activity className="w-6 h-6 text-slate-500" />
        </div>
        <h2 className="text-base font-semibold text-slate-900">
          Underwriting Decision Dashboard Ready
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
          Applicant selection handoff is operational. In subsequent steps, this screen will render the complete 5-screen underwriting suite: data coverage checklist, financial fingerprint radar, SHAP adverse reason codes, and the interactive Path-to-Eligibility What-If simulator.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
          <span>Full Decision Dashboard unlocks in next step</span>
        </div>
      </div>
    </div>
  );
};
