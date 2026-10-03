import { z } from "zod";
import { start } from "workflow/api";
import { bookingLiveWaveWorkflow } from "@/workflows/booking-live-wave";

export const runtime="nodejs";

const Input=z.object({
  waveKey:z.string().min(1).max(120),
  checkIn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nights:z.number().int().min(1).max(90),
  adults:z.union([z.literal(1),z.literal(2)]),
  regions:z.array(z.enum(["Europe","Asia","Africa","Americas"])).max(4).optional(),
  maxDestinations:z.number().int().min(1).max(30).optional(),
  radiusKm:z.number().positive().max(50).optional(),
  rowsPerDestination:z.number().int().min(10).max(100).optional(),
  persist:z.boolean().optional(),
});

function authorized(req:Request){
  const secret=process.env.OPS_ACCESS_KEY;
  return Boolean(secret&&req.headers.get("authorization")==="Bearer "+secret);
}

export async function POST(req:Request){
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"invalid-live-wave",issues:parsed.error.issues},{status:400});
  const run=await start(bookingLiveWaveWorkflow,[parsed.data]);
  console.log(JSON.stringify({level:"info",event:"booking_live_wave_started",runId:run.runId,waveKey:parsed.data.waveKey}));
  return Response.json({accepted:true,runId:run.runId},{status:202,headers:{"Cache-Control":"no-store"}});
}
