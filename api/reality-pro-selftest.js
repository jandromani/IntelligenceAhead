import { Client } from "@gradio/client";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const source="https://justinmeans-da3-gaussiansplat.hf.space";
  try{
    const app=await Client.connect(source);
    const api=await app.view_api();
    const pick={};
    for(const name of ["/handle_uploads","/handle_uploads_1","/gradio_demo"]){
      const ep=api?.named_endpoints?.[name];
      pick[name]=ep?{
        parameters:(ep.parameters||[]).map(p=>({
          parameter_name:p.parameter_name,
          label:p.label,
          component:p.component,
          example_input:p.example_input,
          python_type:p.python_type,
          parameter_default:p.parameter_default,
          parameter_has_default:p.parameter_has_default
        })),
        returns:(ep.returns||[]).map(p=>({
          label:p.label,component:p.component,python_type:p.python_type
        }))
      }:null;
    }
    res.status(200).json({ok:true,pick});
  }catch(e){res.status(500).json({ok:false,error:String(e),stack:e?.stack});}
}