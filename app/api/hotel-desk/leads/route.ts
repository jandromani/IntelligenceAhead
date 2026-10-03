import { z } from "zod";
import { createHotelLead } from "@/src/db/direct-supply";

const Input=z.object({
  hotelName:z.string().min(2).max(200),
  city:z.string().min(2).max(120),
  country:z.string().min(2).max(120),
  website:z.string().url().optional(),
  contactName:z.string().max(160).optional(),
  contactRole:z.string().max(160).optional(),
  contactEmail:z.string().email().optional(),
  source:z.string().max(120).optional(),
  notes:z.record(z.string(),z.unknown()).optional(),
});
function authorized(req:Request){const s=process.env.OPS_ACCESS_KEY;return Boolean(s&&req.headers.get("authorization")==="Bearer "+s);}
export async function POST(req:Request){
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"invalid-lead",issues:parsed.error.issues},{status:400});
  const id=await createHotelLead(parsed.data);
  if(!id) return Response.json({error:"database-not-configured"},{status:503});
  return Response.json({ok:true,id},{status:201});
}
