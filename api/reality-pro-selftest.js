import { Client } from "@gradio/client";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const source="https://justinmeans-da3-gaussiansplat.hf.space";
  try{
    const app=await Client.connect(source);
    const api=await app.view_api();
    const names=Object.keys(api?.named_endpoints||{});
    res.status(200).json({ok:true,source,endpoints:names,hasUpload:names.includes("/handle_uploads"),hasReconstruct:names.includes("/gradio_demo")});
  }catch(e){
    res.status(500).json({ok:false,error:String(e),stack:e?.stack});
  }
}