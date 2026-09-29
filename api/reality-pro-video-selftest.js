import { Client, handle_file } from "@gradio/client";
export const maxDuration = 120;
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const source="https://justinmeans-da3-gaussiansplat.hf.space";
  const videoUrl="https://github.com/gradio-app/gradio/raw/main/gradio/media_assets/videos/world.mp4";
  try{
    const app=await Client.connect(source);
    const out=await app.predict("/handle_uploads",{
      input_video:{video:handle_file(videoUrl),subtitles:null},
      input_images:null,
      s_time_interval:1
    });
    const d=out?.data||[];
    res.status(200).json({
      ok:true,target_dir:d[1]||null,
      galleryCount:Array.isArray(d[2])?d[2].length:null,
      log:d[3]||null
    });
  }catch(e){res.status(500).json({ok:false,error:String(e),stack:e?.stack});}
}