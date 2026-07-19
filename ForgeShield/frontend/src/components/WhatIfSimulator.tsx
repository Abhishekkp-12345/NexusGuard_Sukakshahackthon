import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Sliders } from "lucide-react";

interface Props {
  initialAmount: number;
  applicantType?: "corporate" | "salaried" | "farmer";
}

export default function WhatIfSimulator({ initialAmount, applicantType = "corporate" }: Props) {
  // --- STATE FOR CORPORATE ---
  const [corpLoan, setCorpLoan] = useState(initialAmount > 0 ? initialAmount / 100000 : 150); // Lakhs
  const [dscr, setDscr] = useState(1.4);
  const [leverage, setLeverage] = useState(1.8);
  const [collateral, setCollateral] = useState(200); // Lakhs

  // --- STATE FOR WORKER ---
  const [workerLoan, setWorkerLoan] = useState(initialAmount > 0 ? initialAmount / 100000 : 5); // Lakhs
  const [monthlySalary, setMonthlySalary] = useState(45000); // ₹
  const [existingEmi, setExistingEmi] = useState(8000); // ₹
  const [guarantorScore, setGuarantorScore] = useState(720); // 300 - 900

  // --- STATE FOR FARMER ---
  const [farmerLoan, setFarmerLoan] = useState(initialAmount > 0 ? initialAmount / 100000 : 3); // Lakhs
  const [landArea, setLandArea] = useState(5.0); // Acres
  const [cropYield, setCropYield] = useState(18); // Quintals per Acre
  const [marketPrice, setMarketPrice] = useState(2400); // ₹ per Quintal

  // --- CALCULATED PD AND RISK ---
  const [pd, setPd] = useState(18);
  const [riskLevel, setRiskLevel] = useState("LOW");

  // Re-calculate PD using a realistic model formula for each role
  useEffect(() => {
    let computedPd = 15;

    if (applicantType === "salaried") {
      // Worker: FOIR is key.
      // New EMI: assume 12% interest, 3 years. Roughly ₹3300 per Lakh of loan
      const newEmi = workerLoan * 3300;
      const totalObligation = existingEmi + newEmi;
      const foir = monthlySalary > 0 ? (totalObligation / monthlySalary) * 100 : 100;

      // FOIR penalty
      if (foir > 60) computedPd += 35;
      else if (foir > 45) computedPd += 18;
      else if (foir < 30) computedPd -= 5;

      // Guarantor rating penalty
      if (guarantorScore < 600) computedPd += 25;
      else if (guarantorScore < 700) computedPd += 10;
      else if (guarantorScore > 800) computedPd -= 8;

      // Loan size ratio penalty
      const incomeMultiplier = (workerLoan * 100000) / (monthlySalary * 12);
      if (incomeMultiplier > 5.0) computedPd += 20;

    } else if (applicantType === "farmer") {
      // Farmer: land size, seasonal harvests
      const harvestRevenue = landArea * cropYield * marketPrice; // ₹ per year
      const loanAmountRs = farmerLoan * 100000;
      const leverageRatio = harvestRevenue > 0 ? (loanAmountRs / harvestRevenue) : 5.0;

      // Leverage penalty
      if (leverageRatio > 2.0) computedPd += 30;
      else if (leverageRatio > 1.2) computedPd += 15;
      else if (leverageRatio < 0.6) computedPd -= 8;

      // Crop yield health penalty
      if (cropYield < 10) computedPd += 20;
      else if (cropYield > 25) computedPd -= 5;

      // Land area security discount
      if (landArea < 2.0) computedPd += 15;
      else if (landArea > 10.0) computedPd -= 10;

    } else {
      // Corporate
      const ltv = collateral > 0 ? (corpLoan / collateral) * 100 : 200;
      if (dscr < 1.0) computedPd += 35;
      else if (dscr < 1.25) computedPd += 20;
      else if (dscr < 1.5) computedPd += 5;
      else computedPd -= 8;

      if (leverage > 4.0) computedPd += 25;
      else if (leverage > 2.5) computedPd += 12;
      else if (leverage < 1.2) computedPd -= 5;

      if (ltv > 100) computedPd += 30;
      else if (ltv > 80) computedPd += 15;
      else if (ltv < 50) computedPd -= 8;

      if (corpLoan > 500) computedPd += 10;
    }

    // Clamp between 2% and 99%
    const finalPd = Math.max(2, Math.min(99, Math.round(computedPd)));
    setPd(finalPd);

    if (finalPd < 15) setRiskLevel("VERY LOW");
    else if (finalPd < 30) setRiskLevel("LOW");
    else if (finalPd < 50) setRiskLevel("MODERATE");
    else if (finalPd < 70) setRiskLevel("HIGH");
    else setRiskLevel("CRITICAL");

  }, [
    applicantType, corpLoan, dscr, leverage, collateral,
    workerLoan, monthlySalary, existingEmi, guarantorScore,
    farmerLoan, landArea, cropYield, marketPrice
  ]);

  // Generate chart coordinates to visualize sensitivity of PD to loan amount changes
  const chartData = Array.from({ length: 9 }).map((_, idx) => {
    let testAmt = 0;
    let testPd = 15;

    if (applicantType === "salaried") {
      testAmt = 1 + idx * 2.5; // 1 to 21 Lakhs
      const newEmi = testAmt * 3300;
      const totalObligation = existingEmi + newEmi;
      const foir = monthlySalary > 0 ? (totalObligation / monthlySalary) * 100 : 100;

      if (foir > 60) testPd += 35;
      else if (foir > 45) testPd += 18;
      else if (foir < 30) testPd -= 5;

      if (guarantorScore < 600) testPd += 25;
      else if (guarantorScore < 700) testPd += 10;

      const incomeMultiplier = (testAmt * 100000) / (monthlySalary * 12);
      if (incomeMultiplier > 5.0) testPd += 20;

    } else if (applicantType === "farmer") {
      testAmt = 0.5 + idx * 1.5; // 0.5 to 12.5 Lakhs
      const harvestRevenue = landArea * cropYield * marketPrice;
      const leverageRatio = harvestRevenue > 0 ? ((testAmt * 100000) / harvestRevenue) : 5.0;

      if (leverageRatio > 2.0) testPd += 30;
      else if (leverageRatio > 1.2) testPd += 15;
      else if (leverageRatio < 0.6) testPd -= 8;

      if (cropYield < 10) testPd += 20;
      if (landArea < 2.0) testPd += 15;

    } else {
      testAmt = 50 + idx * 50; // 50 to 450 Lakhs
      const testLtv = collateral > 0 ? (testAmt / collateral) * 100 : 200;

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
    }

    return {
      loanAmt: `₹${testAmt.toFixed(1)}L`,
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
            Simulate covenant and capacity parameter changes to see real-time shifts in default risk probabilities.
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        {/* Left Sliders control panel */}
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
          
          {/* CORPORATE SLIDERS */}
          {applicantType === "corporate" && (
            <>
              {/* Slider 1: Loan size */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Requested Loan Capital</span>
                  <strong style={{ color: "var(--text-primary)" }}>₹{corpLoan.toFixed(0)} Lakhs</strong>
                </div>
                <input
                  type="range"
                  min={20}
                  max={1000}
                  step={10}
                  value={corpLoan}
                  onChange={(e) => setCorpLoan(parseFloat(e.target.value))}
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
            </>
          )}

          {/* SALARIED WORKER SLIDERS */}
          {applicantType === "salaried" && (
            <>
              {/* Slider 1: Loan size */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Requested Loan Amount</span>
                  <strong style={{ color: "var(--text-primary)" }}>₹{workerLoan.toFixed(1)} Lakhs</strong>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={25}
                  step={0.5}
                  value={workerLoan}
                  onChange={(e) => setWorkerLoan(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>

              {/* Slider 2: Monthly salary */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Net Monthly Take-Home</span>
                  <strong style={{ color: "var(--text-primary)" }}>₹{monthlySalary.toLocaleString()}</strong>
                </div>
                <input
                  type="range"
                  min={10000}
                  max={150000}
                  step={2000}
                  value={monthlySalary}
                  onChange={(e) => setMonthlySalary(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>

              {/* Slider 3: Existing EMIs */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Existing Monthly EMIs</span>
                  <strong style={{ color: existingEmi > monthlySalary * 0.4 ? "var(--reject)" : "var(--text-primary)" }}>₹{existingEmi.toLocaleString()}</strong>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50000}
                  step={1000}
                  value={existingEmi}
                  onChange={(e) => setExistingEmi(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>

              {/* Slider 4: Guarantor Credit Score */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Personal Guarantor Score</span>
                  <strong style={{ color: guarantorScore >= 700 ? "var(--approve)" : "var(--reject)" }}>{guarantorScore}</strong>
                </div>
                <input
                  type="range"
                  min={300}
                  max={900}
                  step={10}
                  value={guarantorScore}
                  onChange={(e) => setGuarantorScore(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>
            </>
          )}

          {/* FARMER SLIDERS */}
          {applicantType === "farmer" && (
            <>
              {/* Slider 1: Loan size */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Requested KCC Limit</span>
                  <strong style={{ color: "var(--text-primary)" }}>₹{farmerLoan.toFixed(1)} Lakhs</strong>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={15}
                  step={0.5}
                  value={farmerLoan}
                  onChange={(e) => setFarmerLoan(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>

              {/* Slider 2: Land Area */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Cultivated Land Area</span>
                  <strong style={{ color: "var(--text-primary)" }}>{landArea.toFixed(1)} Acres</strong>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={25}
                  step={0.5}
                  value={landArea}
                  onChange={(e) => setLandArea(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>

              {/* Slider 3: Yield index */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Avg Yield (Quintals/Acre)</span>
                  <strong style={{ color: cropYield >= 15 ? "var(--approve)" : "var(--hold)" }}>{cropYield} Qtl</strong>
                </div>
                <input
                  type="range"
                  min={4}
                  max={45}
                  step={1}
                  value={cropYield}
                  onChange={(e) => setCropYield(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>

              {/* Slider 4: Market Price */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Market Price per Quintal</span>
                  <strong style={{ color: "var(--text-primary)" }}>₹{marketPrice.toLocaleString()}</strong>
                </div>
                <input
                  type="range"
                  min={1000}
                  max={8000}
                  step={100}
                  value={marketPrice}
                  onChange={(e) => setMarketPrice(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--indigo)" }}
                />
              </div>
            </>
          )}

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
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
              PD Sensitivity to Loan Amount
            </span>
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
