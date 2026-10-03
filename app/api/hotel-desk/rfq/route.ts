import { z } from "zod";
import { buildRFQ } from "@/src/direct/rfq";
const Input=z.object({
  hotelName:z.string().min(2).max(200),
  city:z.string().min(2).max(120),
  country:z.string().min(2).max(120),
  checkIn:z.string(),
  nights:z.number().int().min(30).max(180),
  guests:z.union([z.literal(1),z.literal(2)]),
  board:z.enum(["room","breakfast","half-board","full-board","all-inclusive"]),
  targetMonthlyEur:z.number().positive().max(20000),
});
function authorized(req:Request){const s=process.env.OPS_ACCESS_KEY;return Boolean(s&&req.headers.get("authorization")==="Bearer "+s);}
export async function POST(req:Request){
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"invalid-rfq",issues:parsed.error.issues},{status:400});
  return Response.json(buildRFQ(parsed.data));
}
