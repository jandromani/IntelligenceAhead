import { getDatabase } from "@/src/db/client";

export type OpsSnapshot = {
  available:boolean;
  liveOffers:number;
  referralClicks30d:number;
  conversions30d:number;
  commission30d:number;
  acquisitionRuns:Array<{waveKey:string;provider:string|null;status:string;startedAt:string;completedAt:string|null;sellable:number;errors:number}>;
  agentRuns:Array<{agentKey:string;status:string;startedAt:string;completedAt:string|null;costCents:number|null}>;
  error?:string;
};

export async function getOpsSnapshot():Promise<OpsSnapshot>{
  const sql=getDatabase();
  if(!sql) return{available:false,liveOffers:0,referralClicks30d:0,conversions30d:0,commission30d:0,acquisitionRuns:[],agentRuns:[]};
  try{
    const [counts]=await sql<{live_offers:number;referral_clicks:number;conversions:number;commission:number}[]>`
      select
        (select count(*)::int from offer_snapshots o join lateral (select state from sellability_audits sa where sa.offer_snapshot_id=o.id order by sa.evaluated_at desc limit 1) a on true where a.state='SELLABLE' and o.source_mode='live' and o.deep_link is not null and (o.expires_at is null or o.expires_at>now())) as live_offers,
        (select count(*)::int from referral_clicks where created_at>=now()-interval '30 days') as referral_clicks,
        (select count(*)::int from conversions where received_at>=now()-interval '30 days') as conversions,
        coalesce((select sum(commission) from conversions where received_at>=now()-interval '30 days'),0)::float as commission
    `;
    const acquisitionRuns=await sql<{wave_key:string;provider:string|null;status:string;started_at:string;completed_at:string|null;sellable_count:number;error_count:number}[]>`
      select wave_key,provider,status,started_at::text,completed_at::text,sellable_count,error_count
      from acquisition_runs order by started_at desc limit 8
    `;
    const agentRuns=await sql<{agent_key:string;status:string;started_at:string;completed_at:string|null;estimated_cost_cents:number|null}[]>`
      select agent_key,status,started_at::text,completed_at::text,estimated_cost_cents
      from agent_runs order by started_at desc limit 8
    `;
    return{
      available:true,
      liveOffers:Number(counts?.live_offers||0),
      referralClicks30d:Number(counts?.referral_clicks||0),
      conversions30d:Number(counts?.conversions||0),
      commission30d:Number(counts?.commission||0),
      acquisitionRuns:acquisitionRuns.map(r=>({waveKey:r.wave_key,provider:r.provider,status:r.status,startedAt:r.started_at,completedAt:r.completed_at,sellable:Number(r.sellable_count||0),errors:Number(r.error_count||0)})),
      agentRuns:agentRuns.map(r=>({agentKey:r.agent_key,status:r.status,startedAt:r.started_at,completedAt:r.completed_at,costCents:r.estimated_cost_cents===null?null:Number(r.estimated_cost_cents)})),
    };
  }catch(error){
    console.error(JSON.stringify({level:"error",event:"ops_snapshot_failed",error:String(error)}));
    return{available:false,liveOffers:0,referralClicks30d:0,conversions30d:0,commission30d:0,acquisitionRuns:[],agentRuns:[],error:"query-failed"};
  }
}
