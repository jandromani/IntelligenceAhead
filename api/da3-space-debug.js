export default async function handler(req,res){
  const targets=[
    'https://justinmeans-da3-gaussiansplat.hf.space/config',
    'https://justinmeans-da3-gaussiansplat.hf.space/info',
    'https://justinmeans-da3-gaussiansplat.hf.space/gradio_api/info'
  ];
  const out=[];
  for(const url of targets){
    try{
      const r=await fetch(url,{headers:{'user-agent':'reality-compiler/4.0'}});
      const text=await r.text();
      out.push({url,status:r.status,ok:r.ok,contentType:r.headers.get('content-type'),head:text.slice(0,4000)});
    }catch(e){out.push({url,error:String(e)})}
  }
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({time:new Date().toISOString(),out});
}