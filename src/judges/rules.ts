export type JudgeVerdict = "PASS" | "REVISION" | "REJECT";

export type JudgeResult = {
  judge: string;
  verdict: JudgeVerdict;
  score: number;
  reasons: string[];
};

export function deterministicTruthJudge(artifact: string): JudgeResult {
  const reasons: string[] = [];
  const lower = artifact.toLowerCase();
  if (/guaranteed|100% available|live price/.test(lower) && !/evidence|verified|provider/.test(lower)) {
    reasons.push("commercial certainty without explicit evidence");
  }
  if (/€\s?\d/.test(artifact) && !/prototype|verified|provider|seed|evidence/i.test(artifact)) {
    reasons.push("price appears without provenance language");
  }
  return {
    judge: "truth",
    verdict: reasons.length ? "REVISION" : "PASS",
    score: reasons.length ? 62 : 96,
    reasons,
  };
}

export function deterministicBrandJudge(artifact: string): JudgeResult {
  const reasons: string[] = [];
  if (/elderly|old people|geriatric/i.test(artifact)) reasons.push("brand language is age-first instead of freedom-first");
  return { judge:"brand", verdict: reasons.length ? "REVISION" : "PASS", score: reasons.length ? 70 : 95, reasons };
}
