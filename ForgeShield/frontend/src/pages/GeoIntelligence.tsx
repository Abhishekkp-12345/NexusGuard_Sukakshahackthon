import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, AlertTriangle, TrendingUp, Shield, RefreshCw, Info } from "lucide-react";
import { intelligenceApi, type GeoStateData } from "../api/client";

// ── India State SVG Paths (simplified, key states) ────────────────────
// Using approximate centroid coordinates for bubble-map style display
const INDIA_STATES: { name: string; cx: number; cy: number; r: number }[] = [
  { name: "Jammu & Kashmir", cx: 195, cy: 65, r: 18 },
  { name: "Himachal Pradesh", cx: 210, cy: 100, r: 13 },
  { name: "Punjab", cx: 185, cy: 118, r: 14 },
  { name: "Uttarakhand", cx: 240, cy: 115, r: 13 },
  { name: "Haryana", cx: 200, cy: 140, r: 14 },
  { name: "Delhi", cx: 210, cy: 155, r: 10 },
  { name: "Rajasthan", cx: 175, cy: 195, r: 26 },
  { name: "Uttar Pradesh", cx: 265, cy: 175, r: 26 },
  { name: "Bihar", cx: 325, cy: 185, r: 18 },
  { name: "West Bengal", cx: 365, cy: 220, r: 18 },
  { name: "Assam", cx: 415, cy: 170, r: 16 },
  { name: "Gujarat", cx: 145, cy: 245, r: 22 },
  { name: "Madhya Pradesh", cx: 235, cy: 240, r: 26 },
  { name: "Chhattisgarh", cx: 300, cy: 255, r: 18 },
  { name: "Jharkhand", cx: 345, cy: 225, r: 16 },
  { name: "Odisha", cx: 355, cy: 270, r: 18 },
  { name: "Maharashtra", cx: 195, cy: 295, r: 26 },
  { name: "Telangana", cx: 265, cy: 315, r: 18 },
  { name: "Andhra Pradesh", cx: 290, cy: 360, r: 18 },
  { name: "Karnataka", cx: 225, cy: 365, r: 22 },
  { name: "Goa", cx: 185, cy: 350, r: 9 },
  { name: "Kerala", cx: 215, cy: 420, r: 14 },
  { name: "Tamil Nadu", cx: 260, cy: 415, r: 18 },
];

function getRiskColor(riskScore: number, alpha = 1): string {
  if (riskScore >= 60) return `rgba(239, 68, 68, ${alpha})`;   // red
  if (riskScore >= 30) return `rgba(245, 158, 11, ${alpha})`;  // amber
  return `rgba(16, 185, 129, ${alpha})`;                        // green
}

function getRiskGradient(riskScore: number): string {
  if (riskScore >= 60) return "linear-gradient(135deg, #ef4444, #dc2626)";
  if (riskScore >= 30) return "linear-gradient(135deg, #f59e0b, #d97706)";
  return "linear-gradient(135deg, #10b981, #059669)";
}

export default function GeoIntelligence() {
  const [states, setStates] = useState<GeoStateData[]>([]);
  const [selected, setSelected] = useState<GeoStateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [nationalRate, setNationalRate] = useState(0);
  const [totalRisk, setTotalRisk] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const data = await intelligenceApi.geoHeatmap();
      setStates(data.states);
      setNationalRate(data.national_fraud_rate);
      setTotalRisk(data.total_loan_at_risk);
    } catch (e) {
      console.error("Geo heatmap load failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const stateMap = new Map(states.map(s => [s.state, s]));

  const formatCr = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 className="page-title">
            Geo <span className="gradient-text">Intelligence</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: 6 }}>
            India-wide fraud density map — drill down by state to see case distribution and risk patterns
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* National KPI strip */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {[
            { label: "States Tracked", value: states.length, icon: MapPin, color: "var(--indigo)" },
            { label: "National Fraud Rate", value: `${nationalRate}%`, icon: TrendingUp, color: "var(--hold)" },
            { label: "Total Loan at Risk", value: formatCr(totalRisk), icon: AlertTriangle, color: "var(--reject)" },
            { label: "High-Risk States", value: states.filter(s => s.risk_level === "HIGH").length, icon: Shield, color: "#ef4444" },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div
              key={label}
              className="card"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", top: 0, right: 0, width: 70, height: 70, background: `radial-gradient(circle at top right, ${color}22, transparent)` }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginTop: 4 }}>{value}</div>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} color={color} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
        {/* Map area */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>India Fraud Density Map</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Bubble size = case count · Color = risk level · Click to explore</div>
          </div>

          {loading ? (
            <div style={{ padding: 80, textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              <div style={{ color: "var(--text-muted)" }}>Building geo intelligence layer…</div>
            </div>
          ) : (
            <div style={{ position: "relative", padding: 20 }}>
              <svg
                viewBox="0 0 480 480"
                style={{ width: "100%", height: "auto", maxHeight: 520 }}
              >
                {/* India outline (simplified bounding box with decorative grid) */}
                <defs>
                  <pattern id="geo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(99,102,241,0.06)" strokeWidth="0.5" />
                  </pattern>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <rect width="480" height="480" fill="url(#geo-grid)" />

                {/* State bubbles */}
                {INDIA_STATES.map((state) => {
                  const data = stateMap.get(state.name);
                  const risk = data?.risk_score ?? 0;
                  const cases = data?.total_cases ?? 0;
                  const isSelected = selected?.state === state.name;
                  const bubbleR = data ? Math.max(state.r, state.r + Math.log(cases + 1) * 3) : state.r * 0.5;

                  return (
                    <g
                      key={state.name}
                      onClick={() => data && setSelected(selected?.state === state.name ? null : data)}
                      style={{ cursor: data ? "pointer" : "default" }}
                    >
                      {/* Pulse ring for high risk */}
                      {data && risk >= 60 && (
                        <circle
                          cx={state.cx}
                          cy={state.cy}
                          r={bubbleR + 6}
                          fill="none"
                          stroke="rgba(239,68,68,0.3)"
                          strokeWidth="2"
                        />
                      )}
                      {/* Main bubble */}
                      <circle
                        cx={state.cx}
                        cy={state.cy}
                        r={isSelected ? bubbleR + 4 : bubbleR}
                        fill={data ? getRiskColor(risk, 0.75) : "rgba(99,102,241,0.1)"}
                        stroke={isSelected ? "white" : getRiskColor(risk, 0.4)}
                        strokeWidth={isSelected ? 2.5 : 1}
                        filter={isSelected || risk >= 60 ? "url(#glow)" : undefined}
                        style={{ transition: "all 0.25s ease" }}
                      />
                      {/* State label */}
                      {(cases > 0 || state.r >= 18) && (
                        <text
                          x={state.cx}
                          y={state.cy + (bubbleR + 14)}
                          textAnchor="middle"
                          fill={data ? "var(--text-secondary)" : "var(--text-muted)"}
                          fontSize={data ? 9 : 8}
                          fontWeight={isSelected ? 700 : 400}
                          fontFamily="Inter, sans-serif"
                        >
                          {state.name.split(" ")[0]}
                        </text>
                      )}
                      {/* Case count */}
                      {data && cases > 0 && (
                        <text
                          x={state.cx}
                          y={state.cy + 3.5}
                          textAnchor="middle"
                          fill="white"
                          fontSize={9}
                          fontWeight={700}
                          fontFamily="Inter, sans-serif"
                        >
                          {cases}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Legend */}
              <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8 }}>
                {[
                  { color: "rgba(239,68,68,0.75)", label: "High Risk (≥60)" },
                  { color: "rgba(245,158,11,0.75)", label: "Medium (30–59)" },
                  { color: "rgba(16,185,129,0.75)", label: "Low Risk (<30)" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* State detail */}
          {selected ? (
            <motion.div className="card" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: getRiskColor(selected.risk_score) }} />
                <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.state}</div>
                <div style={{
                  marginLeft: "auto", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: getRiskColor(selected.risk_score, 0.15),
                  color: getRiskColor(selected.risk_score),
                  border: `1px solid ${getRiskColor(selected.risk_score, 0.3)}`,
                }}>
                  {selected.risk_level} RISK
                </div>
              </div>

              {/* Risk meter */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  <span>Risk Score</span><span style={{ fontWeight: 700, color: getRiskColor(selected.risk_score) }}>{selected.risk_score}/100</span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${selected.risk_score}%`, background: getRiskGradient(selected.risk_score) }} />
                </div>
              </div>

              {/* Stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Total Cases", value: selected.total_cases },
                  { label: "Fraud Rate", value: `${selected.fraud_rate_pct}%` },
                  { label: "Approved", value: selected.approved },
                  { label: "Flagged", value: selected.hold + selected.rejected },
                  { label: "High Severity", value: selected.high_severity_findings },
                  { label: "Loan at Risk", value: formatCr(selected.loan_at_risk) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--bg-surface)", borderRadius: 8, padding: "8px 10px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Top fraud types */}
              {selected.top_fraud_types.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Top Fraud Signals
                  </div>
                  {selected.top_fraud_types.map((ft: { type: string; count: number }, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{ft.type.replace(/_/g, " ")}</span>
                      <span style={{ fontWeight: 700, color: "var(--reject)" }}>{ft.count}×</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Info size={16} color="var(--indigo-light)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Map Guide</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Bubble <strong>size</strong> = number of cases from that state.<br /><br />
                Bubble <strong>color</strong> = fraud risk level based on verdicts and findings.<br /><br />
                Pulsing red rings = high-risk states requiring immediate attention.<br /><br />
                Click any bubble to see detailed statistics.
              </div>
            </div>
          )}

          {/* Ranked table */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
              🏆 Risk Ranking
            </div>
            {loading ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
            ) : states.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                No analyzed cases yet. Create and analyze cases to populate this ranking.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {states.slice(0, 8).map((s, i) => (
                  <div
                    key={s.state}
                    onClick={() => setSelected(selected?.state === s.state ? null : s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                      borderRadius: 8, cursor: "pointer", transition: "background 0.15s",
                      background: selected?.state === s.state ? "rgba(99,102,241,0.1)" : "var(--bg-surface)",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", width: 20, textAlign: "center" }}>
                      #{i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.state}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.total_cases} case{s.total_cases !== 1 ? "s" : ""} · {s.fraud_rate_pct}% fraud</div>
                    </div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: getRiskColor(s.risk_score), flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
