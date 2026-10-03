import { hotels } from "@/src/data/hotels";
import { evaluateSellability } from "@/src/core/truth";

export const runtime = "nodejs";

export async function GET() {
  const evaluated = hotels.map(evaluateSellability);
  const demo = evaluated.filter(x=>x.state==="DEMO").length;
  const quarantined = evaluated.filter(x=>x.state==="QUARANTINED").length;

  return Response.json({
    runId: "wave_demo_" + new Date().toISOString().slice(0,10),
    mode: "seed",
    state: "COMPLETE",
    providers: ["booking","ratehawk","hbx"],
    rawRecords: hotels.length * 3,
    canonicalHotels: hotels.length,
    quoteTested: hotels.length,
    sellable: 0,
    demo,
    stale: 0,
    quarantined,
    publicationAllowed: false,
    generatedAt: new Date().toISOString()
  });
}
