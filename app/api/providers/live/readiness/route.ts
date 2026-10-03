import { providerReadinessReport } from "@/src/providers/live/conformance";

export const runtime="nodejs";

function authorized(req:Request){
  const secret=process.env.OPS_ACCESS_KEY;
  return Boolean(secret && req.headers.get("authorization")==="Bearer "+secret);
}

export async function GET(req:Request){
  if(!authorized(req)) return new Response("Not found",{status:404});
  return Response.json({
    providers:providerReadinessReport(),
    generatedAt:new Date().toISOString(),
    invariants:[
      "no credentials => DISABLED",
      "configured does not imply commercial-ready",
      "seed/demo inventory never becomes commercial supply",
      "provider-specific fulfilment gates remain mandatory",
    ],
  },{headers:{"Cache-Control":"no-store"}});
}
