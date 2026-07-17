/**
 * ForgeShield AI — API Client
 * All axios calls to the FastAPI backend.
 */

import axios from "axios";

const BASE_URL = "http://localhost:8000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000, // 3 minutes for Ollama
});

// ── Types ──────────────────────────────────────────────────────────────

export interface Case {
  case_id: string;
  applicant_name: string;
  applicant_pan?: string;
  loan_type: string;
  loan_amount: number;
  branch: string;
  status: "PENDING" | "ANALYZING" | "ANALYZED" | "REVIEWED" | "ERROR";
  verdict: "APPROVE" | "HOLD" | "REJECT" | null;
  verdict_notes?: string;
  reviewed_by?: string;
  created_at: string;
  updated_at: string;
  documents: string[];
  analysis: AnalysisResult | null;
}

export interface Finding {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  detail: string;
  document?: string;
  sources?: Record<string, number>;
  deviation_pct?: number;
}

export interface AnalysisResult {
  case_id: string;
  analyzed_at: string;
  elapsed_ms: number;
  applicant_name: string;
  loan_amount: number;
  loan_type: string;
  branch: string;
  authenticity_score: number;
  consistency_score: number;
  relationship_risk_score: number;
  overall_score: number;
  verdict: "APPROVE" | "HOLD" | "REJECT";
  verdict_color: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score_breakdown: {
    authenticity: { score: number; weight: number; contribution: number };
    consistency: { score: number; weight: number; contribution: number };
    relationship: { risk_score: number; safety_score: number; weight: number; contribution: number };
  };
  all_findings: Finding[];
  high_severity_count: number;
  medium_severity_count: number;
  ai_recommendation: string;
  document_reports: DocumentReport[];
  graph_data: GraphData;
  income_analysis: Record<string, unknown>;
  gst_verification?: GSTVerificationResult;
  timeline?: {
    date: string;
    label: string;
    type: string;
    filename: string;
  }[];
}

export interface DocumentReport {
  filename: string;
  type: string;
  authenticity_score: number;
  ela_result?: {
    tamper_score: number;
    mean_diff: number;
    heatmap_b64: string;
    suspicious_regions: string[];
  };
  pdf_forensics?: {
    authenticity_score: number;
    flags: string[];
    findings: Finding[];
    metadata: {
      title?: string;
      author?: string;
      creator?: string;
      producer?: string;
      creation_date?: string;
      mod_date?: string;
      num_pages?: number;
      fonts?: string[];
    };
  };
  extracted_fields: Record<string, unknown>;
}

export interface GraphData {
  nodes: {
    id: string;
    label: string;
    type: string;
    color: string;
    data: Record<string, unknown>;
  }[];
  links: {
    source: string;
    target: string;
    label: string;
    case_id?: string;
  }[];
}

export interface CaseStats {
  total_cases: number;
  approved: number;
  held: number;
  rejected: number;
  pending: number;
  total_loan_at_risk: number;
  fraud_detection_rate: number;
}

// ── Intelligence Types ─────────────────────────────────────────────────

export interface GSTVerificationResult {
  gstin: string;
  valid_format: boolean;
  status: "ACTIVE" | "CANCELLED" | "SUSPENDED" | "NOT_FOUND" | "API_UNAVAILABLE" | "INVALID_FORMAT";
  legal_name: string | null;
  trade_name: string | null;
  state: string | null;
  registration_date: string | null;
  taxpayer_type: string | null;
  annual_turnover: number | null;
  findings: Finding[];
  flags: string[];
  gst_risk_score: number;
}

export interface FraudRing {
  ring_id: string;
  ring_type: "SHARED_EMPLOYER" | "LOAN_STACKING" | "SHARED_ADDRESS";
  ring_type_label: string;
  shared_entity: string;
  description: string;
  severity: "HIGH" | "MEDIUM";
  case_count: number;
  cases: { case_id: string; applicant_name: string; loan_amount: number; loan_type: string; verdict: string }[];
  total_loan_exposure: number;
  detected_at: string;
}

export interface FraudRingsResponse {
  fraud_rings: FraudRing[];
  total_rings_detected: number;
  high_severity: number;
  medium_severity: number;
  generated_at: string;
}

export interface GeoStateData {
  state: string;
  total_cases: number;
  approved: number;
  hold: number;
  rejected: number;
  pending: number;
  high_severity_findings: number;
  total_loan_amount: number;
  fraud_rate_pct: number;
  risk_score: number;
  risk_level: "HIGH" | "MEDIUM" | "LOW";
  top_fraud_types: { type: string; count: number }[];
  loan_at_risk: number;
}

export interface GeoHeatmapResponse {
  states: GeoStateData[];
  total_states: number;
  national_fraud_rate: number;
  total_loan_at_risk: number;
  generated_at: string;
}

// ── API Functions ──────────────────────────────────────────────────────

export const casesApi = {
  list: () => api.get<Case[]>("/cases/").then((r) => r.data),
  get: (id: string) => api.get<Case>(`/cases/${id}`).then((r) => r.data),
  create: (data: {
    applicant_name: string;
    applicant_pan?: string;
    loan_type: string;
    loan_amount: number;
    branch: string;
  }) => api.post<Case>("/cases/", data).then((r) => r.data),
  updateVerdict: (id: string, verdict: string, notes?: string) =>
    api.patch<Case>(`/cases/${id}/verdict`, { verdict, notes }).then((r) => r.data),
  stats: () => api.get<CaseStats>("/cases/stats/summary").then((r) => r.data),
};

export const forensicsApi = {
  analyze: (caseId: string, files: File[], docTypes: string[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    form.append("doc_types", docTypes.join(","));
    return api
      .post<AnalysisResult>(`/forensics/analyze/${caseId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  ollamaStatus: () =>
    api.get("/forensics/ollama-status").then((r) => r.data),
};

export const reportsApi = {
  downloadPdf: (caseId: string) =>
    api
      .get(`/reports/${caseId}/pdf`, { responseType: "blob" })
      .then((r) => {
        const url = URL.createObjectURL(r.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ForgeShield_Report_${caseId.replace(/\//g, "_")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }),
};

export const intelligenceApi = {
  fraudRings: () => api.get<FraudRingsResponse>("/intelligence/fraud-rings").then((r) => r.data),
  geoHeatmap: () => api.get<GeoHeatmapResponse>("/intelligence/geo-heatmap").then((r) => r.data),
};
