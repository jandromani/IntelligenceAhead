import { ImageResponse } from "next/og";
import { hotels } from "@/src/data/hotels";
import { buildPlan, planTotals } from "@/src/core/planner";
import { decodePlanToken } from "@/src/core/share";

export const size={width:1200,height:630};
export const contentType="image/png";

export default async function Image({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const input=decodePlanToken(token);
  const fallback=<div style={{display:"flex",width:"100%",height:"100%",background:"#0a1630",color:"white",alignItems:"center",justifyContent:"center",fontSize:64,fontWeight:900}}>ATLAS</div>;
  if(!input) return new ImageResponse(fallback,size);

  const income=input.pension+input.rent+input.other;
  const budget=Math.round(income*input.share/100);
  const plan=buildPlan(hotels,budget,input.party,input.duration,input.mode);
  const totals=planTotals(plan);
  const avg=Math.round(totals.total/Math.max(1,totals.days/30));
  const euro="€"+avg.toLocaleString("en-US");

  return new ImageResponse(
    <div style={{display:"flex",width:"100%",height:"100%",padding:64,background:"#0a1630",color:"white",flexDirection:"column",justifyContent:"space-between"}}>
      <div style={{display:"flex",fontSize:22,fontWeight:800,letterSpacing:3,color:"#c8ff6a"}}>YOU RETIRED FROM WORK. NOT FROM THE WORLD.</div>
      <div style={{display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",fontSize:86,fontWeight:900,letterSpacing:-5}}>Could you live like this?</div>
        <div style={{display:"flex",fontSize:72,fontWeight:900,color:"#c8ff6a"}}>{euro}/month</div>
      </div>
      <div style={{display:"flex",gap:18,fontSize:25}}>
        {plan.slice(0,4).map(s=><div key={s.hotel.id} style={{display:"flex",background:"#12264b",padding:"14px 18px",borderRadius:16}}>{s.hotel.flag} {s.hotel.city}</div>)}
      </div>
    </div>,
    size
  );
}
