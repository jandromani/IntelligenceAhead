export default async function handler(req,res){
  const base='https://justinmeans-da3-gaussiansplat.hf.space';
  try{
    const [cr,ir]=await Promise.all([
      fetch(base+'/config',{headers:{'user-agent':'reality-compiler/4.0'}}),
      fetch(base+'/gradio_api/info',{headers:{'user-agent':'reality-compiler/4.0'}})
    ]);
    const config=await cr.json();
    const info=await ir.json();
    const endpoints=Object.entries(info.named_endpoints||{}).map(([name,ep])=>({
      name,
      parameters:(ep.parameters||[]).map(p=>({name:p.parameter_name,label:p.label,component:p.component,default:p.parameter_default,hasDefault:p.parameter_has_default})),
      returns:(ep.returns||[]).map(p=>({label:p.label,component:p.component}))
    }));
    const deps=(config.dependencies||[]).filter(d=>d.api_name||d.show_api).map(d=>({
      id:d.id,api_name:d.api_name,show_api:d.show_api,queue:d.queue,inputs:d.inputs,outputs:d.outputs,trigger_mode:d.trigger_mode
    }));
    res.setHeader('Cache-Control','no-store');
    res.status(200).json({space:base,version:config.version,api_prefix:config.api_prefix,endpoints,deps});
  }catch(e){
    res.status(500).json({error:String(e),stack:e?.stack});
  }
}