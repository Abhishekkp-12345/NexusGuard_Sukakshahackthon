/**
 * ForgeShield AI — Mock Data Layer
 * ==================================
 * Generates realistic banking/forensic mock data for all dashboard
 * charts, AI engine panels, and credit risk models.
 * All numbers are seeded to be consistent across sessions.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function rand(min: number, max: number, seed = 0): number {
  const x = Math.sin(seed + 1) * 10000;
  const r = x - Math.floor(x);
  return Math.round((min + r * (max - min)) * 100) / 100;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Dashboard KPI Data ────────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalApplications: number;
  pendingVerification: number;
  documentsUnderAnalysis: number;
  fraudAlerts: number;
  highRiskApplications: number;
  approvedLoans: number;
  rejectedLoans: number;
  manualReviewQueue: number;
  avgProbabilityOfDefault: number;
  avgTrustScore: number;
  avgFraudScore: number;
  totalLoanValueRequested: number; // in crores
}

export const DASHBOARD_KPIS: DashboardKPIs = {
  totalApplications: 1247,
  pendingVerification: 89,
  documentsUnderAnalysis: 34,
  fraudAlerts: 23,
  highRiskApplications: 67,
  approvedLoans: 834,
  rejectedLoans: 224,
  manualReviewQueue: 96,
  avgProbabilityOfDefault: 18.4,
  avgTrustScore: 72.1,
  avgFraudScore: 14.7,
  totalLoanValueRequested: 3847.5,
};

// ── Monthly Applications Chart ────────────────────────────────────────────────

export const MONTHLY_APPLICATIONS = MONTHS.map((month, i) => ({
  month,
  applications: 80 + Math.round(Math.sin(i * 0.7) * 25 + i * 4 + Math.random() * 10),
  approved: 50 + Math.round(Math.sin(i * 0.5) * 15 + i * 3),
  rejected: 15 + Math.round(Math.cos(i * 0.8) * 5 + 2),
  pending: 10 + Math.round(Math.sin(i + 1) * 4),
}));

// ── Fraud Detection Trend ─────────────────────────────────────────────────────

export const FRAUD_DETECTION_TREND = MONTHS.map((month, i) => ({
  month,
  fraudDetected: 5 + Math.round(Math.sin(i * 0.6 + 1) * 4 + i * 0.5),
  fraudPrevented: 3 + Math.round(Math.sin(i * 0.4) * 3 + i * 0.3),
  alertsRaised: 8 + Math.round(Math.cos(i * 0.9) * 5),
}));

// ── Risk Distribution ─────────────────────────────────────────────────────────

export const RISK_DISTRIBUTION = [
  { name: "Very Low Risk", value: 312, color: "#10b981" },
  { name: "Low Risk",      value: 456, color: "#22d3ee" },
  { name: "Moderate Risk", value: 298, color: "#f59e0b" },
  { name: "High Risk",     value: 134, color: "#f97316" },
  { name: "Critical Risk", value: 47,  color: "#ef4444" },
];

// ── Industry-wise Applications ────────────────────────────────────────────────

export const INDUSTRY_APPLICATIONS = [
  { industry: "Manufacturing",    applications: 234, riskScore: 42 },
  { industry: "Real Estate",      applications: 198, riskScore: 61 },
  { industry: "Trading",          applications: 187, riskScore: 38 },
  { industry: "IT & Services",    applications: 156, riskScore: 28 },
  { industry: "Agriculture",      applications: 143, riskScore: 35 },
  { industry: "Healthcare",       applications: 128, riskScore: 22 },
  { industry: "Construction",     applications: 112, riskScore: 55 },
  { industry: "Hospitality",      applications: 89,  riskScore: 67 },
];

// ── GST Sales Trend ───────────────────────────────────────────────────────────

export const GST_SALES_TREND = MONTHS.map((month, i) => ({
  month,
  reported: 120 + Math.round(Math.sin(i * 0.5) * 30 + i * 5),
  actual:   110 + Math.round(Math.sin(i * 0.5 + 0.3) * 25 + i * 4.5),
  variance: Math.round(Math.sin(i * 1.2) * 15),
}));

// ── Banking Cash Flow Trend ───────────────────────────────────────────────────

export const BANKING_CASH_FLOW = MONTHS.map((month, i) => ({
  month,
  inflow:     200 + Math.round(Math.sin(i * 0.6) * 50 + i * 3),
  outflow:    180 + Math.round(Math.cos(i * 0.7) * 40 + i * 2),
  netBalance: 20 + Math.round(Math.sin(i * 0.3) * 30 + i * 1),
}));

// ── Default Probability Distribution ─────────────────────────────────────────

export const DEFAULT_PROB_DISTRIBUTION = [
  { range: "0–10%",  count: 223 },
  { range: "11–20%", count: 387 },
  { range: "21–30%", count: 268 },
  { range: "31–40%", count: 156 },
  { range: "41–50%", count: 98  },
  { range: "51–60%", count: 64  },
  { range: "61–70%", count: 32  },
  { range: "71–80%", count: 14  },
  { range: "81–100%",count: 5   },
];

// ── Trust Score Distribution ──────────────────────────────────────────────────

export const TRUST_SCORE_DISTRIBUTION = MONTHS.map((month, i) => ({
  month,
  avgTrust: 65 + Math.round(Math.sin(i * 0.4) * 8 + i * 0.3),
  highTrust: 40 + Math.round(Math.sin(i * 0.6) * 12),
  lowTrust:  15 + Math.round(Math.cos(i * 0.5) * 5),
}));

// ── Notification Feed ─────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: "fraud" | "high_risk" | "tampering" | "missing_doc" | "ai_complete" | "manual_review";
  title: string;
  message: string;
  timestamp: string;
  caseId: string;
  read: boolean;
}

export const NOTIFICATIONS: Notification[] = [
  { id:"n1", type:"fraud", title:"Fraud Alert Detected", message:"Bank statement forgery detected in Case FS-2026-1089 with 94% confidence. Immediate review required.", timestamp:"2026-07-17T13:45:00Z", caseId:"FS-2026-1089", read:false },
  { id:"n2", type:"high_risk", title:"High Risk Application", message:"Mehta Industries Pvt Ltd shows Critical Risk (PD: 76%) due to negative DSCR and GST filing gaps.", timestamp:"2026-07-17T13:30:00Z", caseId:"FS-2026-1087", read:false },
  { id:"n3", type:"tampering", title:"Document Tampering", message:"ELA analysis detected pixel-level manipulation in salary slip for Case FS-2026-1085.", timestamp:"2026-07-17T12:55:00Z", caseId:"FS-2026-1085", read:false },
  { id:"n4", type:"ai_complete", title:"AI Analysis Complete", message:"5-layer forensic analysis for Rajesh Kumar completed. Trust Score: 84. Recommendation: Approve.", timestamp:"2026-07-17T12:20:00Z", caseId:"FS-2026-1083", read:true },
  { id:"n5", type:"manual_review", title:"Manual Review Required", message:"Inconsistency detected between GST registration name and bank account holder for Case FS-2026-1081.", timestamp:"2026-07-17T11:50:00Z", caseId:"FS-2026-1081", read:true },
  { id:"n6", type:"missing_doc", title:"Missing Documents", message:"Case FS-2026-1079 is missing Income Tax Returns and Balance Sheet. Application on hold.", timestamp:"2026-07-17T11:15:00Z", caseId:"FS-2026-1079", read:true },
];

// ── AI Credit Risk — CIBIL Intelligence ──────────────────────────────────────

export interface CIBILScore {
  consumerScore: number;
  commercialScore: number;
  creditHistory: number; // years
  defaults: number;
  activeLoans: number;
  closedLoans: number;
  dpdHistory: string;    // e.g. "0 DPD in last 24 months"
  creditEnquiries: number;
  overallCreditRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  consumerRiskLabel: string;
  commercialRiskLabel: string;
}

export function generateCIBIL(seed: number): CIBILScore {
  const c = 600 + rand(0, 200, seed);
  const com = 5 + rand(0, 4, seed + 1);
  return {
    consumerScore: Math.round(c),
    commercialScore: parseFloat(com.toFixed(1)),
    creditHistory: Math.round(rand(2, 18, seed + 2)),
    defaults: Math.round(rand(0, 3, seed + 3)),
    activeLoans: Math.round(rand(1, 5, seed + 4)),
    closedLoans: Math.round(rand(2, 12, seed + 5)),
    dpdHistory: rand(0, 1, seed + 6) > 0.5 ? "0 DPD in last 36 months" : "30 DPD observed 14 months ago",
    creditEnquiries: Math.round(rand(0, 8, seed + 7)),
    overallCreditRisk: c > 750 ? "LOW" : c > 650 ? "MODERATE" : c > 580 ? "HIGH" : "CRITICAL",
    consumerRiskLabel: c > 750 ? "Excellent" : c > 650 ? "Good" : c > 580 ? "Fair" : "Poor",
    commercialRiskLabel: com > 7 ? "Strong" : com > 5 ? "Adequate" : "Weak",
  };
}

// ── AI Credit Risk — Banking Behaviour ───────────────────────────────────────

export interface BankingBehaviourScore {
  avgMonthlyBalance: number;
  cashFlowStability: number;  // 0-100
  limitUtilisation: number;   // %
  creditUtilisation: number;  // %
  emiServicing: "REGULAR" | "DELAYED" | "DEFAULT";
  chequeBounceHistory: number;
  returnedTransactions: number;
  suspiciousTransfers: number;
  behaviourScore: number; // 0-100
  behaviourRating: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR";
}

export function generateBankingBehaviour(seed: number): BankingBehaviourScore {
  const score = Math.round(rand(40, 98, seed));
  return {
    avgMonthlyBalance: Math.round(rand(50000, 2500000, seed + 1)),
    cashFlowStability: Math.round(rand(45, 98, seed + 2)),
    limitUtilisation: Math.round(rand(15, 85, seed + 3)),
    creditUtilisation: Math.round(rand(10, 70, seed + 4)),
    emiServicing: score > 75 ? "REGULAR" : score > 55 ? "DELAYED" : "DEFAULT",
    chequeBounceHistory: Math.round(rand(0, 4, seed + 5)),
    returnedTransactions: Math.round(rand(0, 3, seed + 6)),
    suspiciousTransfers: Math.round(rand(0, 2, seed + 7)),
    behaviourScore: score,
    behaviourRating: score > 80 ? "EXCELLENT" : score > 65 ? "GOOD" : score > 50 ? "AVERAGE" : "POOR",
  };
}

// ── AI Credit Risk — Financial Intelligence ───────────────────────────────────

export interface FinancialScore {
  currentRatio: number;
  quickRatio: number;
  debtEquityRatio: number;
  interestCoverageRatio: number;
  dscr: number;
  ebitdaMargin: number;     // %
  grossMargin: number;      // %
  netMargin: number;        // %
  revenueGrowth: number;    // %
  profitGrowth: number;     // %
  workingCapitalCycle: number; // days
  cashConversionCycle: number; // days
  financialHealthScore: number;
  healthRating: "STRONG" | "ADEQUATE" | "MODERATE" | "WEAK" | "CRITICAL";
}

export function generateFinancialScore(seed: number): FinancialScore {
  const score = Math.round(rand(35, 95, seed));
  return {
    currentRatio: parseFloat(rand(0.8, 3.2, seed + 1).toFixed(2)),
    quickRatio: parseFloat(rand(0.5, 2.4, seed + 2).toFixed(2)),
    debtEquityRatio: parseFloat(rand(0.3, 4.5, seed + 3).toFixed(2)),
    interestCoverageRatio: parseFloat(rand(0.8, 8.5, seed + 4).toFixed(2)),
    dscr: parseFloat(rand(0.7, 3.2, seed + 5).toFixed(2)),
    ebitdaMargin: parseFloat(rand(5, 42, seed + 6).toFixed(1)),
    grossMargin: parseFloat(rand(10, 58, seed + 7).toFixed(1)),
    netMargin: parseFloat(rand(2, 28, seed + 8).toFixed(1)),
    revenueGrowth: parseFloat(rand(-8, 45, seed + 9).toFixed(1)),
    profitGrowth: parseFloat(rand(-15, 60, seed + 10).toFixed(1)),
    workingCapitalCycle: Math.round(rand(20, 120, seed + 11)),
    cashConversionCycle: Math.round(rand(15, 95, seed + 12)),
    financialHealthScore: score,
    healthRating: score > 80 ? "STRONG" : score > 65 ? "ADEQUATE" : score > 50 ? "MODERATE" : score > 35 ? "WEAK" : "CRITICAL",
  };
}

// ── AI Credit Risk — Industry Intelligence ────────────────────────────────────

export interface IndustryScore {
  industryOutlook: "POSITIVE" | "STABLE" | "NEGATIVE" | "UNCERTAIN";
  marketGrowthPct: number;
  competitionLevel: "LOW" | "MEDIUM" | "HIGH" | "INTENSE";
  sectorRisk: "LOW" | "MODERATE" | "HIGH";
  promoterExperience: number;  // years
  litigationHistory: number;   // active cases
  managementStability: "STABLE" | "MODERATE" | "UNSTABLE";
  industryRiskScore: number;   // 0-100 (lower = riskier)
  riskRating: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
}

export function generateIndustryScore(seed: number): IndustryScore {
  const score = Math.round(rand(30, 95, seed));
  return {
    industryOutlook: score > 70 ? "POSITIVE" : score > 55 ? "STABLE" : score > 40 ? "UNCERTAIN" : "NEGATIVE",
    marketGrowthPct: parseFloat(rand(-3, 18, seed + 1).toFixed(1)),
    competitionLevel: score > 75 ? "MEDIUM" : score > 55 ? "HIGH" : "INTENSE",
    sectorRisk: score > 70 ? "LOW" : score > 50 ? "MODERATE" : "HIGH",
    promoterExperience: Math.round(rand(2, 28, seed + 2)),
    litigationHistory: Math.round(rand(0, 4, seed + 3)),
    managementStability: score > 65 ? "STABLE" : score > 45 ? "MODERATE" : "UNSTABLE",
    industryRiskScore: score,
    riskRating: score > 75 ? "LOW" : score > 55 ? "MODERATE" : score > 40 ? "HIGH" : "CRITICAL",
  };
}

// ── AI Credit Risk — GST Intelligence ────────────────────────────────────────

export interface GSTScore {
  monthlySalesTrend: { month: string; sales: number; filedSales: number }[];
  annualTurnover: number;
  filingCompliance: number;  // %
  invoiceMatching: number;   // %
  vendorConcentration: number; // top vendor % of purchases
  inputTaxCredit: number;    // lakhs
  seasonalVariance: number;  // %
  gstHealthScore: number;
  healthLabel: "EXCELLENT" | "GOOD" | "AVERAGE" | "POOR";
}

export function generateGSTScore(seed: number): GSTScore {
  const score = Math.round(rand(38, 97, seed));
  return {
    monthlySalesTrend: MONTHS.slice(0, 12).map((month, i) => ({
      month,
      sales: Math.round(rand(40, 200, seed + i) * 100) / 100,
      filedSales: Math.round(rand(35, 195, seed + i + 0.5) * 100) / 100,
    })),
    annualTurnover: Math.round(rand(50, 2500, seed + 20)),
    filingCompliance: Math.round(rand(60, 100, seed + 21)),
    invoiceMatching: Math.round(rand(55, 99, seed + 22)),
    vendorConcentration: Math.round(rand(10, 65, seed + 23)),
    inputTaxCredit: Math.round(rand(5, 180, seed + 24)),
    seasonalVariance: Math.round(rand(8, 45, seed + 25)),
    gstHealthScore: score,
    healthLabel: score > 80 ? "EXCELLENT" : score > 65 ? "GOOD" : score > 50 ? "AVERAGE" : "POOR",
  };
}

// ── AI Fraud Intelligence ─────────────────────────────────────────────────────

export interface FraudAnalysis {
  fraudScore: number;        // 0–100
  fraudCategory: "CLEAN" | "SUSPICIOUS" | "HIGH RISK" | "CRITICAL";
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  checks: FraudCheck[];
  aiExplanation: string;
  topRiskFactors: string[];
  topPositiveFactors: string[];
}

export interface FraudCheck {
  name: string;
  passed: boolean;
  confidence: number;  // 0–100
  detail: string;
}

export function generateFraudAnalysis(seed: number): FraudAnalysis {
  const score = Math.round(rand(5, 75, seed));
  const cat: FraudAnalysis["fraudCategory"] = score < 20 ? "CLEAN" : score < 40 ? "SUSPICIOUS" : score < 65 ? "HIGH RISK" : "CRITICAL";
  return {
    fraudScore: score,
    fraudCategory: cat,
    riskLevel: score < 20 ? "LOW" : score < 40 ? "MODERATE" : score < 65 ? "HIGH" : "CRITICAL",
    checks: [
      { name: "Identity Fraud Check",        passed: score < 35, confidence: Math.round(rand(70, 99, seed+1)), detail: score < 35 ? "Identity documents are consistent across all submissions." : "Name mismatch detected between PAN and Aadhaar." },
      { name: "Synthetic Identity Detection",passed: score < 40, confidence: Math.round(rand(75, 98, seed+2)), detail: score < 40 ? "No synthetic identity patterns detected." : "Unusual combination of identity attributes flagged." },
      { name: "Shell Company Detection",     passed: score < 50, confidence: Math.round(rand(65, 95, seed+3)), detail: score < 50 ? "Company shows genuine operational history." : "Minimal physical presence and low employee count." },
      { name: "Circular Transaction Check",  passed: score < 45, confidence: Math.round(rand(70, 97, seed+4)), detail: score < 45 ? "No circular fund flow detected." : "Suspected circular transactions with 3 related entities." },
      { name: "Fake Vendor Detection",       passed: score < 55, confidence: Math.round(rand(68, 96, seed+5)), detail: score < 55 ? "All vendors verified in GST registry." : "2 vendors not found in GST database." },
      { name: "Duplicate Loan Detection",    passed: score < 30, confidence: Math.round(rand(80, 99, seed+6)), detail: score < 30 ? "No duplicate applications found in network." : "Similar application filed at 2 other institutions." },
      { name: "Related Party Transactions",  passed: score < 60, confidence: Math.round(rand(65, 93, seed+7)), detail: score < 60 ? "No undisclosed related party transactions." : "High fund transfers to director-linked accounts." },
      { name: "Money Laundering Indicators", passed: score < 40, confidence: Math.round(rand(72, 98, seed+8)), detail: score < 40 ? "No money laundering red flags detected." : "Structuring pattern in deposits observed." },
      { name: "High-Risk Beneficiary Check", passed: score < 35, confidence: Math.round(rand(75, 99, seed+9)), detail: score < 35 ? "No high-risk beneficiaries in transaction flow." : "Funds transferred to politically exposed entity." },
      { name: "Suspicious Banking Behaviour",passed: score < 45, confidence: Math.round(rand(70, 96, seed+10)), detail: score < 45 ? "Banking behaviour is within normal parameters." : "Unusual large cash withdrawals before loan application." },
      { name: "Fake Invoices Detection",     passed: score < 50, confidence: Math.round(rand(68, 95, seed+11)), detail: score < 50 ? "Invoice data is consistent with GST filings." : "Invoice amounts don't match GST returns by 24%." },
    ],
    aiExplanation: score < 20
      ? `Fraud Score is ${score}/100 (Low Risk). All identity documents are consistent, no circular transactions detected, and banking behaviour is within normal parameters. GST filings match invoice records. Company demonstrates genuine operational history with verified vendors.`
      : score < 40
      ? `Fraud Score is ${score}/100 (Moderate Risk). Minor inconsistencies detected in document metadata. GST filings show occasional gaps. Recommend manual review of vendor relationships before approval.`
      : `Fraud Score is ${score}/100 (High Risk). Significant red flags detected: name mismatch in identity documents, suspected circular fund flow with related entities, and vendor verification failures. Immediate forensic audit recommended.`,
    topRiskFactors: score > 30 ? [
      "Identity name inconsistency across documents",
      "GST invoice mismatch of 24%",
      "Unverified vendor entries in purchase ledger",
      "Circular fund transfers with related entities",
    ] : ["No significant risk factors detected"],
    topPositiveFactors: [
      "No duplicate loan applications in network",
      "Company registration verified in MCA database",
      "CIBIL score within acceptable range",
      "Property title documents are clean",
    ],
  };
}

// ── AI Document Integrity ─────────────────────────────────────────────────────

export interface DocIntegrityCheck {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  confidence: number;
  detail: string;
}

export interface DocumentIntegrity {
  docType: string;
  overallScore: number;
  checks: DocIntegrityCheck[];
}

export function generateDocIntegrity(docType: string, seed: number): DocumentIntegrity {
  const score = Math.round(rand(45, 98, seed));

  const checksMap: Record<string, string[]> = {
    pan: ["OCR Extraction","PAN Format Validation","Name Matching","Digital Signature Detection","Font Consistency Analysis","Metadata Verification","Tampering Detection"],
    aadhaar: ["QR Code Validation","OCR Extraction","Name & DOB Matching","Layout Template Verification","Security Pattern Detection","Photo Consistency","Tampering Detection"],
    gst: ["GST Number Format Validation","Filing Consistency Check","Monthly Sales Analysis","Fake GST Detection","Tax Compliance Score","Invoice Consistency","State Code Verification"],
    bank_statement: ["Transaction Authenticity","Balance Continuity","Font Replacement Detection","Missing Transaction Check","Bank Logo Verification","Metadata Change Detection","PDF Edit Detection","Photoshop Analysis","AI-Generated Content Check"],
    financial_statement: ["Revenue Consistency","Profit Manipulation Check","Auditor Signature Verification","Financial Ratio Analysis","Hidden Liability Detection","Accounting Standards Check","Duplicate Entry Detection"],
    land_record: ["Ownership Verification","Mutation History Analysis","Encumbrance Status","Registration Detail Check","Duplicate Ownership Detection","Boundary Consistency","Legal Dispute Check"],
    legal_document: ["Stamp Duty Verification","Signature Authenticity","Page Completeness","Clause Editing Detection","Metadata Consistency","Document Version Check","Tampered Section Detection"],
  };

  const checkNames = checksMap[docType] || checksMap["bank_statement"];

  return {
    docType,
    overallScore: score,
    checks: checkNames.map((name, i) => {
      const r = rand(0, 100, seed + i + 1);
      const pass = r > (100 - score * 0.8);
      const warn = !pass && r > 30;
      return {
        name,
        status: pass ? "PASS" : warn ? "WARN" : "FAIL",
        confidence: Math.round(rand(68, 99, seed + i + 2)),
        detail: pass
          ? `${name} passed with no anomalies detected.`
          : warn
          ? `Minor irregularity detected in ${name.toLowerCase()}. Manual review advised.`
          : `${name} failed — significant anomaly detected with high confidence.`,
      };
    }),
  };
}

// ── Anomaly Detection ─────────────────────────────────────────────────────────

export interface AnomalyItem {
  type: string;
  detected: boolean;
  confidence: number;
  location?: string;
}

export function generateAnomalies(seed: number): AnomalyItem[] {
  const types = [
    "Inserted Pages", "Deleted Pages", "Edited Numbers", "Font Changes",
    "Modified Dates", "Image Manipulation", "Hidden Layers", "Metadata Changes",
    "Digital Signature Mismatch", "AI-Generated Content", "Photoshop Editing",
    "Fake Watermarks", "Cropped Images", "Duplicate Documents",
    "Copy-Paste Content", "Suspicious OCR Differences",
  ];

  return types.map((type, i) => {
    const r = rand(0, 100, seed + i);
    const detected = r > 72;
    return {
      type,
      detected,
      confidence: detected ? Math.round(rand(65, 98, seed + i + 0.5)) : Math.round(rand(85, 99, seed + i + 0.5)),
      location: detected ? `Page ${Math.round(rand(1, 4, seed + i + 0.3))}, Region ${["Top-Left","Top-Right","Center","Bottom"][Math.floor(rand(0,3.99,seed+i+0.7))]}` : undefined,
    };
  });
}

// ── Cross-Document Consistency ────────────────────────────────────────────────

export interface ConsistencyCell {
  field: string;
  docA: string;
  docB: string;
  match: "MATCH" | "MISMATCH" | "NA";
  confidence: number;
}

export function generateConsistencyMatrix(seed: number): { score: number; cells: ConsistencyCell[] } {
  const score = Math.round(rand(55, 97, seed));
  const fields = ["Company Name","Promoter Name","PAN Number","Aadhaar Number","Registered Address","Bank Account Holder","Annual Turnover","GST Registration Name","Director Names"];

  const cells: ConsistencyCell[] = [];
  const docs = ["PAN Card","Aadhaar Card","Bank Statement","GST Certificate","Financial Statement"];

  fields.forEach((field, fi) => {
    for (let di = 0; di < docs.length - 1; di++) {
      const r = rand(0, 100, seed + fi * 10 + di);
      cells.push({
        field,
        docA: docs[di],
        docB: docs[di + 1],
        match: r > (100 - score * 0.85) ? "MATCH" : r > 30 ? "MISMATCH" : "NA",
        confidence: Math.round(rand(70, 99, seed + fi + di)),
      });
    }
  });

  return { score, cells };
}

// ── Final AI Decision ─────────────────────────────────────────────────────────

export interface AIFinalDecision {
  documentAuthenticityScore: number;
  identityConsistencyScore: number;
  fraudScore: number;
  financialHealthScore: number;
  bankingBehaviourScore: number;
  gstHealthScore: number;
  industryRiskScore: number;
  probabilityOfDefault: number;     // 1–100
  trustScore: number;               // 0–100
  riskLevel: "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  recommendation: "APPROVE" | "APPROVE_WITH_CONDITIONS" | "MANUAL_REVIEW" | "REJECT";
  suggestedLoanAmount: number;      // lakhs
  suggestedInterestRate: number;    // %
  requiredCollateral: string;
  recommendedTenure: number;        // months
  aiExplanation: string;
  positiveFactors: string[];
  riskFactors: string[];
  improvements: string[];
}

export function generateFinalDecision(seed: number): AIFinalDecision {
  const trust = Math.round(rand(38, 95, seed));
  const pd = Math.round(rand(5, 72, seed + 1));
  const docAuth = Math.round(rand(55, 98, seed + 2));
  const consistency = Math.round(rand(60, 97, seed + 3));
  const fraud = Math.round(rand(5, 65, seed + 4));
  const financial = Math.round(rand(40, 92, seed + 5));
  const banking = Math.round(rand(45, 95, seed + 6));
  const gst = Math.round(rand(50, 95, seed + 7));
  const industry = Math.round(rand(40, 90, seed + 8));

  const risk: AIFinalDecision["riskLevel"] = pd < 20 ? "VERY_LOW" : pd < 35 ? "LOW" : pd < 50 ? "MODERATE" : pd < 65 ? "HIGH" : "CRITICAL";
  const rec: AIFinalDecision["recommendation"] = pd < 25 ? "APPROVE" : pd < 40 ? "APPROVE_WITH_CONDITIONS" : pd < 60 ? "MANUAL_REVIEW" : "REJECT";

  return {
    documentAuthenticityScore: docAuth,
    identityConsistencyScore: consistency,
    fraudScore: fraud,
    financialHealthScore: financial,
    bankingBehaviourScore: banking,
    gstHealthScore: gst,
    industryRiskScore: industry,
    probabilityOfDefault: pd,
    trustScore: trust,
    riskLevel: risk,
    recommendation: rec,
    suggestedLoanAmount: rec === "APPROVE" || rec === "APPROVE_WITH_CONDITIONS" ? Math.round(rand(50, 500, seed + 9)) : 0,
    suggestedInterestRate: parseFloat((rand(8.5, 18.5, seed + 10)).toFixed(2)),
    requiredCollateral: pd < 30 ? "Property collateral (LTV 70%)" : pd < 50 ? "Property + FD collateral (LTV 60%)" : "Enhanced collateral + guarantee required",
    recommendedTenure: Math.round(rand(24, 120, seed + 11)),
    aiExplanation: `Probability of Default is ${pd}% because the applicant has ${trust > 70 ? "a strong" : "a moderate"} Trust Score of ${trust}/100. Document authenticity is ${docAuth > 80 ? "excellent" : "adequate"} at ${docAuth}%. ${fraud < 30 ? "No significant fraud indicators were detected." : "Some fraud indicators require attention."} Financial health score of ${financial} indicates ${financial > 70 ? "healthy" : "moderate"} business fundamentals with ${pd < 35 ? "manageable" : "elevated"} leverage. GST compliance at ${gst}% ${gst > 80 ? "supports" : "partially supports"} the reported turnover.`,
    positiveFactors: [
      docAuth > 80 ? "All documents passed AI authenticity verification" : "Primary documents verified",
      consistency > 75 ? "Strong identity consistency across all documents" : "Adequate identity consistency",
      banking > 70 ? "Excellent banking behaviour and cash flow stability" : "Adequate banking behaviour",
      gst > 75 ? "Consistent GST filings with matching invoice records" : "GST records available",
    ],
    riskFactors: pd > 35 ? [
      pd > 50 ? "Probability of Default exceeds threshold at " + pd + "%" : "Elevated probability of default",
      financial < 60 ? "Financial ratios below industry benchmarks" : "Moderate financial leverage",
      fraud > 30 ? "Fraud score requires investigation before disbursement" : "Minor fraud indicators present",
      industry < 60 ? "Industry sector showing negative growth trends" : "Moderate industry risk",
    ] : ["No significant risk factors identified"],
    improvements: [
      "Provide additional 6 months of bank statements",
      pd > 40 ? "Reduce loan amount by 20% to improve DSCR" : "Ensure collateral documentation is complete",
      fraud > 25 ? "Clarify vendor relationships with supporting invoices" : "Submit CA-certified financial statements",
      "Provide personal guarantee from promoter",
    ],
  };
}

// ── Chat Responses ────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const SUGGESTED_QUESTIONS = [
  "Why is this application high risk?",
  "Explain the Probability of Default",
  "What are the key fraud indicators?",
  "Compare with previous successful borrowers",
  "Suggest improvements before approval",
  "Explain the DSCR ratio",
  "What documents are missing?",
  "What does the Trust Score mean?",
];

export function getAIResponse(question: string, decision: AIFinalDecision): string {
  const q = question.toLowerCase();

  if (q.includes("high risk") || q.includes("risk"))
    return `This application has a **${decision.riskLevel.replace("_"," ")} Risk** rating. The primary risk factors are:\n\n${decision.riskFactors.map(f => `• ${f}`).join("\n")}\n\nThe Probability of Default is **${decision.probabilityOfDefault}%** and the overall Trust Score is **${decision.trustScore}/100**.`;

  if (q.includes("probability") || q.includes("default") || q.includes("pd"))
    return `**Probability of Default: ${decision.probabilityOfDefault}%**\n\n${decision.aiExplanation}\n\nThis is calculated by combining scores from 5 AI models: CIBIL Intelligence, Banking Behaviour, Financial Analysis, Industry Risk, and GST Health.`;

  if (q.includes("fraud"))
    return `**Fraud Score: ${decision.fraudScore}/100**\n\nThe fraud analysis examined 11 categories including identity fraud, circular transactions, shell company detection, and money laundering indicators.\n\n${decision.fraudScore > 30 ? "⚠️ Elevated fraud score — please review the flagged indicators in the Fraud Engine panel." : "✅ Fraud score is within acceptable limits."}`;

  if (q.includes("compare") || q.includes("previous"))
    return `Based on our database of approved applications:\n\n• Average Trust Score of approved cases: **78.4**\n• This application Trust Score: **${decision.trustScore}**\n• Average PD of approved cases: **14.2%**\n• This application PD: **${decision.probabilityOfDefault}%**\n\n${decision.trustScore > 70 && decision.probabilityOfDefault < 30 ? "This application is **comparable** to previously approved cases." : "This application is **below the threshold** of previously approved cases."}`;

  if (q.includes("improve") || q.includes("suggest"))
    return `**Recommended Improvements:**\n\n${decision.improvements.map((imp, i) => `${i + 1}. ${imp}`).join("\n")}\n\nImplementing these improvements could reduce the Probability of Default by an estimated **8–15 percentage points**.`;

  if (q.includes("dscr"))
    return "**DSCR (Debt Service Coverage Ratio)** measures whether a company generates enough income to cover its debt obligations.\n\n• DSCR > 1.5 → Strong (Low Risk)\n• DSCR 1.2–1.5 → Adequate\n• DSCR 1.0–1.2 → Marginal (Monitor)\n• DSCR < 1.0 → Default Risk (High Risk)\n\nThe RBI guideline for SME lending requires a minimum DSCR of 1.25.";

  if (q.includes("missing") || q.includes("document"))
    return `**Document Status:**\n\n✅ PAN Card — Verified\n✅ Aadhaar Card — Verified\n✅ GST Certificate — Verified\n⚠️ Bank Statements — Last 3 months only (6 months required)\n✅ Balance Sheet — Verified\n❌ Income Tax Returns — Missing (last 2 years required)\n❌ Cash Flow Statement — Not uploaded\n\nPlease request the missing documents before proceeding with disbursement.`;

  if (q.includes("trust") || q.includes("score"))
    return `**Trust Score: ${decision.trustScore}/100**\n\nThe Trust Score is a composite metric combining:\n\n• Document Authenticity: ${decision.documentAuthenticityScore}%\n• Identity Consistency: ${decision.identityConsistencyScore}%\n• Fraud Score (inverted): ${100 - decision.fraudScore}%\n• Financial Health: ${decision.financialHealthScore}%\n• Banking Behaviour: ${decision.bankingBehaviourScore}%\n\nA Trust Score above **70** is generally required for direct approval.`;

  return `I can help you analyze this loan application. The current Trust Score is **${decision.trustScore}/100** with a Probability of Default of **${decision.probabilityOfDefault}%**.\n\nTry asking me about:\n• Risk factors and fraud indicators\n• Document verification status\n• How to improve the application\n• Explanation of any financial ratio`;
}
