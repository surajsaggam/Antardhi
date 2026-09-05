import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Users,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  Smartphone,
  Receipt,
  Zap,
  PhoneCall,
  ShoppingBag,
  Car,
  Activity,
  Info,
} from "lucide-react";
import { useApplicant } from "../context/ApplicantContext";
import {
  getApplicantProfile,
  type ApplicantProfileResponse,
} from "../services/api";

const DATA_SOURCES_CONFIG = [
  {
    key: "upi" as const,
    name: "UPI Cashflow",
    description: "Monthly transaction volume & active cadence",
    icon: Smartphone,
  },
  {
    key: "gst" as const,
    name: "GST Invoicing",
    description: "Business turnover & filing consistency",
    icon: Receipt,
  },
  {
    key: "utility" as const,
    name: "Utility Payments",
    description: "Electricity & piped bill regularity",
    icon: Zap,
  },
  {
    key: "telecom" as const,
    name: "Telecom Recharges",
    description: "Prepaid / postpaid recharge frequency",
    icon: PhoneCall,
  },
  {
    key: "ecommerce" as const,
    name: "E-commerce Activity",
    description: "Commercial orders & low return rate",
    icon: ShoppingBag,
  },
  {
    key: "mobility" as const,
    name: "Mobility / Platform",
    description: "Transit & commercial gig work days",
    icon: Car,
  },
];

export const AssessmentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { selectedApplicant, selectCustomerById } = useApplicant();

  // Determine active customer ID from Context or URL
  const customerIdFromUrl = searchParams.get("id")?.trim() || "";
  const [activeCustomerId, setActiveCustomerId] = useState<string>("");

  const [profile, setProfile] = useState<ApplicantProfileResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync active customer ID
  useEffect(() => {
    if (selectedApplicant?.customer_id) {
      setActiveCustomerId(selectedApplicant.customer_id);
    } else if (customerIdFromUrl) {
      setActiveCustomerId(customerIdFromUrl);
      selectCustomerById(customerIdFromUrl);
    } else {
      setActiveCustomerId("");
      setProfile(null);
    }
  }, [selectedApplicant, customerIdFromUrl, selectCustomerById]);

  // Fetch applicant profile whenever active customer ID changes
  const loadProfile = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getApplicantProfile(id);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || "Failed to load applicant profile data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeCustomerId) {
      loadProfile(activeCustomerId);
    }
  }, [activeCustomerId]);

  // Case 1: EMPTY STATE - No applicant selected
  if (!activeCustomerId && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Credit Assessment
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Alternative-data multi-model underwriting, SHAP explainability, and loan recommendations
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500 mb-4">
            <Users className="w-7 h-7 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            No Applicant Selected
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
            Please select an applicant profile from the Underwriting Queue to review alternative-data coverage, inspect supporting financial signals, and evaluate creditworthiness.
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

  // Case 2: LOADING STATE
  if (loading && !profile) {
    return (
      <div className="space-y-6">
        <div className="py-20 text-center">
          <RefreshCw className="w-6 h-6 text-sky-600 animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-800">
            Loading applicant profile...
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            Fetching data coverage & financial signals for {activeCustomerId}
          </div>
        </div>
      </div>
    );
  }

  // Case 3: ERROR STATE
  if (error && !profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/applicants"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Applicants Queue</span>
          </Link>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-6 max-w-2xl mx-auto text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-rose-900">
            Unable to Load Applicant Profile
          </h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">
            {error}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => loadProfile(activeCustomerId)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-white border border-rose-300 text-rose-700 text-xs font-medium hover:bg-rose-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => navigate("/applicants")}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Choose Another Applicant</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const dataCoverage = profile?.data_coverage;
  const financialSignals = profile?.financial_signals;

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

      {/* SECTION 1: APPLICANT DOSSIER HEADER */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Underwriting Dossier
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                {profile?.persona}
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {profile?.customer_id}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
              <span>
                Synthetic applicant profile &bull; Alternative-data underwriting analysis
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadProfile(activeCustomerId)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors"
              title="Refresh profile data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: DATA COVERAGE PANEL */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Data Source Availability
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified availability across 6 alternative transactional verticals for this applicant
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold self-start sm:self-auto border border-slate-200">
            <span className="font-mono text-sky-700 font-bold">
              {dataCoverage?.available_count} of {dataCoverage?.total_count}
            </span>{" "}
            sources available
          </div>
        </div>

        {/* Clean Horizontal Source-Availability Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {DATA_SOURCES_CONFIG.map((source) => {
            const isAvailable = dataCoverage ? Boolean(dataCoverage[source.key]) : false;
            const IconComponent = source.icon;

            return (
              <div
                key={source.key}
                className={`p-3.5 rounded-lg border transition-all ${
                  isAvailable
                    ? "bg-white border-slate-200 shadow-sm"
                    : "bg-slate-50/60 border-dashed border-slate-200 text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center ${
                      isAvailable
                        ? "bg-slate-100 text-slate-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </div>

                  {isAvailable ? (
                    <span
                      className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                      title="Source data present in profile"
                    >
                      <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" />
                      Active
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                      title="Source not applicable or missing for this profile"
                    >
                      <MinusCircle className="w-3 h-3 mr-0.5 text-slate-400" />
                      Absent
                    </span>
                  )}
                </div>

                <div
                  className={`text-xs font-semibold ${
                    isAvailable ? "text-slate-900" : "text-slate-500"
                  }`}
                >
                  {source.name}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {source.description}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>
            Source coverage is derived directly from raw synthetic record vertical presence. Absent sources reflect deliberate thin-file persona constraints and do not represent negative credit behavior.
          </span>
        </div>
      </div>

      {/* SECTION 3: SUPPORTING FINANCIAL SIGNALS PANEL */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Supporting Financial Signals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent raw-data signals derived from transaction cadence and payment regularity
            </p>
          </div>

          <div className="text-[11px] text-slate-500 font-medium px-2.5 py-1 bg-slate-50 rounded border border-slate-200 self-start sm:self-auto">
            Supporting source-data signals &bull; Not model credit tiers
          </div>
        </div>

        {/* 3 Horizontal Progress Bars */}
        <div className="space-y-5">
          {/* Signal 1: UPI Activity */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div>
                <span className="font-semibold text-slate-800">UPI Activity</span>
                <span className="text-slate-400 ml-2">
                  (Active transaction days scaled against 30-day baseline)
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {financialSignals?.upi_activity !== null &&
                financialSignals?.upi_activity !== undefined
                  ? `${financialSignals.upi_activity.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              <div
                className="bg-slate-800 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, financialSignals?.upi_activity || 0)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Signal 2: Cashflow Stability */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div>
                <span className="font-semibold text-slate-800">
                  Cashflow Stability
                </span>
                <span className="text-slate-400 ml-2">
                  (Inflow volatility resilience & consistency)
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {financialSignals?.cashflow_stability !== null &&
                financialSignals?.cashflow_stability !== undefined
                  ? `${financialSignals.cashflow_stability.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              <div
                className="bg-slate-800 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, financialSignals?.cashflow_stability || 0)
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Signal 3: Payment Consistency */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <div>
                <span className="font-semibold text-slate-800">
                  Payment Consistency
                </span>
                <span className="text-slate-400 ml-2">
                  (Utility and telecom recurring recharge timeliness)
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-sm">
                {financialSignals?.payment_consistency !== null &&
                financialSignals?.payment_consistency !== undefined
                  ? `${financialSignals.payment_consistency.toFixed(1)}%`
                  : "Not Available"}
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/60">
              {financialSignals?.payment_consistency !== null &&
              financialSignals?.payment_consistency !== undefined ? (
                <div
                  className="bg-slate-800 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, financialSignals.payment_consistency)
                    )}%`,
                  }}
                />
              ) : (
                <div className="bg-slate-200 h-2 rounded-full w-full" />
              )}
            </div>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>
            Calculated directly using established Python raw-data indicators (`src.utils.helpers.fingerprint_indicators`). These are not model output scores and are rendered using restrained neutral accents.
          </span>
        </div>
      </div>

      {/* RESERVED WORKSPACE FOR UPCOMING MODULES */}
      <div className="border border-dashed border-slate-300 rounded-lg p-8 bg-white/50 text-center space-y-2">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Activity className="w-5 h-5" />
        </div>
        <div className="text-sm font-semibold text-slate-700">
          Underwriting Decision & Explainability Workspace
        </div>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Credit Decision Scorecard, Risk Tiers, SHAP adverse reason codes, and Path-to-Eligibility (What-If simulator) will be unlocked in subsequent steps.
        </p>
      </div>
    </div>
  );
};
