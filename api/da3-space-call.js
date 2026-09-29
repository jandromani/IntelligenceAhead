export const config={maxDuration:120};

async function callGradio(base,api,data=[]){
  const start=await fetch(base+'/gradio_api/call/'+api,{
    method:'POST',
    headers:{'content-type':'application/json','user-agent':'reality-compiler/4.0'},
    body:JSON.stringify({data})
  });
  const rawStart=await start.text();
  let sj; try{sj=JSON.parse(rawStart)}catch{sj={raw:rawStart}}
  if(!start.ok) return {stage:'start',status:start.status,response:sj};
  const eventId=sj.event_id;
  if(!eventId) return {stage:'start',status:start.status,response:sj};
  const ev=await fetch(base+'/gradio_api/call/'+api+'/'+eventId,{headers:{'user-agent':'reality-compiler/4.0'}});
  const text=await ev.text();
  return {stage:'complete',startStatus:start.status,eventStatus:ev.status,eventId,text:text.slice(0,50000)};
}

export default async function handler(req,res){
 const base='https://justinmeans-da3-gaussiansplat.hf.space';
 const preset=String(req.query.preset||'');
 let api=String(req.query.api||'lambda_5').replace(/^\//,'');
 let data=[];
 if(preset==='example-gs'){
   api='gradio_demo';
   data=[
     'workspace/gradio/input_images/example_DL3DV_10K_a401469cb0',
     true,false,false,
     'high_res',
     5,
     1000,
     true,
     'smooth',
     'medium'
   ];
 }
 try{
   const result=await callGradio(base,api,data);
   res.setHeader('Cache-Control','no-store');
   res.status(200).json({api,preset,data,result});
 }catch(e){res.status(500).json({error:String(e),stack:e?.stack})}
}