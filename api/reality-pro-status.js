export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const backend=(process.env.REALITY_PRO_BACKEND_URL||"").replace(/\/$/,"");
  if(!backend) return res.status(200).json({configured:false,ok:false,reason:"REALITY_PRO_BACKEND_URL is not set"});
  try{
    const r=await fetch(backend+"/health",{signal:AbortSignal.timeout(4500)});
    const body=await r.json().catch(()=>({}));
    return res.status(r.ok?200:502).json({configured:true,ok:r.ok,backend,health:body});
  }catch(e){
    return res.status(502).json({configured:true,ok:false,backend,error:String(e)});
  }
}
