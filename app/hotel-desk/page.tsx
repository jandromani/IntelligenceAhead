import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { listHotelDesk } from "@/src/db/direct-supply";

export const metadata={title:"Hotel Desk",robots:{index:false,follow:false}};

export default async function HotelDesk(){
  const jar=await cookies();
  const configured=process.env.OPS_ACCESS_KEY;
  if(!configured||jar.get("atlas_ops")?.value!==configured) notFound();
  const desk=await listHotelDesk();

  return <main className="controlPage"><div className="shell">
    <a className="eyebrow" style={{color:"#0a1630"}} href="/control">← Control Tower</a>
    <h1>HOTEL DESK</h1>
    <p style={{color:"#91a0b8",maxWidth:820}}>Direct long-stay contracting. Discovery is not publication: rates remain DRAFT until contract evidence and a booking path exist.</p>

    <div className="metrics">
      <div className="metricDark"><b>{desk.leads.length}</b><span>hotel leads</span></div>
      <div className="metricDark"><b>{desk.rates.length}</b><span>direct rate records</span></div>
      <div className="metricDark"><b>{desk.rates.filter((r:any)=>r.contract_verified).length}</b><span>contract verified</span></div>
      <div className="metricDark"><b>{desk.rates.filter((r:any)=>r.publication_state==="READY_FOR_REVIEW").length}</b><span>ready for truth review</span></div>
    </div>

    <h2 style={{marginTop:36}}>Leads</h2>
    <div className="table">
      {desk.leads.length?desk.leads.map((l:any)=><div className="tr" key={l.id}><b>{l.hotel_name}</b><span>{l.city}, {l.country}</span><span>{l.contact_role||"—"}</span><span>{l.status}</span></div>):<div className="tr"><b>No leads yet</b><span>Use /api/hotel-desk/leads</span><span>—</span><span className="amber">WAITING</span></div>}
    </div>

    <h2 style={{marginTop:36}}>LONG rates</h2>
    <div className="table">
      {desk.rates.length?desk.rates.map((r:any)=><div className="tr" key={r.id}><b>{r.hotel_name} · {r.rate_code}</b><span>{r.min_nights}–{r.max_nights||"∞"} nights</span><span>{r.currency} {Math.round(r.monthly_price)}/mo</span><span className={r.publication_state==="READY_FOR_REVIEW"?"green":"amber"}>{r.publication_state}</span></div>):<div className="tr"><b>No direct rates yet</b><span>LONG30/60/90/180</span><span>—</span><span className="amber">DRAFT</span></div>}
    </div>
  </div></main>;
}
