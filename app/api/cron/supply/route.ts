import { start } from "workflow/api";
import { supplyWaveWorkflow } from "@/workflows/supply-wave";

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === "Bearer " + secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  const waveKey = "scheduled_" + new Date().toISOString().slice(0, 13);
  const run = await start(supplyWaveWorkflow, [{
    waveKey,
    providers:["booking","ratehawk","hbx"],
    durations:[30,60,90],
  }]);

  console.log(JSON.stringify({level:"info",event:"scheduled_workflow_started",type:"supply-wave",runId:run.runId,waveKey}));
  return Response.json({accepted:true,runId:run.runId,waveKey},{status:202,headers:{"Cache-Control":"no-store"}});
}
