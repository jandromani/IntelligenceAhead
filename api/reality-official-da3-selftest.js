import { Client, handle_file } from "@gradio/client";
export const maxDuration=300;
function fileUrl(x){if(!x)return null;if(typeof x==="string")return x;return x.url||x.path||x.video?.url||x.video?.path||null;}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const source="https://depth-anything-depth-anything-3.hf.space";
  const imgs=[
    "https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/assets/examples/SOH/000.png",
    "https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/assets/examples/SOH/010.png"
  ];
  try{
    const t0=Date.now(),app=await Client.connect(source);
    const up=await app.predict("/handle_uploads",{input_video:null,input_images:imgs.map(x=>handle_file(x)),s_time_interval:1});
    const target=up?.data?.[1]; if(!target)throw new Error("No target_dir");
    const rec=await app.predict("/gradio_demo",{
      target_dir:target,show_cam:false,filter_black_bg:false,filter_white_bg:false,
      process_res_method:"low_res",save_percentage:10,num_max_points:1000,
      infer_gs:true,gs_trj_mode:"smooth",gs_video_quality:"low"
    });
    const d=rec?.data||[];
    res.status(200).json({
      ok:true,elapsed_s:(Date.now()-t0)/1000,outputs:d.length,
      model3d:fileUrl(d[0]),gsVideoA:fileUrl(d[6]),gsVideoB:fileUrl(d[7]),
      log:String(d[1]||"").slice(0,3000)
    });
  }catch(e){res.status(500).json({ok:false,error:String(e),stack:e?.stack});}
}