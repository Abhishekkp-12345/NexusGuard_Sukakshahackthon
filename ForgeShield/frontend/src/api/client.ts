/**
 * ForgeShield AI — API Client (Production v2)
 * All axios calls to the FastAPI backend.
 */

import axios from "axios";

const BASE_URL = "http://localhost:8000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000, // 3 minutes for Ollama/heavy processing
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
  confidence?: number;
  region_count?: number;
}

export interface RegionAnnotation {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  method: string;
  label: string;
  x_rel: number;
  y_rel: number;
  w_rel: number;
  h_rel: number;
}

export interface ManipulationRegion {
  document: string;
  label: string;
  method: string;
  confidence: number;
  coordinates: { x: number; y: number; w: number; h: number };
}

export interface TamperResult {
  tampered: boolean;
  tamper_score: number;
  tamper_penalty: number;
  findings: Finding[];
  tamper_visualization?: string | null;
  region_annotations: RegionAnnotation[];
  detector_results?: Record<string, any>;
  noise_inconsistency: number;
  clone_detected: boolean;
  text_alignment_clean: boolean;
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
    metadata: Record<string, any>;
  };
  tamper_result?: TamperResult;
  extracted_fields: Record<string, any>;
}

export interface TrustScoreAudit {
  base_score: number;
  deductions: Array<{ category: string; reason: string; penalty: number }>;
  total_penalty: number;
  final_score: number;
  verdict: string;
  verdict_reason: string;
}

export interface MatrixEntry {
  field: string;
  sourceA: string;
  valueA: string;
  sourceB: string;
  valueB: string;
  match: boolean;
  similarity?: number;
}

export interface IdentityVerificationResult {
  critical_identity_mismatch: boolean;
  identity_penalty: number;
  matched_fields: MatrixEntry[];
  mismatched_fields: MatrixEntry[];
  field_comparison_matrix: MatrixEntry[];
  findings: Finding[];
  identity_summary: string;
  sources_compared: string[];
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

export interface GSTVerificationResult {
  gstin: string;
  valid_format: boolean;
  status: string;
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
  ring_type: string;
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
  identity_score: number;
  financial_score: number;
  ocr_confidence: number;
  relationship_risk_score: number;
  overall_score: number;
  verdict: "APPROVE" | "HOLD" | "REJECT";
  verdict_color: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  score_breakdown: Record<string, any>;
  trust_score_audit?: TrustScoreAudit;
  all_findings: Finding[];
  high_severity_count: number;
  medium_severity_count: number;
  manipulation_summary?: ManipulationRegion[];
  identity_verification?: IdentityVerificationResult;
  tamper_detection?: {
    any_tampered: boolean;
    total_tamper_penalty: number;
    clone_detected: boolean;
    tamper_visualizations: Array<{
      filename: string;
      visualization_b64: string;
      region_annotations: RegionAnnotation[];
      tamper_score: number;
    }>;
  };
  ai_recommendation: string;
  document_reports: DocumentReport[];
  graph_data: any;
  consistency_matrix?: any[];
  compliance_violations?: any[];
  timeline?: Array<{
    date: string;
    label: string;
    type: string;
    filename: string;
  }>;
}

// ── API Functions ──────────────────────────────────────────────────────

export const casesApi = {
  list: () => api.get<Case[]>("/cases/").then((r) => r.data),
  get: (id: string) => api.get<Case>(`/cases/${id}`).then((r) => r.data),
  create: (data: any) => api.post<Case>("/cases/", data).then((r) => r.data),
  updateVerdict: (id: string, verdict: string, notes?: string) =>
    api.patch<Case>(`/cases/${id}/verdict`, { verdict, notes }).then((r) => r.data),
  delete: (id: string) => api.delete(`/cases/${id}`),
  stats: () => api.get("/cases/stats/summary").then((r) => r.data),
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
  ollamaStatus: () => api.get("/forensics/ollama-status").then((r) => r.data),
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
