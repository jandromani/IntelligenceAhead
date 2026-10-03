import { runSeedAcquisitionWave, type AcquisitionWaveInput, type AcquisitionWaveResult } from "@/src/services/acquisition";

export type SupplyGate = {
  verdict: "PASS" | "REVIEW" | "REJECT";
  reasons: string[];
};

export async function executeSupplyWave(input: AcquisitionWaveInput) {
  "use step";
  return runSeedAcquisitionWave(input);
}

export async function gateSupplyWave(result: AcquisitionWaveResult): Promise<SupplyGate> {
  "use step";
  const reasons: string[] = [];

  if (result.canonicalHotels <= 0) reasons.push("no canonical hotels produced");
  if (result.quoteTested < result.canonicalHotels) reasons.push("quote coverage below canonical coverage");
  if (result.quarantined > Math.max(3, result.canonicalHotels * 0.15)) reasons.push("quarantine rate above threshold");
  if (result.mode === "seed") reasons.push("seed wave cannot publish commercial supply");
  if (result.mode === "live" && result.sellable <= 0) reasons.push("live wave produced no sellable offers");

  return {
    verdict:
      result.canonicalHotels === 0
        ? "REJECT"
        : reasons.length === 0
          ? "PASS"
          : "REVIEW",
    reasons,
  };
}

export async function supplyWaveWorkflow(input: AcquisitionWaveInput) {
  "use workflow";

  const result = await executeSupplyWave(input);
  const gate = await gateSupplyWave(result);

  return {
    runType: "supply-wave",
    result,
    gate,
    completedAt: new Date().toISOString(),
  };
}
