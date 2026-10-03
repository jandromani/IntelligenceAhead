import { z } from "zod";
import { databaseConfigured } from "@/src/db/client";
import { persistConversion } from "@/src/db/ledger";
import { after } from "next/server";
import { busEvent, publishBusEvent } from "@/src/events/bus";

export const runtime="nodejs";

const Input=z.object({
  clickId:z.string().uuid(),
  provider:z.string().min(1).max(80),
  providerConversionId:z.string().min(1).max(200),
  bookingValue:z.number().nonnegative().optional(),
  commission:z.number().optional(),
  currency:z.string().length(3).optional(),
  status:z.string().min(1).max(40).optional(),
  occurredAt:z.string().datetime().optional(),
});

function authorized(req:Request){
  const secret=process.env.CONVERSION_INGEST_SECRET || process.env.OPS_ACCESS_KEY;
  return Boolean(secret&&req.headers.get("authorization")==="Bearer "+secret);
}

export async function POST(req:Request){
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  if(!databaseConfigured()) return Response.json({error:"database-not-configured"},{status:503});

  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"invalid-conversion",issues:parsed.error.issues},{status:400});

  const result=await persistConversion(parsed.data);
  if(!result.persisted) return Response.json({error:result.reason},{status:503});

  console.log(JSON.stringify({level:"info",event:"conversion_ingested",provider:parsed.data.provider,clickId:parsed.data.clickId,providerConversionId:parsed.data.providerConversionId}));
  after(async()=>{await publishBusEvent(busEvent("conversion.received",parsed.data,parsed.data.clickId,parsed.data.provider+"-"+parsed.data.providerConversionId));});
  return Response.json({ok:true});
}
