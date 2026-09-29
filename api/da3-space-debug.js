export default async function handler(req,res){
 const url='https://huggingface.co/spaces/justinmeans/DA3-GaussianSplat/resolve/main/app.py';
 try{
   const r=await fetch(url,{headers:{'user-agent':'reality-compiler/4.0'}});
   const src=await r.text();
   const needles=['def gradio_demo','def handle_uploads','gr.Examples','reconstruct_btn','infer_gs'];
   const snippets={};
   for(const n of needles){
     const i=src.indexOf(n);
     snippets[n]=i<0?null:src.slice(Math.max(0,i-1800),Math.min(src.length,i+7000));
   }
   res.setHeader('Cache-Control','no-store');
   res.status(200).json({status:r.status,length:src.length,snippets});
 }catch(e){res.status(500).json({error:String(e)})}
}