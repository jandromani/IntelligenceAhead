import { getSystemReadiness } from "@/src/system/readiness";

export const runtime="nodejs";

export async function GET(){
  const status=await getSystemReadiness();
  return Response.json(status,{headers:{"Cache-Control":"no-store"}});
}
