export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const space="https://justinmeans-da3-gaussiansplat.hf.space";
  try{
    const r=await fetch(space+"/config",{headers:{"user-agent":"reality-compiler/5.1"},signal:AbortSignal.timeout(7000)});
    return res.status(r.ok?200:502).json({
      configured:true,
      ok:r.ok,
      api_ok:r.ok,
      backend:"huggingface-public-lab",
      space,
      status:r.status,
      anonymous_reconstruct:false,
      blocker:"Current fork requests a 900s ZeroGPU allocation for reconstruction; anonymous/free callers fail the duration pre-check.",
      last_full_test:"2026-09-29"
    });
  }catch(e){
    return res.status(502).json({configured:true,ok:false,api_ok:false,backend:"huggingface-public-lab",space,error:String(e)});
  }
}