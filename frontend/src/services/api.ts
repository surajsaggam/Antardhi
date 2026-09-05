/**
 * Antardhi Alternative Data Credit Engine - API Service
 *
 * Calls the existing FastAPI backend wrapper endpoints.
 * All scoring, simulation, SHAP, and underwriting logic reside solely in the backend.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000";

export interface HealthResponse {
  status: string;
}

export interface ApplicantSummary {
  customer_id: string;
  persona: string;
}

export interface ReasonCode {
  factor: string;
  impact: string;
  description: string;
}

export interface AssessmentRequest {
  customer_id: string;
}

export interface AssessmentResponse {
  score: number;
  tier: string;
  confidence: number;
  anomaly_flag: string;
  reason_codes: ReasonCode[];
  recommended_loan: number;
  recommended_tenure_months: number;
  recommended_emi: number;
}

export interface WhatIfRequest {
  customer_id: string;
  target_change: Record<string, unknown>;
}

export interface WhatIfResponse {
  current_score: number;
  current_tier: string;
  new_score: number;
  new_tier: string;
  delta: number;
  current_loan: number;
  new_loan: number;
  loan_delta: number;
  recommended_loan: number;
  recommended_tenure_months: number;
  recommended_emi: number;
}

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    let detailText: string | undefined;
    try {
      const errorJson = await response.json();
      if (errorJson?.detail) {
        detailText =
          typeof errorJson.detail === "string"
            ? errorJson.detail
            : JSON.stringify(errorJson.detail);
        if (detailText) {
          errorMessage = detailText;
        }
      }
    } catch {
      // Body was not JSON
    }
    throw new ApiError(errorMessage, response.status, detailText);
  }
  return response.json() as Promise<T>;
}

/**
 * Health check endpoint: GET /api/health
 */
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  return handleResponse<HealthResponse>(response);
}

/**
 * Fetch applicants list: GET /api/applicants
 */
export async function getApplicants(): Promise<ApplicantSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/applicants`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  return handleResponse<ApplicantSummary[]>(response);
}

/**
 * Assess customer creditworthiness: POST /api/assessment
 */
export async function getAssessment(
  customerId: string
): Promise<AssessmentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/assessment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ customer_id: customerId }),
  });
  return handleResponse<AssessmentResponse>(response);
}

/**
 * Run Path-to-Eligibility What-If simulation: POST /api/what-if
 */
export async function runWhatIf(
  customerId: string,
  targetChange: Record<string, unknown>
): Promise<WhatIfResponse> {
  const response = await fetch(`${API_BASE_URL}/api/what-if`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      customer_id: customerId,
      target_change: targetChange,
    }),
  });
  return handleResponse<WhatIfResponse>(response);
}
