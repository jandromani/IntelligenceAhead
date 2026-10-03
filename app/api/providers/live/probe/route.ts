import { z } from "zod";
import { liveProviderRegistry } from "@/src/providers/live/registry";

export const runtime="nodejs";

const Input=z.discriminatedUnion("provider",[
  z.object({provider:z.literal("booking"),cityId:z.number().int(),checkIn:z.string(),checkOut:z.string(),adults:z.number().int().min(1).max(8),currency:z.string().default("EUR")}),
  z.object({provider:z.literal("ratehawk"),hotelIds:z.array(z.number().int()).min(1).max(300),checkIn:z.string(),checkOut:z.string(),adults:z.number().int().min(1).max(8),currency:z.string().default("EUR")}),
  z.object({provider:z.literal("hbx"),hotelCodes:z.array(z.number().int()).min(1).max(500),checkIn:z.string(),checkOut:z.string(),adults:z.number().int().min(1).max(8),currency:z.string().default("EUR")}),
]);

function authorized(req:Request){
  const ops=process.env.OPS_ACCESS_KEY;
  return Boolean(ops&&req.headers.get("authorization")==="Bearer "+ops);
}

export async function POST(req:Request){
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  const parsed=Input.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return Response.json({error:"Invalid probe request",issues:parsed.error.issues},{status:400});

  const registry=liveProviderRegistry();
  try{
    let hits;
    if(parsed.data.provider==="booking") hits=await registry.booking.search(parsed.data);
    else if(parsed.data.provider==="ratehawk") hits=await registry.ratehawk.searchHotels(parsed.data);
    else hits=await registry.hbx.searchHotels(parsed.data);

    return Response.json({provider:parsed.data.provider,count:hits.length,hits},{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error(JSON.stringify({level:"error",event:"live_provider_probe_failed",provider:parsed.data.provider,error:String(error)}));
    return Response.json({error:String(error)},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
