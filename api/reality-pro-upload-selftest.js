import { Client, handle_file } from "@gradio/client";
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const source="https://justinmeans-da3-gaussiansplat.hf.space";
  const imgs=[
    "https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/assets/examples/SOH/000.png",
    "https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/assets/examples/SOH/010.png"
  ];
  try{
    const app=await Client.connect(source);
    const out=await app.predict("/handle_uploads",{
      input_video:null,
      input_images:imgs.map(x=>handle_file(x)),
      s_time_interval:8
    });
    const data=out?.data||[];
    res.status(200).json({ok:true,target_dir:data[1]||null,galleryCount:Array.isArray(data[2])?data[2].length:null,log:data[3]||null,raw:data.slice(0,4)});
  }catch(e){
    res.status(500).json({ok:false,error:String(e),stack:e?.stack});
  }
}