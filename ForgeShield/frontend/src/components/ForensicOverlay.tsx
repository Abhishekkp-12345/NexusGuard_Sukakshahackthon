import { useState } from "react";
import { Eye, Layers, ShieldAlert, ZoomIn } from "lucide-react";
import type { DocumentReport } from "../api/client";

interface Props {
  docReport: DocumentReport;
}

export default function ForensicOverlay({ docReport }: Props) {
  const [viewMode, setViewMode] = useState<"annotated" | "heatmap" | "split">("annotated");
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number | null>(null);

  const tamperResult = docReport.tamper_result;
  const elaResult = docReport.ela_result;
  const regions = tamperResult?.region_annotations || [];
  const detectors = tamperResult?.detector_results || {};

  const isTampered = tamperResult?.tampered || (docReport.authenticity_score < 75);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* View Mode Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setViewMode("annotated")}
            style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: viewMode === "annotated" ? "var(--indigo)" : "rgba(255,255,255,0.04)",
              color: viewMode === "annotated" ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border-subtle)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
            }}
          >
            <Eye size={14} /> Bounding Boxes & Labels
          </button>

          {elaResult?.heatmap_b64 && (
            <button
              onClick={() => setViewMode("heatmap")}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: viewMode === "heatmap" ? "var(--indigo)" : "rgba(255,255,255,0.04)",
                color: viewMode === "heatmap" ? "white" : "var(--text-secondary)",
                border: "1px solid var(--border-subtle)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <Layers size={14} /> ELA Heatmap Overlay
            </button>
          )}

          {elaResult?.heatmap_b64 && (
            <button
              onClick={() => setViewMode("split")}
              style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: viewMode === "split" ? "var(--indigo)" : "rgba(255,255,255,0.04)",
                color: viewMode === "split" ? "white" : "var(--text-secondary)",
                border: "1px solid var(--border-subtle)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6
              }}
            >
              <ZoomIn size={14} /> Dual Side-by-Side
            </button>
          )}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: isTampered ? "var(--reject)" : "var(--approve)" }}>
          {isTampered ? `⚠️ ${regions.length} Tampered Region(s) Flagged` : "✓ Clean Forensic Signature"}
        </div>
      </div>

      {/* Main Image Display Box */}
      <div style={{ display: "grid", gridTemplateColumns: viewMode === "split" ? "1fr 1fr" : "1fr", gap: 16 }}>
        {/* Annotated Bounding Boxes View */}
        {(viewMode === "annotated" || viewMode === "split") && (
          <div style={{
            position: "relative", background: "#0D1117", borderRadius: 8, overflow: "hidden",
            border: "1px solid var(--border-subtle)", padding: 12, textAlign: "center"
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
              FORENSIC REGION LOCALIZATION
            </div>
            {tamperResult?.tamper_visualization ? (
              <img
                src={`data:image/png;base64,${tamperResult.tamper_visualization}`}
                alt="Tamper Bounding Boxes"
                style={{ maxWidth: "100%", height: "auto", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}
              />
            ) : (
              <div style={{ padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
                No regional visual alterations detected.
              </div>
            )}
          </div>
        )}

        {/* ELA Heatmap View */}
        {(viewMode === "heatmap" || viewMode === "split") && elaResult?.heatmap_b64 && (
          <div style={{
            position: "relative", background: "#0D1117", borderRadius: 8, overflow: "hidden",
            border: "1px solid var(--border-subtle)", padding: 12, textAlign: "center"
          }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
              ERROR LEVEL ANALYSIS (ELA) HEATMAP
            </div>
            <img
              src={`data:image/png;base64,${elaResult.heatmap_b64}`}
              alt="ELA Heatmap"
              style={{ maxWidth: "100%", height: "auto", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>
        )}
      </div>

      {/* Detected Regions & Labels List */}
      {regions.length > 0 && (
        <div style={{
          background: "rgba(239, 68, 68, 0.04)", border: "1px solid rgba(239, 68, 68, 0.2)",
          borderRadius: 8, padding: 14
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--reject)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={16} /> Suspected Edited Regions ({regions.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {regions.map((reg, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedRegionIndex(selectedRegionIndex === idx ? null : idx)}
                style={{
                  background: selectedRegionIndex === idx ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${selectedRegionIndex === idx ? "var(--reject)" : "var(--border-subtle)"}`,
                  borderRadius: 6, padding: 10, cursor: "pointer", transition: "all 0.15s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text-primary)" }}>
                    #{idx + 1} {reg.label}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: "rgba(239,68,68,0.2)", color: "var(--reject)" }}>
                    {(reg.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Method: <span style={{ color: "var(--indigo)", fontWeight: 600 }}>{reg.method}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                  Pos: ({reg.x}, {reg.y}) · Size: {reg.w}×{reg.h}px
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forensic Detectors Breakdown Grid */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          Multi-Detector Forensic Results
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
          {Object.entries(detectors).map(([key, det]: [string, any]) => (
            <div
              key={key}
              style={{
                padding: "8px 12px", borderRadius: 6,
                background: det?.triggered ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.04)",
                border: `1px solid ${det?.triggered ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.2)"}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span style={{ textTransform: "uppercase" }}>{key.replace("_", " ")}</span>
                <span style={{ color: det?.triggered ? "var(--reject)" : "var(--approve)" }}>
                  {det?.triggered ? "FLAGGED" : "CLEAN"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.3 }}>
                {det?.evidence || "No anomaly detected."}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
