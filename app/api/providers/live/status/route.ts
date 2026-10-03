import { liveProviderStatuses } from "@/src/providers/live/registry";

export const runtime="nodejs";

export async function GET(){
  return Response.json({
    providers:liveProviderStatuses(),
    generatedAt:new Date().toISOString(),
    rule:"configured=false means disabled; missing credentials never degrade to mock success",
  },{headers:{"Cache-Control":"no-store"}});
}
