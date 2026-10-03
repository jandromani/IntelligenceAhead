import { start } from "workflow/api";
import { dailyControlWorkflow } from "@/workflows/daily-control";

export const runtime = "nodejs";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === "Bearer " + secret);
}

export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  const run = await start(dailyControlWorkflow, []);
  console.log(JSON.stringify({level:"info",event:"scheduled_workflow_started",type:"daily-control",runId:run.runId}));

  return Response.json({accepted:true,runId:run.runId},{status:202,headers:{"Cache-Control":"no-store"}});
}
