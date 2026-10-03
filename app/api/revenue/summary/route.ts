import { getDatabase } from "@/src/db/client";

export const runtime="nodejs";

function authorized(req:Request){
  const secret=process.env.OPS_ACCESS_KEY;
  return Boolean(secret&&req.headers.get("authorization")==="Bearer "+secret);
}

export async function GET(req:Request){
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  const sql=getDatabase();
  if(!sql) return Response.json({configured:false},{status:503});

  const [metrics]=await sql<{
    referral_clicks:number;
    conversions:number;
    booking_value:number;
    commission:number;
  }[]>`
    select
      (select count(*)::int from referral_clicks where created_at >= now()-interval '30 days') as referral_clicks,
      (select count(*)::int from conversions where received_at >= now()-interval '30 days') as conversions,
      coalesce((select sum(booking_value) from conversions where received_at >= now()-interval '30 days'),0)::float as booking_value,
      coalesce((select sum(commission) from conversions where received_at >= now()-interval '30 days'),0)::float as commission
  `;

  const conversionRate=metrics.referral_clicks>0?metrics.conversions/metrics.referral_clicks:0;
  return Response.json({configured:true,window:"30d",...metrics,conversionRate},{headers:{"Cache-Control":"no-store"}});
}
