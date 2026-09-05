import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Users,
  ArrowRight,
  Database,
  Briefcase,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import { useApplicant } from "../context/ApplicantContext";
import type { ApplicantSummary } from "../services/api";

const PERSONA_OPTIONS = [
  "All",
  "Small Merchant",
  "Gig Worker",
  "First-time Borrower",
  "Informal/Rural Worker",
] as const;

type PersonaFilter = (typeof PERSONA_OPTIONS)[number];

export const ApplicantsPage: React.FC = () => {
  const navigate = useNavigate();
  const { applicants, loading, error, setSelectedApplicant, fetchApplicants } =
    useApplicant();

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedPersona, setSelectedPersona] = useState<PersonaFilter>("All");

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Compute summary stats by persona from already-loaded data
  const personaCounts = useMemo(() => {
    const counts: Record<string, number> = {
      "Small Merchant": 0,
      "Gig Worker": 0,
      "First-time Borrower": 0,
      "Informal/Rural Worker": 0,
    };
    for (const applicant of applicants) {
      if (counts[applicant.persona] !== undefined) {
        counts[applicant.persona]++;
      }
    }
    return counts;
  }, [applicants]);

  // Combined client-side search and persona filtering
  const filteredApplicants = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return applicants.filter((applicant) => {
      const matchesPersona =
        selectedPersona === "All" || applicant.persona === selectedPersona;

      if (!matchesPersona) return false;
      if (!term) return true;

      const matchesId = applicant.customer_id.toLowerCase().includes(term);
      const matchesPersonaText = applicant.persona.toLowerCase().includes(term);
      return matchesId || matchesPersonaText;
    });
  }, [applicants, searchTerm, selectedPersona]);

  // Reset to page 1 whenever filters change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handlePersonaChange = (persona: PersonaFilter) => {
    setSelectedPersona(persona);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Pagination calculations
  const totalItems = filteredApplicants.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedApplicants = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredApplicants.slice(start, start + pageSize);
  }, [filteredApplicants, validCurrentPage, pageSize]);

  // Handle Underwriter Action: Select applicant and route to assessment
  const handleOpenAssessment = (applicant: ApplicantSummary) => {
    setSelectedApplicant(applicant);
    navigate(`/assessment?id=${encodeURIComponent(applicant.customer_id)}`);
  };

  const getPersonaBadgeStyle = (persona: string) => {
    switch (persona) {
      case "Small Merchant":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "Gig Worker":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "First-time Borrower":
        return "bg-slate-100 text-slate-800 border-slate-300";
      case "Informal/Rural Worker":
        return "bg-slate-100 text-slate-800 border-slate-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Applicants
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              Internal Underwriting Queue
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Directory of synthetic alternative-data applicants available for risk evaluation and underwriting
          </p>
        </div>

        {/* Dataset Disclaimer Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100/80 border border-slate-200 text-xs text-slate-600 self-start sm:self-auto">
          <Database className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span>Synthetic applicant profiles (8,000 records)</span>
        </div>
      </div>

      {/* Summary KPI Cards: Persona Counts without per-row scoring */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => handlePersonaChange("All")}
          className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
            selectedPersona === "All"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>Total Queue</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            {applicants.length.toLocaleString()}
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">All segments</div>
        </div>

        <div
          onClick={() => handlePersonaChange("Small Merchant")}
          className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
            selectedPersona === "Small Merchant"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>Small Merchant</span>
            <Briefcase className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            {(personaCounts["Small Merchant"] || 0).toLocaleString()}
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">GST & UPI heavy</div>
        </div>

        <div
          onClick={() => handlePersonaChange("Gig Worker")}
          className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
            selectedPersona === "Gig Worker"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>Gig Worker</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            {(personaCounts["Gig Worker"] || 0).toLocaleString()}
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">Mobility & UPI</div>
        </div>

        <div
          onClick={() => handlePersonaChange("First-time Borrower")}
          className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
            selectedPersona === "First-time Borrower"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>First-time Borrower</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            {(personaCounts["First-time Borrower"] || 0).toLocaleString()}
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">Thin formal file</div>
        </div>

        <div
          onClick={() => handlePersonaChange("Informal/Rural Worker")}
          className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
            selectedPersona === "Informal/Rural Worker"
              ? "bg-slate-900 text-white border-slate-900 shadow-sm"
              : "bg-white text-slate-800 border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs opacity-75">
            <span>Informal/Rural</span>
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-bold font-mono mt-1">
            {(personaCounts["Informal/Rural Worker"] || 0).toLocaleString()}
          </div>
          <div className="text-[11px] opacity-75 mt-0.5">Utility & Telecom</div>
        </div>
      </div>

      {/* Main Filter and Search Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Instant Client-side Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by Customer ID or persona..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:bg-white transition-colors font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Rows Per Page Selector */}
          <div className="flex items-center gap-2 self-end md:self-auto text-xs text-slate-600">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Persona Filter Pills Bar */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2">
            Segment:
          </span>
          {PERSONA_OPTIONS.map((persona) => {
            const isSelected = selectedPersona === persona;
            const count =
              persona === "All" ? applicants.length : personaCounts[persona] || 0;
            return (
              <button
                key={persona}
                onClick={() => handlePersonaChange(persona)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                }`}
              >
                <span>{persona}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected
                      ? "bg-slate-800 text-slate-200"
                      : "bg-white text-slate-500 border border-slate-200"
                  }`}
                >
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div>
              <div className="font-semibold">Unable to load applicant directory</div>
              <div className="text-xs mt-0.5 text-rose-600">{error}</div>
            </div>
          </div>
          <button
            onClick={fetchApplicants}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-rose-300 rounded text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <RefreshCw className="w-6 h-6 text-sky-600 animate-spin mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-800">
              Loading 8,000 synthetic applicant profiles...
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Fetching records from GET /api/applicants
            </div>
          </div>
        ) : filteredApplicants.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800">
              No matching applicants found
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No applicant records match your current search and segment filters. Try clearing your search term.
            </p>
            {(searchTerm || selectedPersona !== "All") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedPersona("All");
                  setCurrentPage(1);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Applicant / Customer ID</th>
                  <th className="py-3 px-4">Target Persona</th>
                  <th className="py-3 px-4">Data Profile</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {paginatedApplicants.map((applicant, index) => {
                  const absoluteIndex =
                    (validCurrentPage - 1) * pageSize + index + 1;
                  return (
                    <tr
                      key={applicant.customer_id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Index Number */}
                      <td className="py-3 px-4 text-xs text-slate-400 text-center font-mono">
                        {absoluteIndex}
                      </td>

                      {/* Customer ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-800 group-hover:text-sky-700 transition-colors">
                            {applicant.customer_id}
                          </span>
                        </div>
                      </td>

                      {/* Target Persona */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${getPersonaBadgeStyle(
                            applicant.persona
                          )}`}
                        >
                          {applicant.persona}
                        </span>
                      </td>

                      {/* Data Profile Status */}
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Synthetic profile</span>
                        </div>
                      </td>

                      {/* Action Button: Open Assessment */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenAssessment(applicant)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-all shadow-sm group-hover:bg-sky-700"
                        >
                          <span>Open Assessment</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Pagination Footer */}
        {!loading && filteredApplicants.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing{" "}
              <span className="font-semibold text-slate-900 font-mono">
                {((validCurrentPage - 1) * pageSize + 1).toLocaleString()}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-slate-900 font-mono">
                {Math.min(
                  validCurrentPage * pageSize,
                  totalItems
                ).toLocaleString()}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-slate-900 font-mono">
                {totalItems.toLocaleString()}
              </span>{" "}
              applicants
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage === 1}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="First page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validCurrentPage === 1}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 py-1 text-xs text-slate-700 font-medium">
                Page <strong className="font-mono">{validCurrentPage}</strong> of{" "}
                <strong className="font-mono">{totalPages}</strong>
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validCurrentPage === totalPages}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage === totalPages}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Last page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
