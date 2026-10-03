import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { discoveryBySlug } from "@/src/seo/catalog";
import { hotels } from "@/src/data/hotels";

export const size={width:1200,height:630};
export const contentType="image/png";

export default async function Image({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const page=discoveryBySlug(slug);
  if(!page) notFound();
  const matches=hotels.filter(page.filter).sort((a,b)=>(b.score/b.monthly)-(a.score/a.monthly)).slice(0,4);

  return new ImageResponse(
    <div style={{display:"flex",width:"100%",height:"100%",padding:62,background:"#fbf7ef",color:"#0a1630",flexDirection:"column",justifyContent:"space-between"}}>
      <div style={{display:"flex",fontSize:20,fontWeight:900,letterSpacing:3}}>ATLAS · RETIREMENT EVERYWHERE</div>
      <div style={{display:"flex",fontSize:76,fontWeight:900,letterSpacing:-4,lineHeight:1}}>{page.headline}</div>
      <div style={{display:"flex",gap:14}}>
        {matches.map(h=><div key={h.id} style={{display:"flex",background:"#0a1630",color:"white",padding:"14px 17px",borderRadius:16,fontSize:23}}>{h.flag} {h.city} · €{h.monthly}/mo</div>)}
      </div>
    </div>,size
  );
}
