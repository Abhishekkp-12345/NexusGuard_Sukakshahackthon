import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Info, AlertTriangle, Users, Link2 } from "lucide-react";
import { casesApi, intelligenceApi, type FraudRing } from "../api/client";

interface GraphNode { id: string; label: string; type: string; color: string; x?: number; y?: number; }
interface GraphLink { source: string; target: string; label: string; }

export default function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [fraudRings, setFraudRings] = useState<FraudRing[]>([]);
  const [ringsLoading, setRingsLoading] = useState(true);
  const [expandedRing, setExpandedRing] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await casesApi.list();

        // Aggregate all graph data from all analyzed cases
        const allNodes: Map<string, GraphNode> = new Map();
        const allLinks: GraphLink[] = [];

        c.forEach(caseItem => {
          if (caseItem.analysis?.graph_data) {
            caseItem.analysis.graph_data.nodes.forEach((n: any) => {
              if (!allNodes.has(n.id)) {
                allNodes.set(n.id, { ...n });
              }
            });
            allLinks.push(...caseItem.analysis.graph_data.links);
          }
        });

        // If no graph data yet, show demo graph
        if (allNodes.size === 0) {
          const demoNodes: GraphNode[] = [
            { id: "A:ABCDE1234F", label: "Rajesh Kumar", type: "applicant", color: "#3B82F6" },
            { id: "E:GREENTECH", label: "Greentech Solutions", type: "employer", color: "#10B981" },
            { id: "S:142/3A", label: "Survey 142/3A\nWhitefield", type: "asset", color: "#F59E0B" },
            { id: "A:FGHIJ5678K", label: "Suresh Rao\n(Guarantor)", type: "applicant", color: "#3B82F6" },
            { id: "A:LMNOP9012Q", label: "Priya Sharma", type: "applicant", color: "#3B82F6" },
            { id: "E:TECHCORP", label: "TechCorp India", type: "employer", color: "#10B981" },
            { id: "S:OLD/PLEDGED", label: "Survey 88/2B\n⚠️ Double Pledged", type: "asset", color: "#EF4444" },
          ];
          const demoLinks: GraphLink[] = [
            { source: "A:ABCDE1234F", target: "E:GREENTECH", label: "EMPLOYED_BY" },
            { source: "A:ABCDE1234F", target: "S:142/3A", label: "PLEDGES" },
            { source: "A:ABCDE1234F", target: "A:FGHIJ5678K", label: "GUARANTEED_BY" },
            { source: "A:LMNOP9012Q", target: "E:TECHCORP", label: "EMPLOYED_BY" },
            { source: "A:LMNOP9012Q", target: "S:OLD/PLEDGED", label: "PLEDGES" },
            { source: "A:FGHIJ5678K", target: "S:OLD/PLEDGED", label: "PLEDGES" },
          ];
          demoNodes.forEach(n => allNodes.set(n.id, n));
          allLinks.push(...demoLinks);
        }

        const nodeArr = Array.from(allNodes.values());
        // Layout nodes in a circle
        const centerX = 400, centerY = 300, radius = 220;
        nodeArr.forEach((n, i) => {
          const angle = (i / nodeArr.length) * 2 * Math.PI;
          n.x = centerX + radius * Math.cos(angle);
          n.y = centerY + radius * Math.sin(angle);
        });

        setNodes(nodeArr);
        setLinks(allLinks);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load fraud rings
  useEffect(() => {
    intelligenceApi.fraudRings()
      .then((data: any) => setFraudRings(data.fraud_rings))
      .catch(console.error)
      .finally(() => setRingsLoading(false));
  }, []);

  // Simple canvas renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw links
    links.forEach(link => {
      const src = nodeMap.get(typeof link.source === "string" ? link.source : (link.source as any).id);
      const tgt = nodeMap.get(typeof link.target === "string" ? link.target : (link.target as any).id);
      if (!src || !tgt || !src.x || !src.y || !tgt.x || !tgt.y) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = link.label === "PLEDGES" && link.label === "PLEDGES" ? "rgba(239,68,68,0.4)" : "rgba(99,102,241,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Link label
      const mx = (src.x + tgt.x) / 2;
      const my = (src.y + tgt.y) / 2;
      ctx.fillStyle = "rgba(148,163,184,0.6)";
      ctx.font = "10px Inter";
      ctx.textAlign = "center";
      ctx.fillText(link.label, mx, my - 4);
    });

    // Draw nodes
    nodes.forEach(node => {
      if (!node.x || !node.y) return;
      const isSelected = selectedNode?.id === node.id;

      // Glow
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 22, 0, 2 * Math.PI);
        ctx.fillStyle = node.color + "44";
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, 14, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? "white" : node.color + "88";
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.stroke();

      // Node label
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `${isSelected ? "bold " : ""}11px Inter`;
      ctx.textAlign = "center";
      const lines = node.label.split("\n");
      lines.forEach((line, li) => {
        ctx.fillText(line, node.x!, node.y! + 26 + li * 13);
      });
    });
  }, [nodes, links, selectedNode]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    // Scale client click coordinates to internal canvas 800x600 dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    for (const node of nodes) {
      if (!node.x || !node.y) continue;
      const dist = Math.hypot(x - node.x, y - node.y);
      if (dist < 16) {
        setSelectedNode(selectedNode?.id === node.id ? null : node);
        return;
      }
    }
    setSelectedNode(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 className="page-title">
          Relationship <span className="gradient-text">Intelligence</span>
        </h1>
        <p style={{ color: "var(--text-secondary)", marginTop: 6 }}>
          Entity graph — applicants, employers, assets, and guarantor relationships
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {[
          { color: "#3B82F6", label: "Applicant" },
          { color: "#10B981", label: "Employer" },
          { color: "#F59E0B", label: "Asset (Collateral)" },
          { color: "#EF4444", label: "Conflict / Risk" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="grid-3" style={{ gridTemplateColumns: "1fr 320px" }}>
        {/* Canvas */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              <div style={{ color: "var(--text-muted)" }}>Building relationship graph…</div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              style={{ width: "100%", height: "auto", display: "block", cursor: "pointer" }}
              onClick={handleCanvasClick}
            />
          )}
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {selectedNode ? (
            <motion.div className="card" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: selectedNode.color }} />
                <div style={{ fontWeight: 700 }}>{selectedNode.label.replace(/\n/g, " ")}</div>
              </div>
              <div className={`verdict-badge ${selectedNode.type}`} style={{ marginBottom: 12 }}>
                {selectedNode.type.toUpperCase()}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                <div>Node ID: <span className="text-mono">{selectedNode.id}</span></div>
              </div>

              {/* Related links */}
              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: "var(--text-secondary)" }}>
                  RELATIONSHIPS
                </div>
                {links.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).map((l, i) => (
                  <div key={i} style={{
                    fontSize: 12, padding: "6px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                  }}>
                    → <span className="text-mono">{l.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Info size={16} color="var(--indigo-light)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Graph Guide</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Click any node to see its entity details and relationships.
                <br /><br />
                Red nodes indicate conflicts (double pledging, shell companies).
                Circular relationships may indicate coordinated fraud.
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Graph Stats</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Entities", value: nodes.length },
                { label: "Relationships", value: links.length },
                { label: "Applicants", value: nodes.filter(n => n.type === "applicant").length },
                { label: "Assets", value: nodes.filter(n => n.type === "asset").length },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center", padding: "10px 0", background: "var(--bg-surface)", borderRadius: 8 }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Fraud Rings Panel */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertTriangle size={15} color="var(--reject)" />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Fraud Ring Detection</span>
              {!ringsLoading && fraudRings.length > 0 && (
                <span style={{
                  marginLeft: "auto", padding: "2px 8px", borderRadius: 20,
                  background: "rgba(239,68,68,0.15)", color: "var(--reject)",
                  fontSize: 11, fontWeight: 700,
                }}>
                  {fraudRings.length} RING{fraudRings.length > 1 ? "S" : ""}
                </span>
              )}
            </div>
            <div style={{ padding: "10px 16px 14px" }}>
              {ringsLoading ? (
                <div style={{ color: "var(--text-muted)", fontSize: 12, padding: "8px 0" }}>Scanning for fraud rings…</div>
              ) : fraudRings.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0", lineHeight: 1.6 }}>
                  No cross-case fraud rings detected. Analyze more cases to enable network-level detection.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fraudRings.slice(0, 5).map((ring) => (
                    <div
                      key={ring.ring_id}
                      onClick={() => setExpandedRing(expandedRing === ring.ring_id ? null : ring.ring_id)}
                      style={{
                        borderRadius: 8, cursor: "pointer", overflow: "hidden",
                        border: `1px solid ${ring.severity === "HIGH" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                        background: ring.severity === "HIGH" ? "rgba(239,68,68,0.05)" : "rgba(245,158,11,0.05)",
                      }}
                    >
                      <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                        {ring.ring_type === "SHARED_EMPLOYER" ? <Users size={12} color={ring.severity === "HIGH" ? "var(--reject)" : "var(--hold)"} /> :
                          ring.ring_type === "LOAN_STACKING" ? <Link2 size={12} color="var(--reject)" /> :
                          <AlertTriangle size={12} color="var(--hold)" />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {ring.ring_type_label}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {ring.case_count} cases · {ring.shared_entity.slice(0, 22)}
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10,
                          background: ring.severity === "HIGH" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                          color: ring.severity === "HIGH" ? "var(--reject)" : "var(--hold)",
                        }}>{ring.severity}</span>
                      </div>
                      {expandedRing === ring.ring_id && (
                        <div style={{ padding: "0 10px 10px", borderTop: "1px solid var(--border-subtle)" }}>
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, margin: "8px 0" }}>
                            {ring.description}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 4 }}>LINKED CASES</div>
                          {ring.cases.slice(0, 3).map((c: any) => (
                            <div key={c.case_id} style={{ fontSize: 11, display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                              <span className="text-mono" style={{ color: "var(--text-primary)" }}>{c.case_id}</span>
                              <span style={{ color: "var(--text-muted)" }}>{c.applicant_name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
