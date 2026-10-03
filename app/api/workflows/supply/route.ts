import { z } from "zod";
import { start } from "workflow/api";
import { supplyWaveWorkflow } from "@/workflows/supply-wave";

export const runtime = "nodejs";

const Input = z.object({
  waveKey: z.string().min(1).max(120),
  regions: z.array(z.string()).max(20).optional(),
  providers: z.array(z.string()).max(10).optional(),
  durations: z.array(z.number().int().positive().max(365)).max(10).optional(),
});

function authorized(req: Request) {
  const ops = process.env.OPS_ACCESS_KEY;
  const cron = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  return Boolean((ops && auth === "Bearer " + ops) || (cron && auth === "Bearer " + cron));
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const parsed = Input.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return Response.json({error:"Invalid wave request"},{status:400});

  const run = await start(supplyWaveWorkflow, [parsed.data]);
  console.log(JSON.stringify({level:"info",event:"workflow_started",type:"supply-wave",runId:run.runId,waveKey:parsed.data.waveKey}));

  return Response.json({accepted:true,runId:run.runId},{status:202,headers:{"Cache-Control":"no-store"}});
}
