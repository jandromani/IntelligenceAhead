import { start } from "workflow/api";
import { dailyControlWorkflow } from "@/workflows/daily-control";

export const runtime = "nodejs";

function authorized(req: Request) {
  const ops = process.env.OPS_ACCESS_KEY;
  const cron = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  return Boolean((ops && auth === "Bearer " + ops) || (cron && auth === "Bearer " + cron));
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  const run = await start(dailyControlWorkflow, []);
  console.log(JSON.stringify({level:"info",event:"workflow_started",type:"daily-control",runId:run.runId}));

  return Response.json({accepted:true,runId:run.runId},{status:202,headers:{"Cache-Control":"no-store"}});
}
