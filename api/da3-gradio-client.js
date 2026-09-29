import { Client } from '@gradio/client';
export const config={maxDuration:120};

export default async function handler(req,res){
  try{
    const app=await Client.connect('https://justinmeans-da3-gaussiansplat.hf.space');
    const loaded=await app.predict('/lambda_5',{});
    const d=loaded?.data||[];
    const target=d[1];
    if(!target) throw new Error('Example did not return target_dir');
    const reconstructed=await app.predict('/gradio_demo',{
      target_dir:target,
      show_cam:true,
      filter_black_bg:false,
      filter_white_bg:false,
      process_res_method:'low_res',
      save_percentage:10,
      num_max_points:1000,
      infer_gs:Boolean(req.query.gs!=='0'),
      gs_trj_mode:'smooth',
      gs_video_quality:'low'
    });
    const out=reconstructed?.data||[];
    res.setHeader('Cache-Control','no-store');
    res.status(200).json({
      ok:true,target,
      loadedCount:d?.[2]?.length||0,
      reconstructedCount:out.length,
      outputs:out.map((v,i)=>({i,type:Array.isArray(v)?'array':typeof v,value:v}))
    });
  }catch(e){
    res.status(500).json({ok:false,error:String(e),stack:e?.stack});
  }
}