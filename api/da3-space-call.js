async function callGradio(base,api,data=[]){
  const start=await fetch(base+'/gradio_api/call/'+api,{
    method:'POST',headers:{'content-type':'application/json','user-agent':'reality-compiler/4.0'},
    body:JSON.stringify({data})
  });
  const sj=await start.json().catch(async()=>({raw:await start.text()}));
  if(!start.ok) return {stage:'start',status:start.status,response:sj};
  const eventId=sj.event_id;
  if(!eventId) return {stage:'start',status:start.status,response:sj};
  const ev=await fetch(base+'/gradio_api/call/'+api+'/'+eventId,{headers:{'user-agent':'reality-compiler/4.0'}});
  const text=await ev.text();
  return {stage:'complete',startStatus:start.status,eventStatus:ev.status,eventId,text:text.slice(0,20000)};
}
export default async function handler(req,res){
 const base='https://justinmeans-da3-gaussiansplat.hf.space';
 const api=String(req.query.api||'lambda_5').replace(/^\//,'');
 try{
   const result=await callGradio(base,api,[]);
   res.setHeader('Cache-Control','no-store');
   res.status(200).json({api,result});
 }catch(e){res.status(500).json({error:String(e),stack:e?.stack})}
}