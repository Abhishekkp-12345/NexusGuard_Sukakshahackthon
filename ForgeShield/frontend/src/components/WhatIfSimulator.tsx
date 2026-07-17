import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Sliders } from "lucide-react";

interface Props {
  initialAmount: number;
}

export default function WhatIfSimulator({ initialAmount }: Props) {
  // Inputs
  const [loanAmount, setLoanAmount] = useState(initialAmount > 0 ? initialAmount / 100000 : 150); // Lakhs
  const [dscr, setDscr] = useState(1.4);
  const [leverage, setLeverage] = useState(1.8);
  const [collateral, setCollateral] = useState(200); // Lakhs

  // Outputs
  const [pd, setPd] = useState(18);
  const [riskLevel, setRiskLevel] = useState("LOW");

  // Re-calculate PD using a realistic model formula
  useEffect(() => {
    // DSCR: higher is safer (reduces PD)
    // Leverage: higher is riskier (increases PD)
    // Loan-to-Collateral: higher is riskier (increases PD)
    const ltv = collateral > 0 ? (loanAmount / collateral) * 100 : 200;
    
    // Base PD calculation
    let computedPd = 15;
    
    // DSCR adjustment
    if (dscr < 1.0) computedPd += 35;
    else if (dscr < 1.25) computedPd += 20;
    else if (dscr < 1.5) computedPd += 5;
    else computedPd -= 8;

    // Leverage adjustment
    if (leverage > 4.0) computedPd += 25;
    else if (leverage > 2.5) computedPd += 12;
    else if (leverage < 1.2) computedPd -= 5;

    // LTV adjustment
    if (ltv > 100) computedPd += 30;
    else if (ltv > 80) computedPd += 15;
    else if (ltv < 50) computedPd -= 8;

    // Loan amount size penalty
    if (loanAmount > 500) computedPd += 10;

    // Clamp between 2% and 99%
    const finalPd = Math.max(2, Math.min(99, Math.round(computedPd)));
    setPd(finalPd);

    // Risk categorization
    if (finalPd < 15) setRiskLevel("VERY LOW");
    else if (finalPd < 30) setRiskLevel("LOW");
    else if (finalPd < 50) setRiskLevel("MODERATE");
    else if (finalPd < 70) setRiskLevel("HIGH");
    else setRiskLevel("CRITICAL");
  }, [loanAmount, dscr, leverage, collateral]);

  // Generate chart coordinates to visualize sensitivity of PD to loan amount changes
  const chartData = Array.from({ length: 9 }).map((_, idx) => {
    const testAmt = 50 + idx * 50; // 50 to 450 Lakhs
    const testLtv = collateral > 0 ? (testAmt / collateral) * 100 : 200;
    
    let testPd = 15;
    if (dscr < 1.0) testPd += 35;
    else if (dscr < 1.25) testPd += 20;
    else if (dscr < 1.5) testPd += 5;
    else testPd -= 8;

    if (leverage > 4.0) testPd += 25;
    else if (leverage > 2.5) testPd += 12;

    if (testLtv > 100) testPd += 30;
    else if (testLtv > 80) testPd += 15;
    else if (testLtv < 50) testPd -= 8;

    if (testAmt > 500) testPd += 10;

    return {
      loanAmt: `₹${testAmt}L`,
      defaultProb: Math.max(2, Math.min(99, Math.round(testPd)))
    };
  });

  const ratingColor = riskLevel === "VERY LOW" || riskLevel === "LOW"
    ? "var(--approve)"
    : riskLevel === "MODERATE"
    ? "var(--indigo)"
    : riskLevel === "HIGH"
    ? "var(--hold)"
    : "var(--reject)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Description header */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 10 }}>
        <Sliders size={18} color="var(--indigo-light)" style={{ marginTop: 2 }} />
        <div>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Interactive What-If Term Simulator</span>
          <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
            Simulate covenant parameter changes to see real-time shifts in default risk probabilities.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Left Sliders control panel */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
          {/* Slider 1: Loan size */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: "var(--text-secondary)" }}>Requested Loan Capital</span>
              <strong style={{ color: "var(--text-primary)" }}>₹{loanAmount.toFixed(0)} Lakhs</strong>
            </div>
            <input
              type="range"
              min={20}
              max={1000}
              step={10}
              value={loanAmount}
              onChange={(e) => setLoanAmount(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--indigo)" }}
            />
          </div>

          {/* Slider 2: DSCR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: "var(--text-secondary)" }}>Debt Service Coverage (DSCR)</span>
              <strong style={{ color: dscr >= 1.25 ? "var(--approve)" : "var(--reject)" }}>{dscr.toFixed(2)}x</strong>
            </div>
            <input
              type="range"
              min={0.6}
              max={3.0}
              step={0.05}
              value={dscr}
              onChange={(e) => setDscr(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--indigo)" }}
            />
          </div>

          {/* Slider 3: Leverage */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: "var(--text-secondary)" }}>Financial Leverage (D/E Ratio)</span>
              <strong style={{ color: leverage <= 2.5 ? "var(--approve)" : "var(--reject)" }}>{leverage.toFixed(2)}x</strong>
            </div>
            <input
              type="range"
              min={0.2}
              max={6.0}
              step={0.1}
              value={leverage}
              onChange={(e) => setLeverage(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--indigo)" }}
            />
          </div>

          {/* Slider 4: Collateral */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
              <span style={{ color: "var(--text-secondary)" }}>Offered Collateral Value</span>
              <strong style={{ color: "var(--text-primary)" }}>₹{collateral.toFixed(0)} Lakhs</strong>
            </div>
            <input
              type="range"
              min={0}
              max={1500}
              step={10}
              value={collateral}
              onChange={(e) => setCollateral(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--indigo)" }}
            />
          </div>
        </div>

        {/* Right Output details & chart */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Result Card */}
          <div className="card" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: `${ratingColor}06`, border: `1px solid ${ratingColor}22`, padding: 14
          }}>
            <div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>PD Under Simulation</span>
              <div style={{ fontSize: 24, fontWeight: 800, color: ratingColor, marginTop: 2 }}>{pd}%</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Risk category</span>
              <div style={{ fontSize: 13, fontWeight: 800, color: ratingColor, marginTop: 2 }}>{riskLevel}</div>
            </div>
          </div>

          {/* Sensitivity chart */}
          <div className="card" style={{ flex: 1, padding: 12, height: 180 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>PD Sensitivity to Loan Amount (₹ Lakhs)</span>
            <ResponsiveContainer width="100%" height="88%">
              <AreaChart data={chartData} margin={{ left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="loanAmt" tick={{ fill: "var(--text-muted)", fontSize: 8 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 8 }} />
                <Tooltip contentStyle={{ background: "var(--bg-card)", borderColor: "var(--border-default)", fontSize: 9 }} />
                <Area type="monotone" dataKey="defaultProb" name="Prob. of Default" stroke={ratingColor} fill={`${ratingColor}15`} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
