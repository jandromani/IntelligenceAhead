import { z } from "zod";
import { databaseConfigured } from "@/src/db/client";
import { listSellableOffers } from "@/src/db/catalog";

export const runtime="nodejs";

const Query=z.object({
  limit:z.coerce.number().int().min(1).max(50).optional(),
  q:z.string().max(100).optional(),
  maxMonthly:z.coerce.number().positive().max(100000).optional(),
});

export async function GET(req:Request){
  if(!databaseConfigured()) return Response.json({configured:false,offers:[]},{headers:{"Cache-Control":"no-store"}});
  const url=new URL(req.url);
  const parsed=Query.safeParse({
    limit:url.searchParams.get("limit") || undefined,
    q:url.searchParams.get("q") || undefined,
    maxMonthly:url.searchParams.get("maxMonthly") || undefined,
  });
  if(!parsed.success) return Response.json({error:"invalid-query"},{status:400});
  const offers=await listSellableOffers(parsed.data);
  return Response.json({configured:true,offers,generatedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}
