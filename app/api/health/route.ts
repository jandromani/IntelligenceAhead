import { databaseConfigured } from "@/src/db/client";
import { liveProviderStatuses } from "@/src/providers/live/registry";
import { runSoftwareProof } from "@/src/system/proof";

export async function GET(){
  const providers=liveProviderStatuses();
  const proof=runSoftwareProof();
  return Response.json({
    ok:proof.pass,
    service:"atlas-web",
    softwareProof:proof.pass,
    agentConfigured:Boolean(process.env.OPENROUTER_API_KEY),
    databaseConfigured:databaseConfigured(),
    providers:providers.map(p=>({provider:p.provider,configured:p.configured,environment:p.environment})),
    now:new Date().toISOString(),
  },{headers:{"Cache-Control":"no-store"}});
}
