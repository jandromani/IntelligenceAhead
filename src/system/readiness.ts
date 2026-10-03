import { databaseConfigured } from "@/src/db/client";
import { liveProviderStatuses } from "@/src/providers/live/registry";
import { AGENTS } from "@/src/agents/registry";
import { getOpsSnapshot } from "@/src/db/ops";
import { runSoftwareProof } from "@/src/system/proof";

export type LayerState="LIVE"|"READY"|"WAITING_EXTERNAL"|"DEGRADED";

export async function getSystemReadiness(){
  const providers=liveProviderStatuses();
  const configuredProviders=providers.filter(p=>p.configured);
  const db=databaseConfigured();
  const ops=await getOpsSnapshot();
  const proof=runSoftwareProof();

  const experience={state:"LIVE" as LayerState,score:100,detail:"Planner, map, share loop, SEO landings, live-offer lane and concierge UI are implemented."};
  const supplyState:LayerState=ops.liveOffers>0?"LIVE":configuredProviders.length&&db?"READY":"WAITING_EXTERNAL";
  const supply={state:supplyState,score:supplyState==="LIVE"?100:supplyState==="READY"?92:82,detail:ops.liveOffers>0?String(ops.liveOffers)+" sellable live offers in catalog":"Provider adapters, evidence ledger and Truth Gate are ready; live credentials/DB data are the remaining external dependency."};
  const moneyState:LayerState=ops.conversions30d>0?"LIVE":db?"READY":"WAITING_EXTERNAL";
  const money={state:moneyState,score:moneyState==="LIVE"?100:moneyState==="READY"?90:78,detail:ops.conversions30d>0?String(ops.conversions30d)+" conversions in 30d":"Click attribution, conversion ingestion and revenue reconciliation are implemented; first partner conversion is external."};
  const agentConfigured=Boolean(process.env.OPENROUTER_API_KEY);
  const autonomyState:LayerState=agentConfigured&&proof.pass?"READY":proof.pass?"WAITING_EXTERNAL":"DEGRADED";
  const autonomy={state:autonomyState,score:autonomyState==="READY"?96:autonomyState==="WAITING_EXTERNAL"?84:60,detail:String(Object.keys(AGENTS).length)+" bounded roles, durable workflows and independent judges. OpenRouter "+(agentConfigured?"configured":"not configured on this environment")+"."};

  return{
    generatedAt:new Date().toISOString(),
    layers:{experience,supply,money,autonomy},
    infrastructure:{
      databaseConfigured:db,
      agentConfigured,
      configuredProviders:configuredProviders.map(p=>p.provider),
      providers:providers.map(p=>({provider:p.provider,configured:p.configured,environment:p.environment})),
    },
    ops,
    proof,
  };
}
