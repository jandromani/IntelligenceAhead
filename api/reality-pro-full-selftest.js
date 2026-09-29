import { Client, handle_file } from "@gradio/client";
export const maxDuration = 300;

function fileUrl(x){
  if(!x)return null;
  if(typeof x==="string")return x;
  return x.url||x.path||x.video?.url||x.video?.path||null;
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const source="https://justinmeans-da3-gaussiansplat.hf.space";
  const imgs=[
    "https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/assets/examples/SOH/000.png",
    "https://raw.githubusercontent.com/ByteDance-Seed/Depth-Anything-3/main/assets/examples/SOH/010.png"
  ];
  try{
    const t0=Date.now();
    const app=await Client.connect(source);
    const up=await app.predict("/handle_uploads",{
      input_video:null,
      input_images:imgs.map(x=>handle_file(x)),
      s_time_interval:8
    });
    const ud=up?.data||[];
    const target=ud[1];
    if(!target)throw new Error("Upload returned no target_dir");
    const rec=await app.predict("/gradio_demo",{
      target_dir:target,
      show_cam:false,
      filter_black_bg:false,
      filter_white_bg:false,
      process_res_method:"low_res",
      save_percentage:10,
      num_max_points:1000,
      infer_gs:true,
      gs_trj_mode:"smooth",
      gs_video_quality:"low"
    });
    const d=rec?.data||[];
    const ply=fileUrl(d[10]);
    let plyStatus=null,plyBytes=null;
    if(ply){
      const r=await fetch(ply,{method:"HEAD"}).catch(()=>null);
      if(r){plyStatus=r.status;plyBytes=Number(r.headers.get("content-length")||0)||null;}
    }
    return res.status(200).json({
      ok:true,elapsed_s:(Date.now()-t0)/1000,target,
      uploadViews:Array.isArray(ud[2])?ud[2].length:null,
      outputs:d.length,
      ply,plyStatus,plyBytes,
      log:String(d[1]||"").slice(0,2500),
      gsMessage:String(d[8]||"").slice(0,1500)
    });
  }catch(e){
    return res.status(500).json({ok:false,error:String(e),stack:e?.stack});
  }
}