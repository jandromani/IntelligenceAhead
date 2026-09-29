export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const space="https://justinmeans-da3-gaussiansplat.hf.space";
  try{
    const r=await fetch(space+"/config",{headers:{"user-agent":"reality-compiler/5.0"},signal:AbortSignal.timeout(7000)});
    return res.status(r.ok?200:502).json({configured:true,ok:r.ok,backend:"huggingface-space",space,status:r.status});
  }catch(e){
    return res.status(502).json({configured:true,ok:false,backend:"huggingface-space",space,error:String(e)});
  }
}
