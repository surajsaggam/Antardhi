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
  HelpCircle,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { useApplicant } from "../context/ApplicantContext";
import {
  getApplicantProfile,
  getAssessment,
  type ApplicantProfileResponse,
  type AssessmentResponse,
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

  // Data states
  const [profile, setProfile] = useState<ApplicantProfileResponse | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);

  // Loading & Error states
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [loadingAssessment, setLoadingAssessment] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

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
      setAssessment(null);
    }
  }, [selectedApplicant, customerIdFromUrl, selectCustomerById]);

  // Fetch applicant profile and assessment in parallel
  const loadData = async (id: string) => {
    if (!id) return;

    // Load Profile
    setLoadingProfile(true);
    setProfileError(null);
    getApplicantProfile(id)
      .then((data) => setProfile(data))
      .catch((err) => setProfileError(err.message || "Failed to load profile"))
      .finally(() => setLoadingProfile(false));

    // Load Assessment
    setLoadingAssessment(true);
    setAssessmentError(null);
    getAssessment(id)
      .then((data) => setAssessment(data))
      .catch((err) =>
        setAssessmentError(err.message || "Failed to score applicant")
      )
      .finally(() => setLoadingAssessment(false));
  };

  useEffect(() => {
    if (activeCustomerId) {
      loadData(activeCustomerId);
    }
  }, [activeCustomerId]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Low Risk":
        return "#16a34a"; // emerald-600
      case "Medium Risk":
        return "#d97706"; // amber-600
      case "High Risk":
        return "#dc2626"; // rose-600
      default:
        return "#0284c7"; // sky-600
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case "Low Risk":
        return "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "Medium Risk":
        return "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200";
      case "High Risk":
        return "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200";
      default:
        return "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200";
    }
  };

  // Case 1: EMPTY STATE - No applicant selected
  if (!activeCustomerId && !loadingProfile) {
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

  // Case 2: GLOBAL INITIAL LOADING STATE (before active ID has any data)
  if (loadingProfile && !profile && !assessment) {
    return (
      <div className="space-y-6">
        <div className="py-20 text-center">
          <RefreshCw className="w-6 h-6 text-sky-600 animate-spin mx-auto mb-3" />
          <div className="text-sm font-semibold text-slate-800">
            Loading applicant assessment workspace...
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono">
            Fetching data coverage, signals & scorecard for {activeCustomerId}
          </div>
        </div>
      </div>
    );
  }

  // Case 3: PROFILE ERROR STATE
  if (profileError && !profile) {
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
            Unable to Load Applicant Dossier
          </h3>
          <p className="text-xs text-rose-700 mt-1 max-w-md mx-auto">
            {profileError}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => loadData(activeCustomerId)}
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
  const scoreVal = assessment ? Math.max(300, Math.min(900, assessment.score)) : 300;
  const tierColor = assessment ? getTierColor(assessment.tier) : "#0284c7";

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
                {profile?.persona || "Synthetic Applicant"}
              </span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {profile?.customer_id || activeCustomerId}
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
              onClick={() => loadData(activeCustomerId)}
              disabled={loadingProfile || loadingAssessment}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-medium text-slate-700 transition-colors disabled:opacity-50"
              title="Refresh dossier & scorecard"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  loadingProfile || loadingAssessment ? "animate-spin" : ""
                }`}
              />
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
              {dataCoverage?.available_count || 0} of {dataCoverage?.total_count || 6}
            </span>{" "}
            sources available
          </div>
        </div>

        {/* Clean Horizontal Source-Availability Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {DATA_SOURCES_CONFIG.map((source) => {
            const isAvailable = dataCoverage
              ? Boolean(dataCoverage[source.key])
              : false;
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

      {/* SECTION 4: CREDIT DECISION PANEL */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Credit Decision
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                Scorecard Output
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Alternative-data multi-model assessment and risk tier calibration
            </p>
          </div>

          <div className="text-[11px] text-slate-500 font-mono self-start sm:self-auto">
            Engine: Frozen LightGBM Challenger
          </div>
        </div>

        {/* Loading State for Assessment */}
        {loadingAssessment && !assessment && (
          <div className="py-12 text-center">
            <RefreshCw className="w-6 h-6 text-sky-600 animate-spin mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-800">
              Evaluating applicant creditworthiness...
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Running POST /api/assessment against multi-vertical model
            </div>
          </div>
        )}

        {/* Error State for Assessment */}
        {assessmentError && !assessment && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
              <div>
                <div className="font-semibold">Unable to complete credit scoring</div>
                <div className="text-xs mt-0.5 text-rose-600">
                  {assessmentError}
                </div>
              </div>
            </div>
            <button
              onClick={() => loadData(activeCustomerId)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-rose-300 rounded text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Real Assessment Result Display */}
        {assessment && (
          <div className="space-y-6">
            {/* Top Row: Gauge + Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left Column: Circular Score Gauge */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                <div className="relative w-[220px] h-[190px] flex items-center justify-center">
                  <PieChart width={220} height={190}>
                    <Pie
                      data={[
                        { value: Math.max(0, scoreVal - 300) },
                        { value: Math.max(0, 900 - scoreVal) },
                      ]}
                      cx={110}
                      cy={95}
                      startAngle={225}
                      endAngle={-45}
                      innerRadius={68}
                      outerRadius={86}
                      stroke="none"
                      dataKey="value"
                    >
                      <Cell fill={tierColor} />
                      <Cell fill="#e2e8f0" />
                    </Pie>
                  </PieChart>

                  {/* Centered Score Inside Circular Gauge */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-4xl font-bold font-mono text-slate-900 tracking-tight">
                      {assessment.score}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                      Composite Credit Score
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Scale: 300–900
                    </span>
                  </div>
                </div>

                {/* Below Gauge: Exact Tier Badge */}
                <div className="text-center mt-1">
                  <span className={getTierBadgeClass(assessment.tier)}>
                    {assessment.tier}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {assessment.tier === "Low Risk" && "Policy Threshold: 750–900"}
                    {assessment.tier === "Medium Risk" && "Policy Threshold: 600–749"}
                    {assessment.tier === "High Risk" && "Policy Threshold: 300–599"}
                  </div>
                </div>
              </div>

              {/* Right Column: Confidence & Anomaly (Visually Separate Cards) */}
              <div className="flex flex-col justify-center gap-3.5">
                {/* Confidence Card */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Confidence
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Data Depth
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                    {assessment.confidence.toFixed(1)}%
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-slate-700 h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, assessment.confidence)
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    Reflects transaction history length and connected data vertical coverage
                  </div>
                </div>

                {/* Anomaly Card */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Anomaly
                      </span>
                      <div className="group relative cursor-pointer">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 transition-colors" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-2.5 bg-slate-900 text-white text-[11px] rounded shadow-xl z-30 pointer-events-none leading-relaxed">
                          Anomaly reflects unusual behavioral patterns, independent of creditworthiness.
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Integrity Signal
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-2xl font-bold font-mono text-slate-900">
                      {assessment.anomaly_flag}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-medium">
                      Isolated from credit score
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span>
                      Anomaly reflects unusual behavioral patterns, independent of creditworthiness.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Recommended Financing */}
            <div className="pt-5 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recommended Financing
                </h3>
                <span className="text-[11px] text-slate-400">
                  Policy Loan Recommendation &bull; Directly from Engine
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Recommended Loan</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    ₹{assessment.recommended_loan.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Calibrated to alternative income proxy
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Tenure</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    {assessment.recommended_tenure_months} months
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Policy amortization duration
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-xs text-slate-500">Estimated EMI</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                    ₹{assessment.recommended_emi.toLocaleString("en-IN", {
                      maximumFractionDigits: 0,
                    })}{" "}
                    <span className="text-xs font-normal text-slate-500">/ month</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Monthly reducing balance amortization
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RESERVED WORKSPACE FOR UPCOMING MODULES */}
      <div className="border border-dashed border-slate-300 rounded-lg p-6 bg-white/50 text-center space-y-1.5">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <Activity className="w-4 h-4" />
        </div>
        <div className="text-xs font-semibold text-slate-700">
          Explainability & Simulation Workspace
        </div>
        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
          SHAP adverse reason codes and Path-to-Eligibility (What-If simulator) will unlock in subsequent steps.
        </p>
      </div>
    </div>
  );
};
