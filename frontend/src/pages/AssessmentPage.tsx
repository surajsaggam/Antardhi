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
  Info,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Sliders,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
import { useApplicant } from "../context/ApplicantContext";
import {
  getApplicantProfile,
  getAssessment,
  runWhatIf,
  type ApplicantProfileResponse,
  type AssessmentResponse,
  type WhatIfResponse,
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

  // What-If Simulation state
  const [whatIfResult, setWhatIfResult] = useState<WhatIfResponse | null>(null);
  const [loadingWhatIf, setLoadingWhatIf] = useState<boolean>(false);
  const [whatIfError, setWhatIfError] = useState<string | null>(null);

  // Behavior controls
  const [inflowPct, setInflowPct] = useState<number>(0);
  const [improveUtility, setImproveUtility] = useState<boolean>(false);

  // Loading & Error states
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);
  const [loadingAssessment, setLoadingAssessment] = useState<boolean>(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  // Execute What-If simulation against /api/what-if
  const executeWhatIf = async (
    id: string,
    inflow: number,
    targetUtility: boolean
  ) => {
    if (!id) return;
    setLoadingWhatIf(true);
    setWhatIfError(null);

    const targetChange: Record<string, unknown> = {
      inflow_pct: inflow,
    };
    if (targetUtility) {
      targetChange.utility_payment_regularity = 0.95;
    }

    try {
      const res = await runWhatIf(id, targetChange);
      setWhatIfResult(res);
    } catch (err: any) {
      setWhatIfError(err.message || "Failed to execute what-if simulation");
    } finally {
      setLoadingWhatIf(false);
    }
  };

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
      setWhatIfResult(null);
      setWhatIfError(null);
      setInflowPct(0);
      setImproveUtility(false);
    }
  }, [selectedApplicant, customerIdFromUrl, selectCustomerById]);

  // Fetch applicant profile and assessment in parallel
  const loadData = async (id: string) => {
    if (!id) return;

    // Reset simulator controls
    setInflowPct(0);
    setImproveUtility(false);
    setWhatIfError(null);

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
      .then((data) => {
        setAssessment(data);
        // Automatically run initial What-If with neutral baseline (0% change)
        executeWhatIf(id, 0, false);
      })
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

      {/* SECTION 5: SHAP EXPLAINABILITY & WHAT-IF SIMULATOR */}
      {assessment && (
        <div className="space-y-6">
          {/* SECTION A — SHAP ADVERSE REASON CODES */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    SHAP Adverse Reason Codes
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Explainability Layer
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Model-derived feature drivers ranked by explainability impact. Impact indicates whether the factor contributed positively or negatively to the credit assessment.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200 whitespace-nowrap self-start sm:self-auto font-mono">
                TreeExplainer &bull; Ranked Top-5
              </div>
            </div>

            {/* 5 Reason Cards */}
            <div className="space-y-2.5">
              {assessment.reason_codes.map((rc, idx) => {
                const isPositive = rc.impact === "+";
                return (
                  <div
                    key={`${rc.factor}-${idx}`}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border transition-colors ${
                      isPositive
                        ? "bg-slate-50/70 border-emerald-100 hover:border-emerald-200"
                        : "bg-slate-50/70 border-rose-100 hover:border-rose-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold bg-slate-200/80 text-slate-700 flex-shrink-0 mt-0.5">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold font-mono text-slate-900">
                            {rc.factor}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {rc.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 sm:mt-0 flex items-center gap-2 pl-9 sm:pl-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          isPositive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {isPositive ? (
                          <>
                            <TrendingUp className="w-3.5 h-3.5" />
                            Positive Driver (+)
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-3.5 h-3.5" />
                            Adverse Driver (-)
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
              <span>
                Underwriting Note: Impact indicates whether each marginal factor contributed positively (+) or negatively (-) to the composite assessment relative to the segment baseline.
              </span>
            </div>
          </div>

          {/* SECTION B — PATH TO ELIGIBILITY / WHAT-IF SIMULATOR */}
          <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Path to Eligibility / What-If Simulator
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Counterfactual Sandbox
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Adjust candidate behavioral parameters to simulate counterfactual credit score improvement, risk tier migration, and calibrated loan capacity.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200 whitespace-nowrap self-start sm:self-auto font-mono">
                POST /api/what-if
              </div>
            </div>

            {/* Behavior Controls */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  Behavior Controls
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInflowPct(0);
                    setImproveUtility(false);
                    executeWhatIf(activeCustomerId, 0, false);
                  }}
                  disabled={loadingWhatIf || (inflowPct === 0 && !improveUtility)}
                  className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Baseline (0%)
                </button>
              </div>

              {/* Control 1: Inflow Percentage Slider & Presets */}
              <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="inflow-slider" className="text-xs font-semibold text-slate-800">
                      Monthly UPI Cashflow Growth (<code className="font-mono text-slate-600">inflow_pct</code>)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Simulate average monthly transaction inflow adjustment across UPI channels
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      id="inflow-pct-display"
                      className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${
                        inflowPct > 0
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : inflowPct < 0
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {inflowPct > 0 ? `+${inflowPct}%` : `${inflowPct}%`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <input
                    id="inflow-slider"
                    type="range"
                    min="-20"
                    max="50"
                    step="5"
                    value={inflowPct}
                    onChange={(e) => setInflowPct(Number(e.target.value))}
                    disabled={loadingWhatIf}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Preset Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Presets:</span>
                  {[-10, 0, 10, 20, 30, 50].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setInflowPct(preset)}
                      disabled={loadingWhatIf}
                      className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                        inflowPct === preset
                          ? "bg-blue-600 text-white border-blue-600 font-semibold"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {preset > 0 ? `+${preset}%` : `${preset}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Control 2: Utility Payment Regularity Target */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-lg border border-slate-200">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <label htmlFor="utility-toggle" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Target Utility Payment Regularity (<code className="font-mono text-slate-600">utility_payment_regularity</code>)
                    </label>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                      Target: 0.95 (95%)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Simulate improved discipline: on-time utility bill payment consistency at 95%
                  </p>
                </div>
                <input
                  id="utility-toggle"
                  type="checkbox"
                  checked={improveUtility}
                  onChange={(e) => setImproveUtility(e.target.checked)}
                  disabled={loadingWhatIf}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-slate-500">
                  Select parameters above and execute counterfactual simulation
                </div>
                <button
                  type="button"
                  id="recalculate-what-if-btn"
                  onClick={() => executeWhatIf(activeCustomerId, inflowPct, improveUtility)}
                  disabled={loadingWhatIf}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingWhatIf ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Recalculating...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Recalculate What-If</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error State */}
            {whatIfError && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-semibold">Simulation Error: </span>
                  {whatIfError}
                </div>
              </div>
            )}

            {/* Results Comparison Grid */}
            {whatIfResult && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Card 1: Score Transition & Delta */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Score Transition</span>
                      <span
                        id="whatif-score-delta-badge"
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                          whatIfResult.delta > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : whatIfResult.delta < 0
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {whatIfResult.delta > 0 ? `+${whatIfResult.delta} pts` : `${whatIfResult.delta} pts`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Current</div>
                        <div className="text-2xl font-bold font-mono text-slate-700">
                          {whatIfResult.current_score}
                        </div>
                      </div>

                      <ArrowRight className="w-5 h-5 text-slate-400" />

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Projected</div>
                        <div id="whatif-projected-score" className="text-2xl font-bold font-mono text-slate-900">
                          {whatIfResult.new_score}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      Score range: 300 – 900
                    </div>
                  </div>

                  {/* Card 2: Risk Tier Transition */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Risk Tier Transition</span>
                      {whatIfResult.current_tier !== whatIfResult.new_tier ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Tier Migration
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                          Unchanged
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Current Tier</div>
                        <div className="mt-1">
                          <span className={getTierBadgeClass(whatIfResult.current_tier)}>
                            {whatIfResult.current_tier}
                          </span>
                        </div>
                      </div>

                      <ArrowRight className="w-5 h-5 text-slate-400 mt-3" />

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Projected Tier</div>
                        <div className="mt-1">
                          <span id="whatif-projected-tier" className={getTierBadgeClass(whatIfResult.new_tier)}>
                            {whatIfResult.new_tier}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      Thresholds: Low (&ge;750), Med (&ge;600), High (&lt;600)
                    </div>
                  </div>

                  {/* Card 3: Recommended Loan Transition */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500">Recommended Loan</span>
                      <span
                        id="whatif-loan-delta-badge"
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                          whatIfResult.loan_delta > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : whatIfResult.loan_delta < 0
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }`}
                      >
                        {whatIfResult.loan_delta > 0
                          ? `+₹${whatIfResult.loan_delta.toLocaleString("en-IN")}`
                          : `₹${whatIfResult.loan_delta.toLocaleString("en-IN")}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Current</div>
                        <div className="text-lg font-bold font-mono text-slate-700">
                          ₹{whatIfResult.current_loan.toLocaleString("en-IN")}
                        </div>
                      </div>

                      <ArrowRight className="w-5 h-5 text-slate-400" />

                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">Projected</div>
                        <div id="whatif-projected-loan" className="text-lg font-bold font-mono text-slate-900">
                          ₹{whatIfResult.new_loan.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      Calibrated capacity from simulated cashflow proxy
                    </div>
                  </div>
                </div>

                {/* Projected Terms (Tenure & EMI) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Projected Tenure</div>
                      <div className="text-[11px] text-slate-400">Policy amortization duration</div>
                    </div>
                    <div id="whatif-projected-tenure" className="text-base font-mono font-bold text-slate-900">
                      {whatIfResult.recommended_tenure_months} months
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Projected Monthly EMI</div>
                      <div className="text-[11px] text-slate-400">Reducing balance amortization</div>
                    </div>
                    <div id="whatif-projected-emi" className="text-base font-mono font-bold text-slate-900">
                      ₹{whatIfResult.recommended_emi.toLocaleString("en-IN", { maximumFractionDigits: 0 })}{" "}
                      <span className="text-xs font-normal text-slate-500">/ mo</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Simulation Disclaimer */}
            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold">Underwriting Notice: </span>
                Simulation only — changing one behavior does not guarantee approval or disbursement. All outcomes remain contingent on final KYC, fraud clearance, and credit committee approval.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
