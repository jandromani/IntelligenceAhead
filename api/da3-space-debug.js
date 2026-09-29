export default async function handler(req,res){
 const root='https://huggingface.co/spaces/justinmeans/DA3-GaussianSplat/resolve/main/';
 const file=String(req.query.file||'app.py').replace(/^\/+/, '');
 try{
   const r=await fetch(root+file,{headers:{'user-agent':'reality-compiler/4.0'}});
   const src=await r.text();
   res.setHeader('Cache-Control','no-store');
   res.status(200).json({file,status:r.status,length:src.length,source:src.slice(0,100000)});
 }catch(e){res.status(500).json({error:String(e)})}
}