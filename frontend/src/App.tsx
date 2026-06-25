import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, 
  AlertTriangle, 
  Network, 
  FileText, 
  Zap, 
  Search, 
  Database, 
  UploadCloud, 
  Trash2, 
  Play, 
  X, 
  Server, 
  Settings, 
  Activity, 
  FilePlus, 
  Clock, 
  RefreshCw,
  Copy,
  ChevronRight,
  CornerDownRight,
  BarChart2
} from "lucide-react";
import ParticleBackground from "./components/ParticleBackground";
import ForceGraph2D from "react-force-graph-2d";
import * as d3 from "d3-force";

const API_BASE = "http://localhost:8000/api";

// Cast motion elements as any to bypass React 19 / Framer Motion TS mismatch
const MotionDiv = motion.div as any;

type Role = "UNDERWRITER" | "ADMIN";
interface User { id: string; role: Role; branch?: string; }

export default function App() {
  const fgRef = useRef<any>(null);
  const [showLanding, setShowLanding] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  
  // Security Simulator States
  const [loginStep, setLoginStep] = useState<"LOGIN" | "2FA" | "LOCKED" | "FORGOT">("LOGIN");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  const [loginId, setLoginId] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>({
    neo4j_connected: false,
    spacy_loaded: false,
    documents_ready: 0,
    neo4j_uri: ""
  });
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStep === "LOCKED") return;

    const id = loginId.trim().toUpperCase();
    const pass = loginPass.trim();

    if (pass === "Nexus@2026") {
      let role: Role = "UNDERWRITER";
      let branch = "UNKNOWN";

      if (id.startsWith("CB-HQ-ADMIN")) {
        role = "ADMIN";
        branch = "HQ";
      } else if (id.startsWith("CB-") && id.split("-").length >= 3) {
        branch = id.split("-")[1];
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 3) setLoginStep("LOCKED");
        return;
      }

      setFailedAttempts(0);
      setPendingUser({ id, role, branch });
      setLoginStep("2FA");
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) setLoginStep("LOCKED");
    }
  };

  const handle2FA = (e: React.FormEvent) => {
    e.preventDefault();
    if (twoFaCode === "849201" && pendingUser) {
      setUser(pendingUser);
      setActiveTab("dashboard");
    } else {
      alert("Invalid Secure Authenticator Code.");
    }
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetCode !== "112233") {
      alert("Invalid SMS Reset Code.");
      return;
    }
    if (newPassword.length < 5) {
      alert("Password is too short.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    alert("Password successfully changed! Please login with your new credentials.");
    setLoginStep("LOGIN");
    setFailedAttempts(0);
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
    setLoginPass("");
  };

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("nexusguard_theme");
    return saved !== "light";
  });

  useEffect(() => {
    localStorage.setItem("nexusguard_theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Sync body class and background with theme state
  useEffect(() => {
    const body = document.body;
    if (isDarkMode) {
      body.classList.remove("light-theme");
      body.classList.add("dark-theme");
      body.style.backgroundColor = "#060913";
    } else {
      body.classList.remove("dark-theme");
      body.classList.add("light-theme");
      body.style.backgroundColor = "#FFFFFF";
    }
  }, [isDarkMode]);

  const getTrafficLightStatus = () => {
    if (!data || !data.alerts || data.alerts.length === 0) {
      return {
        status: "CLEAR",
        color: "success",
        title: "CLEAR / PASS",
        message: "No interconnected network anomalies found.",
        banner: "bg-success/10 border-success/30 text-success"
      };
    }
    const hasCritical = data.alerts.some((a: any) => 
      a.alert_type === "COLLATERAL_CONFLICT" || a.alert_type === "NETWORK_CYCLE"
    );
    if (hasCritical) {
      return {
        status: "REJECT",
        color: "danger",
        title: "CRITICAL REJECT",
        message: "Immediate RBI Reporting Mandated — Multiple Mortgaging or Circular Flow detected.",
        banner: "bg-danger/10 border-danger/30 text-danger animate-pulse"
      };
    }
    return {
      status: "HOLD",
      color: "warning",
      title: "HOLD / AUDIT",
      message: "Address Overlap or unverified corporate relationships identified. Manual compliance audit required.",
      banner: "bg-warning/10 border-warning/30 text-warning"
    };
  };

  const printAuditReport = () => {
    if (!data) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to generate the report.");
      return;
    }
    
    const alertListHtml = data.alerts.map((a: any, idx: number) => `
      <div style="margin-bottom: 25px; page-break-inside: avoid; border-bottom: 1px solid #ddd; padding-bottom: 15px;">
        <h3 style="margin: 0; color: #111; font-size: 14px;">Alert #${idx + 1}: ${a.title}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
          <tr>
            <td style="width: 150px; font-weight: bold; padding: 4px 0;">RBI Classification:</td>
            <td style="padding: 4px 0;">${a.rbi_risk_category || a.alert_type}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0;">Severity:</td>
            <td style="padding: 4px 0; font-weight: bold; color: ${a.severity === 'HIGH' ? '#d32f2f' : '#f57c00'}">${a.severity}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0;">Risk Score:</td>
            <td style="padding: 4px 0;">${Math.round(a.risk_score * 100)}%</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Description:</td>
            <td style="padding: 4px 0; line-height: 1.4;">${a.description}</td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Evidence Path:</td>
            <td style="padding: 4px 0;">
              <ul style="margin: 0; padding-left: 15px; line-height: 1.4;">
                ${a.evidence_path.map((p: string) => `<li>${p}</li>`).join('')}
              </ul>
            </td>
          </tr>
          <tr>
            <td style="font-weight: bold; padding: 4px 0; vertical-align: top;">Mitigation Recommendations:</td>
            <td style="padding: 4px 0;">
              <ul style="margin: 0; padding-left: 15px; line-height: 1.4;">
                ${(a.underwriter_recommendation || a.recommendations).map((r: string) => `<li>${r}</li>`).join('')}
              </ul>
            </td>
          </tr>
        </table>
      </div>
    `).join('');

    const htmlContent = `
      <html>
        <head>
          <title>Canara Bank Credit Audit Report - NexusGuard</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #222; margin: 40px; font-size: 12px; line-height: 1.5; }
            .header { border-bottom: 2px solid #0052cc; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 20px; font-weight: bold; color: #0052cc; margin: 0; }
            .subtitle { font-size: 12px; color: #555; margin: 5px 0 0 0; }
            .metadata-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; font-size: 11px; }
            .metadata-table td { padding: 4px 8px; border: 1px solid #eee; }
            .summary-box { padding: 15px; border-radius: 4px; margin-bottom: 20px; }
            .reject { background-color: #fce8e6; border: 1px solid #f5c2c2; color: #c53929; }
            .hold { background-color: #fef7e0; border: 1px solid #fcdb77; color: #b06000; }
            .clear { background-color: #e6f4ea; border: 1px solid #a8dab5; color: #137333; }
            .section-title { font-size: 14px; font-weight: bold; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px; margin-bottom: 15px; }
            .signature-block { margin-top: 60px; display: flex; justify-content: space-between; page-break-inside: avoid; }
            .signature-line { width: 200px; border-top: 1px solid #000; text-align: center; padding-top: 5px; margin-top: 40px; font-size: 10px; }
            @media print {
              body { margin: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">CANARA BANK</div>
            <div class="subtitle">NexusGuard — Real-Time Graph Traversal Credit Audit Report</div>
          </div>
          
          <table class="metadata-table">
            <tr>
              <td style="font-weight: bold; width: 150px;">Report Reference:</td>
              <td>CB-CRAR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}</td>
              <td style="font-weight: bold; width: 150px;">Audit Timestamp:</td>
              <td>${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Operational Engine:</td>
              <td>${status.neo4j_connected ? "Enterprise Core Server (Neo4j Connected)" : "Edge Agent Mode (NetworkX Offline Engine)"}</td>
              <td style="font-weight: bold;">System Threat Score:</td>
              <td style="font-weight: bold;">${Math.round(data?.risk_score * 100 || 0)}%</td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Borrower Entities Resolved:</td>
              <td>${data?.metrics?.entities || 0}</td>
              <td style="font-weight: bold;">Collateral/Document Count:</td>
              <td>${data?.metrics?.documents || 0} Ingested Docs</td>
            </tr>
          </table>

          <div class="summary-box ${getTrafficLightStatus().status === 'REJECT' ? 'reject' : getTrafficLightStatus().status === 'HOLD' ? 'hold' : 'clear'}">
            <h2 style="margin: 0 0 5px 0; font-size: 14px; font-weight: bold;">
              System Classification: ${getTrafficLightStatus().title}
            </h2>
            <p style="margin: 0; font-size: 11px;">
              ${getTrafficLightStatus().message}
            </p>
          </div>

          <div class="section-title">DETAILED FRAUD TRAVERSAL FLAGS</div>
          ${alertListHtml || '<p style="font-style: italic; color: #555;">Suspicious network relationships or document discrepancies resolved.</p>'}
          
          <div class="signature-block">
            <div>
              <div class="signature-line">Underwriter Signature</div>
              <div style="text-align: center; font-size: 10px; color: #777; margin-top: 5px;">Name: ______________________</div>
            </div>
            <div>
              <div class="signature-line">Branch Manager Approval</div>
              <div style="text-align: center; font-size: 10px; color: #777; margin-top: 5px;">Date: ______________________</div>
            </div>
          </div>
          
          <script setup>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const renderTrafficLightComponent = () => {
    const statusInfo = getTrafficLightStatus();
    return (
      <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm transition-all ${statusInfo.banner}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-black/10">
            <div className={`w-3.5 h-3.5 rounded-full transition-all ${statusInfo.status === 'REJECT' ? 'bg-red-500 shadow-[0_0_12px_#ef4444]' : 'bg-red-950 opacity-40'}`} />
            <div className={`w-3.5 h-3.5 rounded-full transition-all ${statusInfo.status === 'HOLD' ? 'bg-yellow-500 shadow-[0_0_12px_#eab308]' : 'bg-yellow-950 opacity-40'}`} />
            <div className={`w-3.5 h-3.5 rounded-full transition-all ${statusInfo.status === 'CLEAR' ? 'bg-green-500 shadow-[0_0_12px_#22c55e]' : 'bg-green-950 opacity-40'}`} />
          </div>
          <div className="text-left">
            <div className="text-xs font-black uppercase tracking-wider">{statusInfo.title}</div>
            <div className="text-[11px] opacity-90 font-medium mt-0.5">{statusInfo.message}</div>
          </div>
        </div>
        
        {data && (
          <button
            onClick={printAuditReport}
            className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all uppercase tracking-wider flex items-center gap-1.5 cursor-pointer ${
              statusInfo.status === 'REJECT' ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-500' :
              statusInfo.status === 'HOLD' ? 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-500' :
              'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-500'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Generate Audit Report
          </button>
        )}
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState<any>(null);
  const [graphKey, setGraphKey] = useState(0);

  // Apply d3 forces and freeze graph after initial settle
  useEffect(() => {
    if (activeTab === "graph" && fgRef.current) {
      fgRef.current.d3Force('collide', d3.forceCollide(48));
      fgRef.current.d3Force('charge', d3.forceManyBody().strength(-900));
      fgRef.current.d3Force('link').distance(130);
      fgRef.current.d3Force('center', d3.forceCenter(450, 275));
      fgRef.current.d3ReheatSimulation();
    }
  }, [data, activeTab, graphKey]);
  
  // Document Manager state
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [selectedDocDetails, setSelectedDocDetails] = useState<any>(null);
  const [docLoading, setDocLoading] = useState(false);
  
  // Cypher Lab state
  const [cypherQuery, setCypherQuery] = useState("");
  const [cypherResults, setCypherResults] = useState<any[] | null>(null);
  const [cypherLoading, setCypherLoading] = useState(false);
  const [cypherError, setCypherError] = useState("");
  
  // Database configuration
  const [showDbModal, setShowDbModal] = useState(false);
  const [dbConfig, setDbConfig] = useState({
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "password"
  });
  const [dbConnecting, setDbConnecting] = useState(false);

  // Pipeline stepper state
  const [pipelineStep, setPipelineStep] = useState(0);
  const [showPipelineOverlay, setShowPipelineOverlay] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  
  // Graph Selected Node Inspection
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [hoverNode, setHoverNode] = useState<any>(null);

  // Toast and Send Alert mock state
  const [toast, setToast] = useState<{ show: boolean; message: string } | null>(null);
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  // Risk Trend tooltip state
  const [trendHover, setTrendHover] = useState<{ idx: number; val: number; label: string; pctX: number; pctY: number } | null>(null);

  const sendAlertNotification = async (alertId: string, alertTitle: string) => {
    setSendingAlertId(alertId);
    // Simulate local sending delay
    await new Promise(r => setTimeout(r, 700));
    setSendingAlertId(null);
    setToast({
      show: true,
      message: `Vigilance Alert dispatched successfully to RBI portal & underwriter group for: "${alertTitle}"`
    });
    // Auto dismiss toast after 4 seconds
    setTimeout(() => setToast(null), 4000);
  };

  const getAlertDistribution = () => {
    const counts = {
      "Address Overlap": 0,
      "Double Pledge": 0,
      "Guarantor Cycle": 0,
      "Shell Company": 0,
      "Lien Conflict": 0
    };
    if (data && data.alerts) {
      data.alerts.forEach((a: any) => {
        if (a.alert_type === "ADDRESS_REUSE") counts["Address Overlap"]++;
        else if (a.alert_type === "COLLATERAL_CONFLICT") counts["Double Pledge"]++;
        else if (a.alert_type === "NETWORK_CYCLE") counts["Guarantor Cycle"]++;
        else if (a.alert_type === "SHELL_COMPANY") counts["Shell Company"]++;
        else counts["Lien Conflict"]++;
      });
    } else {
      // Realistic default values
      counts["Address Overlap"] = 3;
      counts["Double Pledge"] = 2;
      counts["Guarantor Cycle"] = 1;
      counts["Shell Company"] = 2;
      counts["Lien Conflict"] = 1;
    }
    return Object.entries(counts);
  };

  const renderAnomalyDistribution = () => {
    const dist = getAlertDistribution();
    const maxValue = Math.max(...dist.map(([_, v]) => v), 1);
    
    return (
      <div className="flex-1 flex flex-col justify-between mt-4">
        <div className="space-y-3.5">
          {dist.map(([label, val], idx) => {
            const pct = (val / maxValue) * 100;
            return (
              <div key={idx} className="space-y-1 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span>{label}</span>
                  <span className="text-primary font-black">{val} Alerts</span>
                </div>
                <div className="h-2.5 w-full bg-black/5 dark:bg-black/25 rounded-full overflow-hidden border border-border/20">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1 }}
                    className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRiskTrendGraph = () => {
    const auditLabels = ["Audit 1", "Audit 2", "Audit 3", "Audit 4", "Audit 5", "Audit 6", "Current"];
    const trendData = [35, 45, 68, 52, 75, 40, data ? Math.round(data.risk_score * 100) : 60];
    const svgW = 500;
    const svgH = 160;
    const pad = 30;
    
    const points = trendData.map((val, idx) => {
      const x = pad + (idx * (svgW - pad * 2)) / (trendData.length - 1);
      const y = svgH - pad - (val * (svgH - pad * 2)) / 100;
      return { x, y, val };
    });
    
    let dLine = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cpX = (points[i-1].x + points[i].x) / 2;
      dLine += ` C ${cpX} ${points[i-1].y}, ${cpX} ${points[i].y}, ${points[i].x} ${points[i].y}`;
    }
    const dArea = `${dLine} L ${points[points.length - 1].x} ${svgH - pad} L ${points[0].x} ${svgH - pad} Z`;
    
    return (
      <div className="mt-4 flex-1 flex flex-col justify-center items-center relative">
        <svg
          className="w-full h-full max-h-[180px]"
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setTrendHover(null)}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.2" />
              <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={pad} y1={pad} x2={svgW - pad} y2={pad} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1={pad} y1={svgH / 2} x2={svgW - pad} y2={svgH / 2} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1={pad} y1={svgH - pad} x2={svgW - pad} y2={svgH - pad} stroke="var(--border-color)" strokeWidth="0.5" />

          {/* Y-axis labels */}
          <text x={pad - 5} y={pad + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">100%</text>
          <text x={pad - 5} y={svgH / 2 + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">50%</text>
          <text x={pad - 5} y={svgH - pad + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)">0%</text>

          {/* Area fill and line */}
          <path d={dArea} fill="url(#areaGradient)" />
          <path d={dLine} fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Data points with hover zones */}
          {points.map((p, idx) => (
            <g key={idx}>
              {/* Invisible larger hit area for hover */}
              <circle
                cx={p.x} cy={p.y} r="14"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setTrendHover({
                  idx,
                  val: p.val,
                  label: auditLabels[idx],
                  pctX: (p.x / svgW) * 100,
                  pctY: (p.y / svgH) * 100,
                })}
                onMouseLeave={() => setTrendHover(null)}
              />
              {/* Visible data point */}
              <circle
                cx={p.x} cy={p.y} r={trendHover?.idx === idx ? 6 : 4}
                fill={idx === points.length - 1 ? "var(--secondary-color)" : "var(--primary-color)"}
                stroke="var(--bg-color)" strokeWidth="2"
                style={{ transition: 'r 0.15s ease', cursor: 'pointer' }}
              />
              {/* Pulse ring on current audit */}
              {idx === points.length - 1 && (
                <circle cx={p.x} cy={p.y} r="10" fill="none" stroke="var(--secondary-color)" strokeWidth="1.5" className="animate-pulse" />
              )}
              {/* Vertical guide on hover */}
              {trendHover?.idx === idx && (
                <line x1={p.x} y1={pad} x2={p.x} y2={svgH - pad} stroke="var(--primary-color)" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.5" />
              )}
            </g>
          ))}
        </svg>

        {/* Floating tooltip */}
        {trendHover && (
          <div
            className="trend-tooltip"
            style={{
              left: `${trendHover.pctX}%`,
              top: `${trendHover.pctY}%`,
            }}
          >
            <div className="text-[10px] font-black text-primary uppercase tracking-wider">{trendHover.label}</div>
            <div className="text-sm font-black text-text mt-0.5">Risk Score: <span className={trendHover.val >= 70 ? 'text-danger' : trendHover.val >= 40 ? 'text-warning' : 'text-success'}>{trendHover.val}%</span></div>
            <div className="text-[9px] text-text-muted mt-0.5">{trendHover.val >= 70 ? 'Critical threshold exceeded' : trendHover.val >= 40 ? 'Elevated risk level' : 'Within safe range'}</div>
          </div>
        )}

        {/* X-axis labels */}
        <div className="flex justify-between w-full px-6 text-[9px] font-bold text-text-muted uppercase tracking-widest mt-2">
          {auditLabels.map((lbl, i) => (
            <span key={i} className={i === auditLabels.length - 1 ? 'text-secondary font-black' : ''}>{lbl}</span>
          ))}
        </div>
      </div>
    );
  };

  // Fetch status
  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${API_BASE}/status`);
      setStatus(res.data);
      if (res.data.neo4j_uri) {
        setDbConfig(prev => ({ ...prev, uri: res.data.neo4j_uri }));
      }
    } catch (e) {
      console.error("Failed to connect to FastAPI backend.", e);
    }
  };

  // Fetch documents list
  const fetchDocuments = async () => {
    try {
      const res = await axios.get(`${API_BASE}/documents`);
      setDocuments(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchDocuments();
  }, []);

  // Run pipeline trigger
  const runPipeline = async () => {
    setLoading(true);
    setShowPipelineOverlay(true);
    setPipelineStep(1); // Stage 1: Ingesting
    setPipelineLogs(["[INFO] Starting full document fraud ingestion..."]);
    
    try {
      // Simulate stepping for visual delight
      await new Promise(r => setTimeout(r, 600));
      setPipelineStep(2); // Stage 2: NLP Extracting
      setPipelineLogs(prev => [...prev, "[INFO] Loaded spaCy model successfully.", "[INFO] Extracting entities and identifying relationships..."]);
      
      await new Promise(r => setTimeout(r, 800));
      setPipelineStep(3); // Stage 3: Resolving Entities
      setPipelineLogs(prev => [...prev, "[INFO] De-duplicating entities via SequenceMatcher...", "[INFO] Resolved 14 unique entities from 28 raw mentions."]);
      
      await new Promise(r => setTimeout(r, 600));
      setPipelineStep(4); // Stage 4: Graph Traversals
      setPipelineLogs(prev => [...prev, "[INFO] Populating graph structure...", "[INFO] Running 5 graph traversal algorithms (Address Reuse, Collateral Conflicts, Network Cycles, Shell Companies, Liens)..."]);
      
      const res = await axios.post(`${API_BASE}/run-pipeline`);
      
      await new Promise(r => setTimeout(r, 400));
      setPipelineLogs(prev => [...prev, ...res.data.logs, "[INFO] Analysis complete!"]);
      setPipelineStep(5); // Complete
      
      setData(res.data);
      setGraphKey(prev => prev + 1);
      fetchStatus();
      
      // Auto redirect to anomaly tab
      setTimeout(() => {
        setShowPipelineOverlay(false);
        setActiveTab("alerts");
      }, 1000);
      
    } catch (e) {
      console.error(e);
      setPipelineLogs(prev => [...prev, "[ERROR] Pipeline execution failed. Check if backend and/or database is running."]);
      alert("Failed to run pipeline. Is the FastAPI backend running?");
      setShowPipelineOverlay(false);
    } finally {
      setLoading(false);
    }
  };

  // Connect Neo4j
  const connectDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbConnecting(true);
    try {
      await axios.post(`${API_BASE}/connect-neo4j`, dbConfig);
      await fetchStatus();
      setShowDbModal(false);
      alert("Connected to Neo4j database successfully!");
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to connect to Neo4j. Check configurations.");
    } finally {
      setDbConnecting(false);
    }
  };

  // Generate mock documents
  const generateMockDocs = async () => {
    try {
      const res = await axios.post(`${API_BASE}/generate-docs`);
      alert(res.data.message);
      fetchDocuments();
      fetchStatus();
    } catch (e) {
      console.error(e);
      alert("Failed to generate mock documents.");
    }
  };

  // Document uploader handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      await axios.post(`${API_BASE}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      alert(`File '${file.name}' uploaded successfully.`);
      fetchDocuments();
      fetchStatus();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to upload document.");
    }
  };

  // Delete document
  const deleteDoc = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete '${filename}'?`)) return;
    try {
      await axios.delete(`${API_BASE}/documents/${filename}`);
      fetchDocuments();
      fetchStatus();
      if (selectedDoc === filename) {
        setSelectedDoc(null);
        setSelectedDocDetails(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Select document to inspect details
  const selectDocument = async (filename: string) => {
    setSelectedDoc(filename);
    setSelectedDocDetails(null);
    setDocLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/documents/${filename}`);
      setSelectedDocDetails(res.data);
    } catch (e) {
      console.error(e);
      alert("Failed to load document details.");
    } finally {
      setDocLoading(false);
    }
  };

  // Preset queries for Cypher Lab
  const presetQueries = [
    {
      title: "Show Full Graph",
      cypher: "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 100"
    },
    {
      title: "Find Address Reuse",
      cypher: "MATCH (addr:Address)<-[:REGISTERED_AT|RESIDES_AT]-(e)\nWITH addr, collect(e.name) AS names, count(e) AS cnt\nWHERE cnt >= 2\nRETURN addr.full_address, names, cnt"
    },
    {
      title: "Double-Pledge Assets",
      cypher: "MATCH (p1:Person)-[:APPLIED_FOR_LOAN_WITH]->(a:Asset)\nMATCH (p2:Person)-[:APPLIED_FOR_LOAN_WITH]->(a)\nWHERE p1.entity_id <> p2.entity_id\nRETURN a.name, p1.name, p2.name"
    },
    {
      title: "Guarantor Loops",
      cypher: "MATCH (g:Person)-[:GUARANTOR_FOR]->(a1:Person)\nMATCH (g)-[:GUARANTOR_FOR]->(a2:Person)\nWHERE a1.entity_id <> a2.entity_id\nRETURN g.name AS guarantor, a1.name AS applicant_1, a2.name AS applicant_2"
    }
  ];

  // Run custom Cypher
  const runCustomCypher = async (queryStr?: string) => {
    const targetQuery = queryStr || cypherQuery;
    if (!targetQuery || !targetQuery.trim()) return;
    
    setCypherLoading(true);
    setCypherError("");
    setCypherResults(null);
    try {
      const res = await axios.post(`${API_BASE}/cypher`, { query: targetQuery });
      setCypherResults(res.data.data);
    } catch (err: any) {
      console.error(err);
      setCypherError(err.response?.data?.detail || "An error occurred executing the Cypher query.");
    } finally {
      setCypherLoading(false);
    }
  };

  if (showLanding && !user) {
    return (
      <div className={`min-h-screen relative overflow-y-auto font-sans flex flex-col transition-colors duration-300 ${isDarkMode ? "dark-theme bg-[#060913] text-white" : "light-theme bg-[#FAFBFC] text-slate-800"}`}>
        {/* Navigation */}
        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <div className={`relative p-1.5 rounded-xl bg-gradient-to-tr from-[#0052cc] via-[#0ea5e9] to-[#3b82f6] ${isDarkMode ? 'shadow-[0_0_15px_rgba(14,165,233,0.4)]' : 'shadow-lg'} overflow-hidden group`}>
              <div className="absolute inset-0 bg-white/20 group-hover:scale-150 transition-transform duration-700 ease-out rounded-full blur-xl" />
              <svg className="w-6 h-6 text-white relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="11" r="3" fill="white" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 14V17M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="15" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="text-lg font-black tracking-tight text-[#0052cc] dark:text-white uppercase">NexusGuard</h1>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <a href="#features" className="hover:text-[#0052cc] dark:hover:text-white transition-colors">Platform Capabilities</a>
              <a href="#workflow" className="hover:text-[#0052cc] dark:hover:text-white transition-colors">How it works</a>
            </div>
            <div className="w-px h-6 bg-slate-200 dark:bg-white/10 hidden md:block" />
            <div className="flex items-center gap-4">
               <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors cursor-pointer"
               >
                  {isDarkMode ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                  )}
               </button>
               <button onClick={() => setShowLanding(false)} className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#0052cc] to-[#0ea5e9] text-white font-bold text-sm hover:shadow-lg transition-all cursor-pointer">
                 Secure Login
               </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center text-center px-4 py-32 relative">
          <ParticleBackground isDarkMode={isDarkMode} />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0 opacity-40">
             <div className="absolute w-[600px] h-[600px] border-[1px] border-[#0052cc]/20 rounded-full animate-sonar" />
             <div className="absolute w-[600px] h-[600px] border-[1px] border-[#d97706]/10 rounded-full animate-sonar animation-delay-1000" />
          </div>
          
          <div className="z-10 flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0052cc]/10 text-[#0052cc] border border-[#0052cc]/20 text-[10px] font-black uppercase tracking-widest mb-8">
            <Network className="w-3.5 h-3.5" /> ENTERPRISE RISK INTELLIGENCE
          </div>
          
          <h1 className="z-10 text-6xl md:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-tight max-w-4xl">
            The future of <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0052cc] to-[#3b82f6]">fraud detection</span>
          </h1>
          
          <p className="z-10 text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 mt-6 mb-8 tracking-wide">
            Predictive. Graph-powered. Optimized.
          </p>
          
          <p className="z-10 text-base md:text-lg text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed mb-10">
            NexusGuard brings graph-database integrity, AI-powered entity resolution, and real-time structural visibility to every loan application — from the underwriter's desk to the RBI's audit log.
          </p>

          <div className="z-10 flex flex-col sm:flex-row items-center gap-4">
             <button onClick={() => setShowLanding(false)} className="px-8 py-4 rounded-full bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-bold shadow-xl hover:shadow-2xl transition-all flex items-center gap-2 cursor-pointer">
               Start for free <ChevronRight className="w-4 h-4" />
             </button>
             <button onClick={() => setShowLanding(false)} className="px-8 py-4 rounded-full bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all cursor-pointer">
               Explore the dashboard
             </button>
          </div>
        </section>

        {/* Platform Capabilities (Grid) */}
        <section id="features" className="bg-white dark:bg-[#080C1A] py-24 px-8 border-y border-slate-100 dark:border-white/5 relative z-10">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest block mb-2">PLATFORM CAPABILITIES</span>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white">Everything in one console</h2>
              <p className="text-slate-500 dark:text-slate-400 mt-4 max-w-xl mx-auto">
                From the moment a document is ingested to its final audit — NexusGuard covers the entire verification journey.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-[#F8FAFC] dark:bg-[#0F172A] p-8 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col gap-4 hover:shadow-xl transition-all">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Graph Verification</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Every entity is structurally mapped using multi-hop Cypher queries. Any address reuse or double-pledging is detected instantly.
                </p>
              </div>
              <div className="bg-[#FAF5FF] dark:bg-[#1E1B4B] p-8 rounded-2xl border border-purple-100 dark:border-purple-900/30 flex flex-col gap-4 hover:shadow-xl transition-all">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">AI Predictive Insights</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  NLP machine-learning models predict compliance disruptions and extract hidden financial entities before they escalate.
                </p>
              </div>
              <div className="bg-[#F0FDF4] dark:bg-[#064E3B] p-8 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 flex flex-col gap-4 hover:shadow-xl transition-all">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Network className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Smart Traversal</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Dynamic routing engine calculates the optimal graph path across the unified network in real-time.
                </p>
              </div>
              <div className="bg-[#F0F9FF] dark:bg-[#0C4A6E] p-8 rounded-2xl border border-sky-100 dark:border-sky-900/30 flex flex-col gap-4 hover:shadow-xl transition-all">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <FilePlus className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Document Registration</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Branch managers can securely upload, parse, and release application files to the Neo4j ledger in seconds.
                </p>
              </div>
              <div className="bg-[#ECFDF5] dark:bg-[#022C22] p-8 rounded-2xl border border-teal-100 dark:border-teal-900/30 flex flex-col gap-4 hover:shadow-xl transition-all">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Provenance Tracking</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Visualize every corporate handoff — subsidiary → guarantor → director — in a live interconnected timeline.
                </p>
              </div>
              <div className="bg-[#FDF4FF] dark:bg-[#4A044E] p-8 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-900/30 flex flex-col gap-4 hover:shadow-xl transition-all">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400 flex items-center justify-center">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Real-time Dashboard</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Unified command console with live KPIs, counterfeit structural alerts, and system-wide threat maps.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Animated Workflow Timeline Section */}
        <section id="workflow" className="py-24 px-8 relative z-10 mb-16 overflow-hidden">
          <div className="max-w-4xl mx-auto">
            <MotionDiv 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <span className="text-[10px] font-black text-[#0052cc] uppercase tracking-widest block mb-2">WORKFLOW</span>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white">How NexusGuard works</h2>
            </MotionDiv>
            
            <div className="relative space-y-12 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-1 before:bg-gradient-to-b before:from-[#0052cc]/10 before:via-[#0052cc] before:to-[#0052cc]/10">
              
              {[
                {
                  step: 1,
                  title: "Branch registers a document",
                  desc: "Underwriter logs the application ID, guarantor info, and property deed on the NexusGuard portal. A genesis node is created."
                },
                {
                  step: 2,
                  title: "Provenance chain builds automatically",
                  desc: "Every extraction — DINs, Aadhaar, survey numbers — appends a new structurally-linked node to the graph network."
                },
                {
                  step: 3,
                  title: "Stakeholders verify authenticity",
                  desc: "Vigilance officers and audit teams can run Cypher traversals to verify structural integrity in under a second."
                },
                {
                  step: 4,
                  title: "AI surfaces risks proactively",
                  desc: "NexusGuard's models continuously monitor for anomalies, address overlap loops, and shell company patterns — alerting teams before harm occurs."
                }
              ].map((item, i) => (
                <MotionDiv 
                  key={item.step}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white dark:border-[#060913] bg-[#0052cc] text-white font-black text-sm shadow-[0_0_20px_rgba(0,82,204,0.4)] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-hover:scale-110 transition-transform z-10">
                    {item.step}
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl bg-white dark:bg-[#111638] border border-slate-100 dark:border-white/5 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                    <span className="text-[10px] font-black text-[#0052cc] tracking-widest uppercase block mb-2">0{item.step}</span>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </MotionDiv>
              ))}

            </div>
          </div>
        </section>

      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen relative overflow-hidden font-sans flex items-center justify-center transition-colors duration-300 ${isDarkMode ? "dark-theme bg-[#060913] text-white" : "light-theme bg-[#FAFBFC] text-slate-800"}`}>
        <ParticleBackground isDarkMode={isDarkMode} />
        
        {/* Animated Background Rings (now visible in both themes, adapting colors) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0 opacity-50 dark:opacity-100">
          <div className={`absolute w-[400px] h-[400px] border-[1px] rounded-full animate-sonar ${isDarkMode ? 'border-[#0052cc]/30' : 'border-[#0052cc]/20'}`} />
          <div className={`absolute w-[400px] h-[400px] border-[1px] rounded-full animate-sonar animation-delay-1000 ${isDarkMode ? 'border-[#d97706]/20' : 'border-[#d97706]/10'}`} />
          <div className={`absolute w-[400px] h-[400px] border-[1px] rounded-full animate-sonar animation-delay-2000 ${isDarkMode ? 'border-[#0052cc]/10' : 'border-[#0052cc]/5'}`} />
        </div>

        {/* Theme Toggle Button on Login */}
        <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur-md border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-all cursor-pointer z-50 shadow-lg"
        >
            {isDarkMode ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
        </button>

        <div className="z-10 w-full max-w-md bg-white dark:bg-[#111638] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#0052cc] to-[#d97706]" />
          <div className="flex flex-col items-center mb-8 mt-2">
            <div className={`relative p-3 rounded-2xl bg-gradient-to-tr from-[#0052cc] via-[#0ea5e9] to-[#3b82f6] ${isDarkMode ? 'shadow-[0_0_30px_rgba(14,165,233,0.5)]' : 'shadow-xl'} overflow-hidden group mb-4`}>
              <div className="absolute inset-0 bg-white/20 group-hover:scale-150 transition-transform duration-700 ease-out rounded-full blur-2xl" />
              <svg className="w-12 h-12 text-white relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="11" r="3" fill="white" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 14V17M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="15" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-center text-[#0052cc] dark:text-white uppercase">NexusGuard</h1>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Enterprise Risk Portal</p>
          </div>
          
          {loginStep === "LOCKED" && (
            <div className="space-y-6 text-center">
               <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4 text-red-500">
                  <Shield className="w-12 h-12 mx-auto mb-2 opacity-80" />
                  <h2 className="text-xl font-black uppercase tracking-widest">Account Blocked</h2>
               </div>
               <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  For your security, access has been disabled due to multiple failed login attempts. An alert has been sent to your registered Canara Bank email and mobile device (+91 98****32).
               </p>
               <div className="pt-6">
                  <button onClick={() => { setLoginStep("LOGIN"); setFailedAttempts(0); }} className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-white transition-colors cursor-pointer border border-dashed border-slate-400/30 px-4 py-2 rounded-lg">
                    [Demo Action: Simulate clicking unblock link from email]
                  </button>
               </div>
            </div>
          )}

          {loginStep === "FORGOT" && (
            <form onSubmit={handleForgot} className="space-y-5">
               <div className="p-3 bg-[#d97706]/10 border border-[#d97706]/30 rounded-xl text-center mb-4 text-[#d97706]">
                  <h2 className="text-sm font-black uppercase tracking-widest">Reset Access</h2>
                  <p className="text-[10px] mt-1">An OTP has been sent to your device.</p>
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">SMS Reset Code</label>
                  <input 
                    type="text" 
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter 112233"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#d97706] text-slate-800 dark:text-white font-mono tracking-widest"
                    required
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">New Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#d97706] text-slate-800 dark:text-white"
                    required
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Confirm New Password</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#d97706] text-slate-800 dark:text-white"
                    required
                  />
               </div>
               <button type="submit" className="w-full bg-gradient-to-r from-[#d97706] to-[#b45309] text-white font-bold py-3 rounded-lg uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-xl cursor-pointer">
                  Verify & Reset
               </button>
               <button type="button" onClick={() => setLoginStep("LOGIN")} className="w-full text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer text-center mt-2">
                  Back to Login
               </button>
            </form>
          )}

          {loginStep === "2FA" && (
            <form onSubmit={handle2FA} className="space-y-5">
               <div className="p-3 bg-[#0052cc]/10 border border-[#0052cc]/30 rounded-xl text-center mb-4 text-[#0052cc]">
                  <h2 className="text-sm font-black uppercase tracking-widest">Step 2: Verification</h2>
                  <p className="text-[10px] mt-1">Check your secure authenticator app.</p>
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">6-Digit Code</label>
                  <input 
                    type="text" 
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value)}
                    placeholder="Enter 849201"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-2xl focus:outline-none focus:border-[#0052cc] text-slate-800 dark:text-white text-center font-mono tracking-widest"
                    maxLength={6}
                    required
                  />
               </div>
               <button type="submit" className="w-full bg-gradient-to-r from-[#0052cc] to-[#0ea5e9] text-white font-bold py-3 rounded-lg uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-xl cursor-pointer">
                  Authenticate
               </button>
               <button type="button" onClick={() => setLoginStep("LOGIN")} className="w-full text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer text-center mt-2">
                  Back to Login
               </button>
            </form>
          )}

          {loginStep === "LOGIN" && (
            <form onSubmit={handleLogin} className="space-y-5">
              {failedAttempts > 0 && failedAttempts < 3 && (
                <div className={`p-2 rounded text-xs font-bold text-center ${failedAttempts === 2 ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/30'}`}>
                  Incorrect credentials. {3 - failedAttempts} attempt(s) remaining.
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Employee Code</label>
                <input 
                  type="text" 
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="e.g. CB-MUM-042 or CB-HQ-ADMIN"
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#0052cc] text-slate-800 dark:text-white"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Password</label>
                <input 
                  type="password" 
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#0052cc] text-slate-800 dark:text-white"
                  required
                />
              </div>
              <button type="submit" className="w-full mt-4 bg-gradient-to-r from-[#0052cc] to-[#d97706] hover:from-[#0047b3] hover:to-[#b45309] text-white font-bold py-3 rounded-lg uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-xl cursor-pointer">
                Verify Identity
              </button>
              
              <div className="text-center mt-3 flex flex-col gap-2">
                 <button type="button" onClick={() => setLoginStep("FORGOT")} className="text-xs font-bold text-slate-400 hover:text-[#0052cc] transition-colors cursor-pointer">
                    Forgot Password / Reset Access
                 </button>
                 <button type="button" onClick={() => setShowLanding(true)} className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer mt-2">
                    Back to Home Page
                 </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Authorized Personnel Only • Canara Bank
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen relative overflow-hidden font-sans flex flex-col transition-colors duration-300 ${isDarkMode ? "dark-theme bg-background text-text" : "light-theme bg-background text-text"}`}>
      <ParticleBackground isDarkMode={isDarkMode} />
      <div className="cyber-grid absolute inset-0 pointer-events-none" />

      {/* Floating Animated Background Blobs (only visible in dark mode) */}
      {isDarkMode && (
        <>
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[140px] -z-20 animate-blob-1 pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-secondary/10 rounded-full blur-[140px] -z-20 animate-blob-2 pointer-events-none" />
        </>
      )}

      {/* Main Layout container */}
      <div className="flex flex-1 z-10">
        
        {/* Left Sidebar Menu */}
        <aside className={`w-80 border-r p-6 flex flex-col justify-between ${isDarkMode ? 'border-primary/15 bg-[var(--sidebar-bg)] backdrop-blur-md' : 'border-[#E5E7EB] bg-white'}`}>
          <div className="space-y-8">
            {/* Logo area */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`relative p-2 rounded-xl bg-gradient-to-tr from-[#0052cc] via-[#0ea5e9] to-[#3b82f6] ${isDarkMode ? 'shadow-[0_0_24px_rgba(14,165,233,0.4)]' : 'shadow-lg'} overflow-hidden group`}>
                  <div className="absolute inset-0 bg-white/20 group-hover:scale-150 transition-transform duration-700 ease-out rounded-full blur-xl" />
                  <svg className="w-8 h-8 text-white relative z-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L3 6V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V6L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="11" r="3" fill="white" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12 14V17M9 11H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="15" cy="8" r="1.5" fill="currentColor"/>
                    <circle cx="9" cy="8" r="1.5" fill="currentColor"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent uppercase tracking-wider">
                    NexusGuard
                  </h1>
                </div>
              </div>
              
              {/* Sun/Moon Theme Switcher Button */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl border border-border hover:border-primary/30 bg-surface hover:bg-black/5 dark:hover:bg-white/10 text-primary transition-all cursor-pointer shadow-sm"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Ingestion Trigger / Run Engine */}
            <button 
              onClick={runPipeline}
              disabled={loading}
              className={`w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm tracking-wider ${isDarkMode ? 'hover:shadow-[0_0_24px_rgba(0,229,255,0.4)]' : 'hover:shadow-lg'}`}
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5 fill-[#0A0E27]" />
              )}
              {loading ? "Analyzing..." : "Execute AI Pipeline"}
            </button>

            {/* Nav Menu */}
            <nav className="flex flex-col gap-1.5">
              <SidebarLink 
                icon={<Activity className="w-5 h-5" />} 
                label="Dashboard" 
                active={activeTab === "dashboard"} 
                onClick={() => setActiveTab("dashboard")} 
              />
              <SidebarLink 
                icon={<FileText className="w-5 h-5" />} 
                label="Document Manager" 
                active={activeTab === "documents"} 
                onClick={() => {
                  setActiveTab("documents");
                  fetchDocuments();
                }} 
              />
              <SidebarLink 
                icon={<AlertTriangle className="w-5 h-5" />} 
                label="Anomaly Center" 
                active={activeTab === "alerts"} 
                onClick={() => setActiveTab("alerts")} 
              />
              <SidebarLink 
                icon={<Network className="w-5 h-5" />} 
                label="Graph Explorer" 
                active={activeTab === "graph"} 
                onClick={() => setActiveTab("graph")} 
              />
              {user?.role === "ADMIN" && (
                <SidebarLink 
                  icon={<Database className="w-5 h-5" />} 
                  label="Cypher Lab" 
                  active={activeTab === "cypher"} 
                  onClick={() => setActiveTab("cypher")} 
                />
              )}
              <SidebarLink 
                icon={<BarChart2 className="w-5 h-5" />} 
                label="Risk Analytics" 
                active={activeTab === "analytics"} 
                onClick={() => setActiveTab("analytics")} 
              />
            </nav>
          </div>

          {/* Database connection badge & settings trigger */}
          <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Database Status</span>
              {user?.role === "ADMIN" && (
                <button 
                  onClick={() => setShowDbModal(true)}
                  className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text transition-colors"
                  title="Configure Database Connection"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {status.neo4j_connected ? (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse flex-shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold text-success leading-tight">Enterprise Mode</div>
                  <div className="text-[9px] text-text-muted leading-tight mt-0.5">Core Banking Server Connected (Neo4j)</div>
                  <div className="text-[8px] text-text-muted/70 truncate max-w-[180px] mt-0.5">{status.neo4j_uri}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-info animate-pulse flex-shrink-0" />
                <div className="text-left">
                  <div className="text-xs font-bold text-info leading-tight">Edge Agent Mode</div>
                  <div className="text-[9px] text-text-muted leading-tight mt-0.5">Rural Branch Desktop Active (NetworkX Offline)</div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => { setUser(null); setLoginStep("LOGIN"); setShowLanding(true); setFailedAttempts(0); setLoginPass(""); setNewPassword(""); setConfirmPassword(""); }}
            className="w-full mt-4 p-3 rounded-xl border border-red-500/20 text-red-500 font-bold text-xs uppercase tracking-wider hover:bg-red-500/10 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" /> Log Out
          </button>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 overflow-y-auto p-8 flex flex-col">
          
          <AnimatePresence mode="wait">
            
            {/* Dashboard Tab */}
            {activeTab === "dashboard" && (
              <MotionDiv
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8 flex-1"
              >
                {/* Header title */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-text">System Operations Center</h2>
                      <p className="text-text-muted text-xs mt-1">Ingestion monitoring, model diagnostic charts, and active risk scoring.</p>
                    </div>
                  
                    {/* Quick Diagnostics */}
                    <div className="flex items-center gap-4 bg-surface border border-border rounded-xl px-5 py-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-muted">spaCy NLP:</span>
                        <span className={`font-bold ${status.spacy_loaded ? "text-success" : "text-danger"}`}>
                          {status.spacy_loaded ? "LOADED" : "OFFLINE"}
                        </span>
                      </div>
                      <div className="w-px h-4 bg-white/10" />
                      <div className="flex items-center gap-1.5">
                        <span className="text-text-muted">Doc Count:</span>
                        <span className="font-bold text-primary">{status.documents_ready}</span>
                      </div>
                    </div>
                  </div>
                  
                  {user?.role === "UNDERWRITER" && (
                     <div className="p-4 bg-[#0052cc]/5 border border-[#0052cc]/20 rounded-xl flex items-center gap-4">
                        <div className="p-2 bg-[#0052cc]/10 text-[#0052cc] rounded-lg"><Shield className="w-6 h-6" /></div>
                        <div>
                           <h3 className="text-sm font-black text-[#0052cc] uppercase tracking-wider">RESTRICTED VIEW: Local Branch Access Only</h3>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">As a Branch Underwriter, your view is restricted to loan documents from your local branch ({user?.branch || 'UNKNOWN'}). You do not have global graph search or administrative settings permissions. Cypher Lab is hidden.</p>
                        </div>
                     </div>
                  )}
                  {user?.role === "ADMIN" && (
                     <div className="p-4 bg-[#d97706]/5 border border-[#d97706]/20 rounded-xl flex items-center gap-4">
                        <div className="p-2 bg-[#d97706]/10 text-[#d97706] rounded-lg"><Shield className="w-6 h-6" /></div>
                        <div>
                           <h3 className="text-sm font-black text-[#d97706] uppercase tracking-wider">GLOBAL VIEW: Chief Vigilance Officer</h3>
                           <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">You have unrestricted global access to all branches. Cypher Lab, Admin Settings, and Cross-Branch Query tools are unlocked and visible in your sidebar.</p>
                        </div>
                     </div>
                  )}
                </div>

                {renderTrafficLightComponent()}

                {/* Metrics row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <MetricCard 
                    icon={<FileText className="w-6 h-6 text-primary" />} 
                    value={data?.metrics?.documents ?? status.documents_ready} 
                    label="Ingested Docs" 
                  />
                  <MetricCard 
                    icon={<Search className="w-6 h-6 text-primary" />} 
                    value={data?.metrics?.entities ?? 0} 
                    label="NER Entities" 
                  />
                  <MetricCard 
                    icon={<Network className="w-6 h-6 text-primary" />} 
                    value={data?.metrics?.relationships ?? 0} 
                    label="Graph Edges" 
                  />
                  <MetricCard 
                    icon={<AlertTriangle className="w-6 h-6 text-danger" />} 
                    value={data?.alerts?.length ?? 0} 
                    label="Detected Alerts"
                    danger={(data?.alerts?.length ?? 0) > 0}
                  />
                </div>

                {/* Risk score gauge card */}
                <div className="grid grid-cols-1 gap-6">
                  <div className="glass-card flex flex-col justify-between min-h-[300px]">
                    <div>
                      <h3 className="text-lg font-bold">Threat & Fraud Assessment</h3>
                      <p className="text-xs text-text-muted mt-1">Aggregated mathematical threat indexing computed from graph traversals.</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-10 my-6">
                      {/* Gauge circle */}
                      <div className="relative w-44 h-44 flex items-center justify-center rounded-full border-4 border-border bg-black/5 dark:bg-black/35 shadow-[inset_0_0_20px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_0_20px_rgba(0,0,0,0.4)]">
                        <svg className="absolute w-full h-full -rotate-90">
                          <circle 
                            cx="88" 
                            cy="88" 
                            r="76" 
                            stroke="rgba(0, 229, 255, 0.08)" 
                            strokeWidth="10" 
                            fill="transparent" 
                          />
                          <circle 
                            cx="88" 
                            cy="88" 
                            r="76" 
                            stroke="url(#riskGradient)" 
                            strokeWidth="10" 
                            fill="transparent" 
                            strokeDasharray="477"
                            strokeDashoffset={477 - (477 * (data ? data.risk_score : 0))}
                            strokeLinecap="round"
                            className="transition-all duration-1000 ease-out"
                          />
                          <defs>
                            <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#00E5FF" />
                              <stop offset="50%" stopColor="#FFB800" />
                              <stop offset="100%" stopColor="#FF4757" />
                            </linearGradient>
                          </defs>
                        </svg>
                        
                        <div className="text-center z-10">
                          <span className="text-5xl font-black tracking-tight text-text">
                            {data ? Math.round(data.risk_score * 100) : 0}%
                          </span>
                          <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Risk Score</span>
                        </div>
                      </div>

                      {/* Detail metadata */}
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Severity Level</span>
                          <div className="flex items-center gap-2">
                            {data ? (
                              <span className={`text-lg font-extrabold flex items-center gap-1.5 ${
                                data.overall_severity === 'CRITICAL' ? 'text-danger' : 
                                data.overall_severity === 'HIGH' ? 'text-warning' : 
                                data.overall_severity === 'MEDIUM' ? 'text-secondary' : 'text-primary'
                              }`}>
                                <AlertTriangle className="w-5 h-5" />
                                {data.overall_severity} RISK
                              </span>
                            ) : (
                              <span className="text-text-muted font-semibold">NO PIPELINE EXECUTED</span>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-text-muted leading-relaxed">
                          {data ? (
                            `The system has run document parsing and registered ${data.metrics.entities} unique entities. Detections found ${data.alerts.length} structural anomalies. We recommend executing standard bank verification procedures for flagged accounts.`
                          ) : (
                            "Please run the AI pipeline using the top left trigger button. This will ingest documents, map the relationships, and identify overlaps in immovable land collateral double pledging or address fraud."
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </MotionDiv>
            )}

            {/* Document Manager Tab */}
            {activeTab === "documents" && (
              <MotionDiv
                key="documents"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 flex-1 flex flex-col min-h-0"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">Document Processing Ingestion</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Upload loan forms, sale deeds, or validation files to identify forged coordinates and entities.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0 overflow-hidden">
                  
                  {/* Left Column: Explorer + Upload */}
                  <div className="lg:col-span-2 flex flex-col gap-4 min-h-[500px]">
                    
                    {/* Upload card */}
                    <div className="glass-card relative overflow-hidden py-6 border-dashed border-2 border-primary/20 hover:border-primary/40 text-center cursor-pointer transition-all flex flex-col items-center justify-center">
                      <input 
                        type="file" 
                        accept=".txt,.pdf,.png,.jpg,.jpeg" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <UploadCloud className="w-10 h-10 text-primary/45 mb-2.5" />
                      <span className="text-xs font-bold block mb-1">Drag & Drop or Click to Upload</span>
                      <span className="text-[10px] text-slate-500">Supports PDF, TXT, and scanned document images</span>
                    </div>

                    {/* Files list */}
                    <div className="glass-panel flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Documents Repository</div>
                        <button
                          onClick={generateMockDocs}
                          className="px-2.5 py-1 rounded bg-slate-200 dark:bg-[#111638] hover:bg-primary/10 border border-primary/20 hover:border-primary/40 text-primary text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                        >
                          <FilePlus className="w-3 h-3" />
                          Generate Mock Data
                        </button>
                      </div>
                      
                      <div className="space-y-2 flex-1 overflow-y-auto">
                        {documents.length === 0 ? (
                          <div className="text-center py-12 text-slate-500 text-xs">
                            No documents found in input directory. Generate mock documents or upload files.
                          </div>
                        ) : (
                          documents.map((doc, idx) => (
                            <div 
                              key={idx}
                              onClick={() => selectDocument(doc.filename)}
                              className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                                selectedDoc === doc.filename 
                                  ? "bg-primary/10 border-primary/40 shadow-[0_0_12px_rgba(0,82,204,0.08)]" 
                                  : "bg-surface hover:bg-surface-hover border-border/30 hover:border-border"
                              }`}
                            >
                              <div className="flex items-center gap-3 truncate">
                                <FileText className={`w-5 h-5 flex-shrink-0 ${selectedDoc === doc.filename ? "text-primary" : "text-slate-500"}`} />
                                <div className="truncate text-left">
                                  <div className="text-xs font-bold truncate text-slate-800 dark:text-slate-100">{doc.filename}</div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5 uppercase tracking-wider">{doc.file_type} — {Math.round(doc.size_bytes / 1024)} KB</div>
                                </div>
                              </div>
                              
                              <button 
                                onClick={(e) => deleteDoc(doc.filename, e)}
                                className="p-1.5 rounded hover:bg-danger/10 text-slate-400 hover:text-danger transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Ingestion Inspector details */}
                  <div className="lg:col-span-3 glass-panel p-6 flex flex-col min-h-[500px]">
                    {selectedDoc ? (
                      docLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                          <span className="text-xs font-semibold">Running Local OCR and NLP Extraction...</span>
                        </div>
                      ) : selectedDocDetails ? (
                        <div className="flex-1 flex flex-col min-h-0">
                          
                          {/* Title block */}
                          <div className="flex items-start justify-between border-b border-border pb-4 mb-4 flex-shrink-0">
                            <div>
                              <h3 className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[300px]">{selectedDocDetails.filename}</h3>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase mt-1">
                                {selectedDocDetails.doc_type}
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Identified Metadata</span>
                              <span className="text-xs font-bold mt-0.5 text-slate-700 dark:text-slate-200">
                                {selectedDocDetails.entities.length} entities • {selectedDocDetails.relationships.length} links
                              </span>
                            </div>
                          </div>

                          {/* Split View */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0 overflow-y-auto">
                            
                            {/* Raw Content Viewer */}
                            <div className="flex flex-col min-h-0 bg-slate-100/50 dark:bg-black/25 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex-shrink-0">Ingested Raw Text</span>
                              <pre className="flex-1 overflow-auto text-left text-[11px] text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-text p-2">
                                {selectedDocDetails.raw_text}
                              </pre>
                            </div>

                            {/* Extracted Details */}
                            <div className="flex flex-col gap-4 overflow-y-auto">
                              
                              {/* Extracted Entities */}
                              <div className="bg-slate-100/50 dark:bg-black/10 rounded-xl border border-slate-200 dark:border-white/5 p-4">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3">Extracted Entities</span>
                                <div className="flex flex-wrap gap-2">
                                  {selectedDocDetails.entities.map((e: any, i: number) => (
                                    <div 
                                      key={i}
                                      className={`px-3 py-1.5 rounded-lg border text-xs flex flex-col gap-0.5 ${
                                        e.entity_type === 'PERSON' ? 'bg-info/5 border-info/20 text-info' : 
                                        e.entity_type === 'ASSET' ? 'bg-success/5 border-success/20 text-success' : 
                                        e.entity_type === 'ADDRESS' ? 'bg-warning/5 border-warning/20 text-warning' : 
                                        'bg-purple-500/5 border-purple-500/20 text-purple-400'
                                      }`}
                                    >
                                      <span className="text-[8px] uppercase tracking-wider font-extrabold opacity-60">{e.entity_type}</span>
                                      <span className="font-bold text-slate-800 dark:text-slate-200">{e.name}</span>
                                      {Object.entries(e.attributes).map(([k, v]: any) => (
                                        <span key={k} className="text-[9px] opacity-75 font-mono mt-0.5 block">{k.toUpperCase()}: {v}</span>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Local Extracted Relations */}
                              <div className="bg-slate-100/50 dark:bg-black/10 rounded-xl border border-slate-200 dark:border-white/5 p-4 flex-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3">Extracted Relations</span>
                                <div className="space-y-1.5">
                                  {selectedDocDetails.relationships.length === 0 ? (
                                    <span className="text-slate-500 text-xs">No direct relationships identified inside document context.</span>
                                  ) : (
                                    selectedDocDetails.relationships.map((r: any, i: number) => {
                                      const srcEnt = selectedDocDetails.entities.find((e: any) => e.id === r.src)?.name || r.src;
                                      const tgtEnt = selectedDocDetails.entities.find((e: any) => e.id === r.tgt)?.name || r.tgt;
                                      return (
                                        <div key={i} className="flex items-center gap-1.5 p-2.5 rounded-lg bg-slate-200/50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-[11px]">
                                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{srcEnt}</span>
                                          <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                          <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold text-[9px] uppercase tracking-wide">
                                            {r.rel_type}
                                          </span>
                                          <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">{tgtEnt}</span>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center gap-3">
                        <FileText className="w-16 h-16 text-slate-700/60" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-400">No Document Selected</h3>
                          <p className="text-xs text-slate-500 max-w-sm mt-1">Select a document from the repository to inspect extracted entity resolution metadata and structural logic.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </MotionDiv>
            )}

            {/* Anomaly Center Tab */}
            {activeTab === "alerts" && (
              <MotionDiv
                key="alerts"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 flex-1"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">Graph-Traversal Anomaly Center</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Real-time alerts generated from structural traversals in land-registry and corporate databases.</p>
                </div>

                {renderTrafficLightComponent()}

                {!data || data.alerts.length === 0 ? (
                  <div className="glass-card flex flex-col items-center justify-center py-20 text-center gap-3">
                    <Shield className="w-16 h-16 text-primary/30" />
                    <div>
                      <h3 className="text-lg font-bold text-slate-300">No Fraud Alerts Detected</h3>
                      <p className="text-xs text-slate-500 max-w-md mt-1">Run the AI Pipeline to analyze the ingested repository and check for overlaps or hidden director loops.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.alerts.map((alert: any, i: number) => (
                      <div key={i} className="glass-card relative overflow-hidden group">
                        {/* Severity indicator block left */}
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${
                          alert.severity === 'CRITICAL' ? 'bg-danger shadow-[2px_0_12px_rgba(255,71,87,0.3)]' : 
                          alert.severity === 'HIGH' ? 'bg-warning' : 'bg-secondary'
                        }`} />
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center flex-wrap gap-2.5 mb-2.5">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                alert.severity === 'CRITICAL' ? 'bg-danger text-white' : 
                                alert.severity === 'HIGH' ? 'bg-warning text-[#0A0E27]' : 'bg-secondary text-[#0A0E27]'
                              }`}>
                                {alert.severity}
                              </span>
                              <span className="px-2.5 py-0.5 rounded text-[9px] font-bold bg-black/5 dark:bg-white/5 border border-border text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                {alert.alert_type}
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {alert.timestamp}
                              </span>
                            </div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{alert.title}</h3>
                          </div>
                          
                          <div className="flex items-center gap-3 bg-slate-100 dark:bg-black/20 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5 flex-shrink-0 self-start md:self-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Risk Match</span>
                            <span className={`text-2xl font-black ${
                              alert.severity === 'CRITICAL' ? 'text-danger' : 
                              alert.severity === 'HIGH' ? 'text-warning' : 'text-secondary'
                            }`}>
                              {Math.round(alert.risk_score * 100)}%
                            </span>
                          </div>
                        </div>

                        <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-5xl">{alert.description}</p>
                        
                        {/* Evidence & Recommendations Grid */}
                        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                          
                          {/* Evidence path */}
                          <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-black/25 border border-slate-200 dark:border-white/5">
                            <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <Network className="w-3.5 h-3.5 text-primary" />
                              Evidence Graph Traversal
                            </h4>
                            <ul className="space-y-2.5">
                              {alert.evidence_path.map((path: string, j: number) => (
                                <li key={j} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                                  <CornerDownRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                  <span>{path}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* Recommendations */}
                          <div className="p-4 rounded-xl bg-slate-100/50 dark:bg-black/25 border border-slate-200 dark:border-white/5">
                            <h4 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5 text-secondary" />
                              System Mitigation Protocol
                            </h4>
                            <ul className="space-y-2.5">
                              {alert.recommendations.map((rec: string, j: number) => (
                                <li key={j} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2">
                                  <span className="text-secondary text-base leading-none mt-0.5 flex-shrink-0">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                        </div>

                        {/* Anomaly Action Footer */}
                        <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                          <button
                            onClick={() => sendAlertNotification(alert.alert_id, alert.title)}
                            disabled={sendingAlertId !== null}
                            className="px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-500 text-[11px] font-extrabold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {sendingAlertId === alert.alert_id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5" />
                            )}
                            {sendingAlertId === alert.alert_id ? "Broadcasting..." : "Dispatch Vigilance Alert"}
                          </button>

                          {status.neo4j_connected && alert.cypher_query && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(alert.cypher_query);
                                  alert("Cypher query copied to clipboard!");
                                }}
                                className="px-3 py-1.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-slate-650 dark:text-slate-400 text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Copy className="w-3 h-3" /> Copy Query
                              </button>
                              <button 
                                onClick={() => {
                                  setCypherQuery(alert.cypher_query);
                                  setActiveTab("cypher");
                                  runCustomCypher(alert.cypher_query);
                                }}
                                className="px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[10px] font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Play className="w-3 h-3" /> Run in Lab
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </MotionDiv>
            )}

            {/* Graph Explorer Tab */}
            {activeTab === "graph" && (
              <MotionDiv
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="space-y-5 flex-1 flex flex-col min-h-0 overflow-hidden"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-text">Multi-Entity Network Analyst Map</h2>
                    <p className="text-text-muted text-xs mt-1">Visualizing Graph Database nodes. Updated dots represent clean profiles. Connected meshes represent fraud.</p>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-black/20 px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl shadow-sm text-text">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2563EB] shadow-[0_0_0_2px_rgba(37,99,235,0.2)]" /> Applicant</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#F59E0B] shadow-[0_0_0_2px_rgba(245,158,11,0.2)]" /> Aadhaar</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#059669] shadow-[0_0_0_2px_rgba(5,150,105,0.2)]" /> Property</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#7C3AED] shadow-[0_0_0_2px_rgba(124,58,237,0.2)]" /> Company</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#EF4444] shadow-[0_0_0_3px_rgba(239,68,68,0.25)]" /> Flagged</div>
                  </div>
                </div>

                {/* Stats Bar */}
                {data && data.graph_data && (
                  <div className="flex items-center gap-6 text-[11px] font-bold text-text-muted">
                    <span>Total Node Set: <span className="text-primary font-black">{data.graph_data.nodes.length}</span></span>
                    <span>Application Clusters: <span className="text-primary font-black">{data.graph_data.edges.length}</span></span>
                    <span>Database Status: <span className="text-success font-black">Local Ingest Ready</span></span>
                    <span>Threat Level: <span className={`font-black ${data.risk_score >= 0.7 ? 'text-danger' : data.risk_score >= 0.4 ? 'text-warning' : 'text-success'}`}>
                      {data.risk_score >= 0.7 ? '⚠ CRITICAL' : data.risk_score >= 0.4 ? '⚡ ELEVATED' : '✓ NORMAL'}
                    </span></span>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 flex-1 min-h-0 overflow-hidden">
                  
                  {/* Force Graph Canvas — always white bg to match reference */}
                  <div className="lg:col-span-3 rounded-xl border overflow-hidden relative min-h-[500px] bg-white border-slate-200">
                    {!data || !data.graph_data || data.graph_data.nodes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4">
                        <Network className="w-20 h-20 opacity-30" />
                        <div className="text-center">
                          <span className="text-sm font-bold block">No Graph Data Available</span>
                          <span className="text-xs mt-1 block">Run the AI Pipeline to ingest documents and generate the entity network.</span>
                        </div>
                      </div>
                    ) : (
                      <ForceGraph2D
                        ref={fgRef}
                        key={graphKey}
                        width={900}
                        height={550}
                        graphData={{
                          nodes: data.graph_data.nodes,
                          links: data.graph_data.edges.map((e: any) => ({
                            source: e.src,
                            target: e.tgt,
                            label: e.rel_type
                          }))
                        }}
                        nodeRelSize={5}
                        cooldownTicks={150}
                        d3AlphaDecay={0.04}
                        d3VelocityDecay={0.5}
                        onEngineStop={() => {
                          if (fgRef.current) {
                            fgRef.current.pauseAnimation();
                          }
                        }}
                        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                          const name = node.name || String(node.id);
                          const entityType = (node.label || node.entity_type || '').toUpperCase();
                          const isFlagged = node.flagged || node.is_fraud || node.risk_level === 'HIGH' || node.risk_level === 'CRITICAL';

                          // Color per entity type
                          let nodeColor = '#94A3B8';
                          if (entityType === 'PERSON' || entityType === 'APPLICANT') {
                            nodeColor = isFlagged ? '#EF4444' : '#2563EB';
                          } else if (entityType === 'ADDRESS' || entityType === 'AADHAAR') {
                            nodeColor = '#7C3AED';
                          } else if (entityType === 'ASSET' || entityType === 'PROPERTY') {
                            nodeColor = '#F59E0B';
                          } else if (entityType === 'COMPANY' || entityType === 'ORGANIZATION') {
                            nodeColor = '#059669';
                          }

                          // Fixed screen-size radius — compensate for zoom so node is always 22 px on screen
                          const radius = 22 / globalScale;

                          // Red glow for flagged
                          if (isFlagged) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, radius + 8 / globalScale, 0, 2 * Math.PI);
                            ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
                            ctx.fill();
                          }

                          // White node body
                          ctx.beginPath();
                          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
                          ctx.fillStyle = '#FFFFFF';
                          ctx.fill();

                          // Colored border
                          ctx.strokeStyle = nodeColor;
                          ctx.lineWidth = 3 / globalScale;
                          ctx.stroke();

                          // Icon inside
                          ctx.fillStyle = nodeColor;
                          ctx.strokeStyle = nodeColor;
                          ctx.lineWidth = 1.5 / globalScale;

                          if (entityType === 'PERSON' || entityType === 'APPLICANT') {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y - radius * 0.22, radius * 0.28, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.beginPath();
                            ctx.arc(node.x, node.y + radius * 0.6, radius * 0.48, Math.PI, 2 * Math.PI);
                            ctx.fill();
                          } else if (entityType === 'COMPANY' || entityType === 'ORGANIZATION') {
                            ctx.fillRect(node.x - radius * 0.38, node.y - radius * 0.48, radius * 0.76, radius * 0.96);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(node.x - radius * 0.24, node.y - radius * 0.34, radius * 0.14, radius * 0.14);
                            ctx.fillRect(node.x + radius * 0.10, node.y - radius * 0.34, radius * 0.14, radius * 0.14);
                            ctx.fillRect(node.x - radius * 0.24, node.y - radius * 0.06, radius * 0.14, radius * 0.14);
                            ctx.fillRect(node.x + radius * 0.10, node.y - radius * 0.06, radius * 0.14, radius * 0.14);
                            ctx.fillRect(node.x - radius * 0.24, node.y + radius * 0.22, radius * 0.14, radius * 0.14);
                            ctx.fillRect(node.x + radius * 0.10, node.y + radius * 0.22, radius * 0.14, radius * 0.14);
                          } else if (entityType === 'ASSET' || entityType === 'PROPERTY') {
                            ctx.beginPath();
                            ctx.moveTo(node.x - radius * 0.52, node.y + radius * 0.04);
                            ctx.lineTo(node.x, node.y - radius * 0.48);
                            ctx.lineTo(node.x + radius * 0.52, node.y + radius * 0.04);
                            ctx.closePath();
                            ctx.fill();
                            ctx.fillRect(node.x - radius * 0.38, node.y + radius * 0.04, radius * 0.76, radius * 0.44);
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(node.x - radius * 0.11, node.y + radius * 0.20, radius * 0.22, radius * 0.28);
                          } else if (entityType === 'ADDRESS' || entityType === 'AADHAAR') {
                            ctx.strokeStyle = nodeColor;
                            ctx.lineWidth = 1.5 / globalScale;
                            ctx.beginPath();
                            ctx.rect(node.x - radius * 0.52, node.y - radius * 0.38, radius * 1.04, radius * 0.76);
                            ctx.stroke();
                            ctx.fillStyle = nodeColor;
                            ctx.fillRect(node.x - radius * 0.40, node.y - radius * 0.22, radius * 0.28, radius * 0.38);
                            ctx.fillRect(node.x + radius * 0.00, node.y - radius * 0.18, radius * 0.38, radius * 0.07);
                            ctx.fillRect(node.x + radius * 0.00, node.y - radius * 0.03, radius * 0.38, radius * 0.07);
                            ctx.fillRect(node.x + radius * 0.00, node.y + radius * 0.12, radius * 0.28, radius * 0.07);
                          }

                          // Labels — always visible, fixed screen size
                          const displayName = name.length > 20 ? name.substring(0, 18) + '\u2026' : name;
                          const labelPx = 11; // constant screen pixels for label text
                          const statusPx = 9.5;

                          const isAboveNode = entityType === 'ADDRESS' || entityType === 'AADHAAR' || entityType === 'ASSET' || entityType === 'PROPERTY';
                          const gap = 5 / globalScale;
                          const statusGap = 14 / globalScale;

                          if (isAboveNode) {
                            ctx.font = `600 ${labelPx / globalScale}px Inter, system-ui, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = '#334155';
                            ctx.fillText(displayName, node.x, node.y - radius - gap);
                            ctx.font = `bold ${statusPx / globalScale}px Inter, system-ui, sans-serif`;
                            ctx.fillStyle = isFlagged ? '#EF4444' : '#10B981';
                            ctx.fillText(isFlagged ? 'fraudulent' : 'clean', node.x, node.y - radius - gap - statusGap);
                          } else {
                            ctx.font = `600 ${labelPx / globalScale}px Inter, system-ui, sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'top';
                            ctx.fillStyle = '#334155';
                            ctx.fillText(displayName, node.x, node.y + radius + gap);
                            ctx.font = `bold ${statusPx / globalScale}px Inter, system-ui, sans-serif`;
                            ctx.textBaseline = 'bottom';
                            ctx.fillStyle = isFlagged ? '#EF4444' : '#10B981';
                            ctx.fillText(isFlagged ? 'fraudulent' : 'clean', node.x, node.y - radius - gap);
                          }
                        }}
                        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
                          const radius = 22 / globalScale;
                          ctx.beginPath();
                          ctx.arc(node.x, node.y, radius + 4 / globalScale, 0, 2 * Math.PI);
                          ctx.fillStyle = color;
                          ctx.fill();
                        }}
                        linkColor={(link: any) => {
                          const srcFlagged = link.source?.flagged || link.source?.is_fraud || link.source?.risk_level === 'HIGH' || link.source?.risk_level === 'CRITICAL';
                          const tgtFlagged = link.target?.flagged || link.target?.is_fraud || link.target?.risk_level === 'HIGH' || link.target?.risk_level === 'CRITICAL';
                          if (srcFlagged || tgtFlagged) return '#EF4444';
                          return 'rgba(148, 163, 184, 0.55)';
                        }}
                        linkWidth={(link: any) => {
                          const srcFlagged = link.source?.flagged || link.source?.is_fraud || link.source?.risk_level === 'HIGH' || link.source?.risk_level === 'CRITICAL';
                          const tgtFlagged = link.target?.flagged || link.target?.is_fraud || link.target?.risk_level === 'HIGH' || link.target?.risk_level === 'CRITICAL';
                          return (srcFlagged || tgtFlagged) ? 2 : 1.2;
                        }}
                        linkLineDash={(link: any) => {
                          const srcFlagged = link.source?.flagged || link.source?.is_fraud || link.source?.risk_level === 'HIGH' || link.source?.risk_level === 'CRITICAL';
                          const tgtFlagged = link.target?.flagged || link.target?.is_fraud || link.target?.risk_level === 'HIGH' || link.target?.risk_level === 'CRITICAL';
                          if (srcFlagged || tgtFlagged) return [4, 4];
                          return [];
                        }}
                        linkDirectionalArrowLength={6}
                        linkDirectionalArrowRelPos={0.88}
                        linkDirectionalArrowColor={(link: any) => {
                          const srcFlagged = link.source?.flagged || link.source?.is_fraud || link.source?.risk_level === 'HIGH' || link.source?.risk_level === 'CRITICAL';
                          const tgtFlagged = link.target?.flagged || link.target?.is_fraud || link.target?.risk_level === 'HIGH' || link.target?.risk_level === 'CRITICAL';
                          if (srcFlagged || tgtFlagged) return '#EF4444';
                          return 'rgba(37,99,235,0.4)';
                        }}
                        linkCurvature={0.15}
                        linkCanvasObjectMode={() => 'after'}
                        linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                          const relType = link.label || '';
                          if (!relType) return;
                          const src = link.source;
                          const tgt = link.target;
                          if (!src || !tgt || typeof src.x !== 'number') return;
                          
                          const shouldDrawLinkLabel = globalScale > 1.1;
                          if (!shouldDrawLinkLabel) return;

                          const srcFlagged = src.flagged || src.is_fraud || src.risk_level === 'HIGH' || src.risk_level === 'CRITICAL';
                          const tgtFlagged = tgt.is_fraud || tgt.risk_level === 'HIGH' || tgt.risk_level === 'CRITICAL';
                          const isHighRisk = srcFlagged || tgtFlagged;

                          const midX = (src.x + tgt.x) / 2;
                          const midY = (src.y + tgt.y) / 2;
                          const edgeFontSize = Math.max(7.5 / globalScale, 2.5);
                          ctx.font = `600 ${edgeFontSize}px Inter, system-ui, sans-serif`;
                          const edgeText = relType.replace(/_/g, ' ').toLowerCase();
                          const edgeTextWidth = ctx.measureText(edgeText).width;
                          const ePadX = 4 / globalScale;
                          const ePadY = 2 / globalScale;

                          // Edge label background (canvas mask to avoid line-through)
                          ctx.fillStyle = isDarkMode ? '#080C1A' : '#FFFFFF';
                          ctx.fillRect(
                            midX - edgeTextWidth / 2 - ePadX,
                            midY - edgeFontSize / 2 - ePadY,
                            edgeTextWidth + ePadX * 2,
                            edgeFontSize + ePadY * 2
                          );

                          // Edge label text
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillStyle = isHighRisk ? '#EF4444' : (isDarkMode ? '#94A3B8' : '#64748B');
                          ctx.fillText(edgeText, midX, midY);
                        }}
                        backgroundColor="transparent"
                        enableNodeDrag={false}
                        onNodeClick={(node: any) => {
                          setSelectedNode(node);
                        }}
                      />
                    )}
                  </div>

                  <div className={`rounded-xl border p-5 flex flex-col justify-between overflow-y-auto ${isDarkMode ? 'bg-[#0D1428]/85 border-white/10 backdrop-blur-md' : 'bg-white border-slate-200'}`}>
                    <div>
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-widest block mb-4">Node Inspector</span>
                      
                      {selectedNode ? (
                        <div className="space-y-4">
                          {/* Selected node header */}
                          <div className={`p-4 rounded-xl border text-left ${
                            (selectedNode.label || '').toUpperCase() === 'PERSON' ? 'bg-blue-500/5 border-blue-500/20' : 
                            (selectedNode.label || '').toUpperCase() === 'ASSET' ? 'bg-emerald-500/5 border-emerald-500/20' : 
                            (selectedNode.label || '').toUpperCase() === 'ADDRESS' ? 'bg-amber-500/5 border-amber-500/20' : 
                            'bg-purple-500/5 border-purple-500/20'
                          }`}>
                            <span className={`text-[9px] uppercase tracking-wider font-extrabold block ${
                              (selectedNode.label || '').toUpperCase() === 'PERSON' ? 'text-blue-500' :
                              (selectedNode.label || '').toUpperCase() === 'ASSET' ? 'text-emerald-500' :
                              (selectedNode.label || '').toUpperCase() === 'ADDRESS' ? 'text-amber-500' :
                              'text-purple-500'
                            }`}>{selectedNode.label || 'NODE'}</span>
                            <span className="font-extrabold text-text text-sm mt-1 block">{selectedNode.name}</span>
                            <span className="text-[9px] text-text-muted mt-1 block font-mono">ID: {selectedNode.id}</span>
                          </div>

                          {/* Node properties */}
                          <div className="space-y-2">
                            <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">Properties</span>
                            {selectedNode.props ? (
                              Object.entries(selectedNode.props).filter(([k]) => k !== 'entity_id' && k !== 'updated_at').map(([k, v]: any) => (
                                <div key={k} className={`p-2.5 rounded-lg border text-left text-xs ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                  <span className="text-[9px] uppercase font-bold text-text-muted block">{k.replace(/_/g, ' ')}</span>
                                  <span className="font-semibold text-text mt-0.5 block break-words">{String(v) || '—'}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-text-muted text-left">No internal property indices.</div>
                            )}
                          </div>

                          {/* Connected edges info */}
                          {data && data.graph_data && (
                            <div className="space-y-2">
                              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest block">Connections</span>
                              {data.graph_data.edges
                                .filter((e: any) => e.src === selectedNode.id || e.tgt === selectedNode.id)
                                .slice(0, 8)
                                .map((e: any, idx: number) => {
                                  const isSource = e.src === selectedNode.id;
                                  const otherNodeId = isSource ? e.tgt : e.src;
                                  const otherNode = data.graph_data.nodes.find((n: any) => n.id === otherNodeId);
                                  return (
                                    <div key={idx} className={`p-2 rounded-lg border text-[10px] text-left flex items-center gap-2 ${isDarkMode ? 'bg-black/15 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                      <span className={`font-bold ${isSource ? 'text-primary' : 'text-secondary'}`}>{isSource ? '→' : '←'}</span>
                                      <span className="text-text-muted italic">{e.rel_type.replace(/_/g, ' ').toLowerCase()}</span>
                                      <span className="font-bold text-text truncate">{otherNode?.name || otherNodeId}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center text-text-muted gap-3">
                          <div className={`p-4 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                            <Search className="w-8 h-8 opacity-40" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block">No Node Selected</span>
                            <span className="text-[10px] mt-1 block">Click any node in the graph to inspect its properties and connections.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Audit hint footer */}
                    <div className={`text-[9px] text-text-muted mt-4 border-t pt-3 text-center ${isDarkMode ? 'border-white/5' : 'border-slate-200'}`}>
                      <span className="font-bold">Audit Hint:</span> Double-click nodes in the graph view to inspect related documents, employee records, and property surveys.
                    </div>
                  </div>
                </div>
              </MotionDiv>
            )}

             {/* Cypher Lab Tab */}
            {activeTab === "cypher" && user?.role === "ADMIN" && (
              <MotionDiv
                key="cypher"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 flex-1 flex flex-col min-h-0"
              >
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">Neo4j Cypher Lab Console</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Run complex Cypher traversals directly against the localized graph database.</p>
                </div>

                {/* Local Sandbox Mode Info Banner */}
                {!status.neo4j_connected && (
                  <div className="p-4 rounded-xl bg-info/10 border border-info/30 text-info flex items-center justify-between text-xs w-full">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 animate-pulse text-info" />
                      <div className="text-left">
                        <span className="font-black uppercase tracking-wider block">Local NetworkX Sandbox Active</span>
                        <span className="text-[11px] opacity-90 block mt-0.5">
                          Presets and custom Cypher queries are evaluated offline against the in-memory graph.
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDbModal(true)}
                      className="px-3 py-1.5 rounded-lg bg-info/20 hover:bg-info/30 border border-info/40 text-info font-bold text-[10px] uppercase tracking-wider transition-all"
                    >
                      Connect Neo4j
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0 overflow-hidden relative">
                  
                  {/* Presets and Editor */}
                  <div className="lg:col-span-1 glass-panel p-4 overflow-y-auto space-y-4 text-left">
                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-2">Preset Traversals</span>
                    <div className="space-y-2">
                      {presetQueries.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCypherQuery(q.cypher)}
                          className="w-full text-left p-3 rounded-lg bg-surface hover:bg-surface-hover border border-border/30 hover:border-border text-xs font-semibold text-slate-600 dark:text-slate-300 transition-all block truncate"
                        >
                          {q.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Console and Results Table */}
                  <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
                    
                    {/* Query box */}
                    <div className="glass-panel p-4 flex flex-col gap-3">
                      <textarea
                        value={cypherQuery}
                        onChange={(e) => setCypherQuery(e.target.value)}
                        placeholder="MATCH (n) RETURN n LIMIT 25..."
                        className="w-full h-32 bg-white/50 dark:bg-black/25 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-primary/40 leading-relaxed"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">
                          {status.neo4j_connected ? "Bolt Protocol Session Active" : "Local NetworkX Sandbox Active"}
                        </span>
                        <button
                          onClick={() => runCustomCypher()}
                          disabled={cypherLoading || !cypherQuery}
                          className="px-5 py-2 rounded-lg bg-primary text-[#0A0E27] font-bold text-xs flex items-center gap-1.5 transition-all hover:shadow-[0_0_12px_rgba(0,229,255,0.3)] disabled:opacity-50"
                        >
                          {cypherLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          Run Cypher Query
                        </button>
                      </div>
                    </div>

                    {/* Result Box */}
                    <div className="glass-panel p-4 flex-1 min-h-0 overflow-hidden flex flex-col">
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-3 text-left">Query Result Output</span>
                      
                      {cypherLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                          <span className="text-xs">Querying database...</span>
                        </div>
                      ) : cypherError ? (
                        <div className="flex-1 overflow-auto bg-danger/5 border border-danger/20 rounded-lg p-4 text-xs font-mono text-danger text-left">
                          {cypherError}
                        </div>
                      ) : cypherResults ? (
                        cypherResults.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                            Query executed successfully. Returned 0 records.
                          </div>
                        ) : (
                          <div className="flex-1 overflow-auto bg-slate-50 dark:bg-black/20 rounded-lg border border-slate-200 dark:border-white/5">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-200 dark:bg-white/5 border-b border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-400">
                                  {Object.keys(cypherResults[0]).map((key) => (
                                    <th key={key} className="p-3 font-semibold uppercase tracking-wider">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {cypherResults.map((row, idx) => (
                                  <tr key={idx} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
                                    {Object.entries(row).map(([k, val]: any) => (
                                      <td key={k} className="p-3 font-mono text-slate-800 dark:text-slate-300">
                                        {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                          Predefined or custom Cypher output will render here.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </MotionDiv>
            )}

            {/* Risk Analytics Tab */}
            {activeTab === "analytics" && (
              <MotionDiv
                key="analytics"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8 flex-1"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-text">Risk Analytics Dashboard</h2>
                    <p className="text-text-muted text-xs mt-1">Live anomaly distribution and historical risk trend visualizations.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Anomaly Distribution Chart */}
                  <div className="glass-card flex flex-col justify-between min-h-[380px]">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-text">Anomaly Traversal Distribution</h3>
                      <p className="text-xs text-text-muted mt-1">Classification and count of verified risk indicators resolved across the network.</p>
                    </div>
                    {renderAnomalyDistribution()}
                  </div>

                  {/* Risk Score Trend Chart */}
                  <div className="glass-card flex flex-col justify-between min-h-[380px]">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-text">Historical Risk Trend</h3>
                      <p className="text-xs text-text-muted mt-1">System risk mitigation assessment metrics tracked across recent audits.</p>
                    </div>
                    {renderRiskTrendGraph()}
                  </div>
                </div>

                {/* Summary Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card text-center">
                    <div className="text-3xl font-black text-primary">{data?.alerts?.length ?? 0}</div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Total Active Alerts</div>
                  </div>
                  <div className="glass-card text-center">
                    <div className="text-3xl font-black text-danger">
                      {data ? Math.round(data.risk_score * 100) : 0}%
                    </div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">System Threat Score</div>
                  </div>
                  <div className="glass-card text-center">
                    <div className="text-3xl font-black text-success">{data?.metrics?.entities ?? 0}</div>
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Resolved Entities</div>
                  </div>
                </div>
              </MotionDiv>
            )}

          </AnimatePresence>

        </main>
      </div>

      {/* Database settings panel modal dialog */}
      <AnimatePresence>
        {showDbModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDbModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <MotionDiv
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background border border-border p-6 rounded-2xl w-full max-w-md z-10 shadow-[0_0_50px_var(--shadow-color)] text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-5">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  DBMS Settings Configuration
                </h3>
                <button 
                  onClick={() => setShowDbModal(false)}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={connectDatabase} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bolt URL Connection</label>
                  <input 
                    type="text" 
                    value={dbConfig.uri}
                    onChange={(e) => setDbConfig({ ...dbConfig, uri: e.target.value })}
                    placeholder="bolt://localhost:7687"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-primary/40"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Authentication User</label>
                  <input 
                    type="text" 
                    value={dbConfig.username}
                    onChange={(e) => setDbConfig({ ...dbConfig, username: e.target.value })}
                    placeholder="neo4j"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-primary/40"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Authentication Password</label>
                  <input 
                    type="password" 
                    value={dbConfig.password}
                    onChange={(e) => setDbConfig({ ...dbConfig, password: e.target.value })}
                    placeholder="password"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3.5 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-primary/40"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={dbConnecting}
                  className="w-full bg-primary text-[#0A0E27] font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider hover:shadow-[0_0_12px_rgba(0,229,255,0.3)] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {dbConnecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Server className="w-4 h-4" />}
                  Verify & Establish Connection
                </button>
              </form>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      {/* Floating pipeline execution stepper & logs overlay */}
      <AnimatePresence>
        {showPipelineOverlay && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-hidden">
            {/* Pulsing Sonar / Radar Rings Background */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
              <div className="absolute w-[200px] h-[200px] border-2 border-primary/40 rounded-full animate-sonar" />
              <div className="absolute w-[200px] h-[200px] border-2 border-primary/30 rounded-full animate-sonar animation-delay-1000" />
              <div className="absolute w-[200px] h-[200px] border-2 border-primary/20 rounded-full animate-sonar animation-delay-2000" />
              <div className="absolute w-[200px] h-[200px] border-2 border-primary/10 rounded-full animate-sonar animation-delay-3000" />
            </div>

            <MotionDiv
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-background/90 border border-border p-6 rounded-2xl w-full max-w-2xl shadow-[0_0_80px_var(--shadow-color)] text-left flex flex-col h-[500px] relative z-10 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3 mb-6 flex-shrink-0">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary fill-primary" />
                  NexusGuard AI Pipeline Execution
                </h3>
              </div>

              {/* Progress Stepper */}
              <div className="grid grid-cols-4 gap-4 mb-6 flex-shrink-0">
                <StepperStep 
                  number="01" 
                  label="Document Ingestion" 
                  active={pipelineStep >= 1} 
                  completed={pipelineStep > 1} 
                />
                <StepperStep 
                  number="02" 
                  label="NLP Entity Extraction" 
                  active={pipelineStep >= 2} 
                  completed={pipelineStep > 2} 
                />
                <StepperStep 
                  number="03" 
                  label="Entity Resolution" 
                  active={pipelineStep >= 3} 
                  completed={pipelineStep > 3} 
                />
                <StepperStep 
                  number="04" 
                  label="Graph Traversals" 
                  active={pipelineStep >= 4} 
                  completed={pipelineStep > 4} 
                />
              </div>

              {/* Real-time console logs */}
              <div className="flex-1 bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/10 rounded-xl p-4 overflow-y-auto font-mono text-[10px] text-slate-700 dark:text-slate-400 space-y-1.5 flex flex-col min-h-0 justify-end">
                <div className="flex-1 overflow-y-auto flex flex-col justify-start">
                  {pipelineLogs.map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`text-left leading-relaxed ${
                        log.startsWith("[ERROR]") ? "text-danger" : 
                        log.startsWith("[WARN]") ? "text-warning" : 
                        log.startsWith("[INFO]") ? "text-primary" : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>
      {/* Toast notification overlay */}
      <AnimatePresence>
        {toast && (
          <MotionDiv
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-55 max-w-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-white/10 dark:border-slate-200 p-4 rounded-xl shadow-2xl flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500">
              <Shield className="w-5 h-5" />
            </div>
            <div className="text-left flex-1">
              <div className="text-[10px] font-black uppercase tracking-wider text-primary">System Broadcast</div>
              <div className="text-[11px] opacity-90 mt-0.5 font-medium leading-relaxed">{toast.message}</div>
            </div>
            <button onClick={() => setToast(null)} className="p-1 rounded hover:bg-white/10 dark:hover:bg-slate-100 text-slate-400 cursor-pointer flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sidebar Link Component
function SidebarLink({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-3.5 transition-all text-left ${
        active 
          ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_16px_rgba(0,82,204,0.06)]" 
          : "text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
      }`}
    >
      <div className={`${active ? "text-primary scale-110" : "text-slate-400"} transition-transform`}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

// Metric Card Component
function MetricCard({ icon, value, label, danger = false }: { icon: React.ReactNode, value: number, label: string, danger?: boolean }) {
  return (
    <div className={`glass-card flex flex-col items-center justify-center text-center group ${danger ? 'border-danger/30 bg-danger/5 shadow-[0_0_24px_rgba(255,71,87,0.08)]' : ''}`}>
      <div className={`mb-3 p-3.5 rounded-xl bg-black/5 dark:bg-black/25 ${danger ? 'bg-danger/10 text-danger' : 'text-primary'} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <div className={`text-4xl font-black mb-1 ${danger ? 'text-danger' : 'text-primary'}`}>{value}</div>
      <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{label}</div>
    </div>
  );
}

// Stepper Step Component
function StepperStep({ number, label, active, completed }: { number: string, label: string, active: boolean, completed: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
          completed 
            ? "bg-success border-success text-[#0A0E27]" 
            : active 
              ? "bg-primary border-primary text-[#0A0E27] shadow-[0_0_10px_rgba(0,229,255,0.4)]" 
              : "border-white/10 text-slate-500"
        }`}>
          {completed ? "✓" : number}
        </div>
        <div className={`flex-1 h-0.5 rounded ${completed ? "bg-success" : active ? "bg-primary animate-pulse" : "bg-white/10"}`} />
      </div>
      <span className={`text-[10px] font-bold uppercase tracking-wider block ${active || completed ? "text-slate-200" : "text-slate-500"}`}>
        {label}
      </span>
    </div>
  );
}
