import { Client } from "@gradio/client";
export const maxDuration=120;
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const spaces=[
    "https://depth-anything-depth-anything-3.hf.space",
    "https://justinmeans-da3-gaussiansplat.hf.space",
    "https://guardiancc-gaussian-splat.hf.space"
  ];
  const out=[];
  for(const source of spaces){
    try{
      const app=await Client.connect(source);
      const api=await app.view_api();
      const ep=api?.named_endpoints?.["/gradio_demo"];
      out.push({
        source,ok:true,
        endpoints:Object.keys(api?.named_endpoints||{}),
        reconstruct:ep?{
          params:(ep.parameters||[]).map(p=>p.parameter_name||"(state)"),
          returns:(ep.returns||[]).map(p=>({label:p.label,component:p.component,python_type:p.python_type?.type||null}))
        }:null
      });
    }catch(e){out.push({source,ok:false,error:String(e)});}
  }
  res.status(200).json({out});
}