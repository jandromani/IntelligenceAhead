import crypto from "node:crypto";

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const backend=(process.env.REALITY_PRO_BACKEND_URL||"").replace(/\/$/,"");
  const secret=process.env.REALITY_PRO_SHARED_SECRET||"";
  if(!backend || !secret){
    return res.status(200).json({configured:false,reason:"GPU node not connected",backend:null});
  }
  const ts=Math.floor(Date.now()/1000);
  const nonce=crypto.randomBytes(12).toString("hex");
  const sig=crypto.createHmac("sha256",secret).update(`${ts}.${nonce}`).digest("hex");
  let health=null;
  try{
    const r=await fetch(backend+"/health",{signal:AbortSignal.timeout(4500)});
    health=r.ok?await r.json():{ok:false,status:r.status};
  }catch(e){health={ok:false,error:String(e)}}
  return res.status(200).json({
    configured:true,
    backend,
    token:`${ts}.${nonce}.${sig}`,
    expires_in:300,
    health
  });
}
