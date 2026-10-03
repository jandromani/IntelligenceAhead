import { hotels } from "@/src/data/hotels";
import { evaluateSellability } from "@/src/core/truth";
import { AGENTS } from "@/src/agents/registry";

export type ControlSignal = {
  key: string;
  severity: "info" | "warning" | "critical";
  message: string;
};

export async function collectControlSignals(): Promise<ControlSignal[]> {
  "use step";

  const truth = hotels.map(evaluateSellability);
  const demo = truth.filter(x => x.state === "DEMO").length;
  const quarantined = truth.filter(x => x.state === "QUARANTINED").length;
  const signals: ControlSignal[] = [];

  if (demo > 0) signals.push({ key:"supply.demo", severity:"warning", message:`${demo} catalogue records are demo-only and not commercially sellable` });
  if (quarantined > 0) signals.push({ key:"supply.quarantine", severity:"critical", message:`${quarantined} seed records are structurally quarantined` });

  signals.push({
    key:"agents.authority",
    severity:"info",
    message:`${Object.keys(AGENTS).length} bounded agent roles; 0 have publish or contract authority`,
  });

  signals.push({
    key:"bootstrap.remaining",
    severity:"warning",
    message:"Live provider credentials, persistent DB and affiliate conversion ingestion are still external dependencies",
  });

  return signals;
}

export async function buildHumanAgenda(signals: ControlSignal[]) {
  "use step";

  const urgent = signals.filter(x => x.severity === "critical");
  const warnings = signals.filter(x => x.severity === "warning");

  return {
    targetHumanMinutes: 60,
    urgent,
    warnings,
    decisions: [
      "Review only critical truth failures.",
      "Approve material external spend or contracts.",
      "Review partner/provider onboarding proposals.",
    ],
  };
}

export async function dailyControlWorkflow() {
  "use workflow";

  const signals = await collectControlSignals();
  const agenda = await buildHumanAgenda(signals);

  return {
    runType:"daily-control",
    signals,
    agenda,
    generatedAt:new Date().toISOString(),
  };
}
