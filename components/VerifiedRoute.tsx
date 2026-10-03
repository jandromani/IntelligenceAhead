"use client";

import { useEffect,useMemo,useState } from "react";
import type { LiveCatalogOffer } from "@/src/core/live-offers";

const money=(n:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(n);

export default function VerifiedRoute({monthlyBudget}:{monthlyBudget:number}){
  const [offers,setOffers]=useState<LiveCatalogOffer[]>([]);
  const [configured,setConfigured]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);

  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError(false);
    const timer=setTimeout(()=>{
      fetch("/api/catalog/live?limit=20&maxMonthly="+Math.max(1,Math.round(monthlyBudget)),{cache:"no-store",signal:controller.signal})
        .then(async r=>{if(!r.ok) throw new Error("catalog "+r.status);return r.json();})
        .then(data=>{setConfigured(Boolean(data?.configured));setOffers(Array.isArray(data?.offers)?data.offers:[]);setLoading(false);})
        .catch(e=>{if(e?.name!=="AbortError"){setError(true);setLoading(false);}});
    },250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[monthlyBudget]);

  const route=useMemo(()=>offers.slice(0,Math.min(6,offers.length)),[offers]);
  if(loading) return <div className="card" style={{marginTop:18}}><b>VERIFIED ROUTE ENGINE</b><p>Checking live SELLABLE inventory inside your budget…</p></div>;
  if(error) return <div className="card" style={{marginTop:18}}><b>VERIFIED ROUTE ENGINE · DEGRADED</b><p>The live catalog could not be reached. Your deterministic demo plan remains available above.</p></div>;
  if(!route.length) return <div className="card" style={{marginTop:18}}>
    <div className="eyebrow">{configured?"LIVE DATA PLANE ONLINE":"SOFTWARE READY"}</div>
    <h3 style={{fontSize:25,marginBottom:6}}>No verified route can be built yet.</h3>
    <p style={{color:"#68738b"}}>{configured?"No current SELLABLE offers fit "+money(monthlyBudget,"EUR")+"/month.":"Connect production DB + provider credentials and this lane automatically replaces assumptions with verified hotel offers."}</p>
  </div>;

  const avg=Math.round(route.reduce((s,o)=>s+o.monthlyEquivalent,0)/route.length);
  return <div className="card" style={{marginTop:18}}>
    <div className="moneyline">
      <div><div className="label"><span>VERIFIED ROUTE · LIVE INVENTORY</span></div><div className="money">{money(avg,route[0].currency)}<small>/month avg.</small></div></div>
      <div className="surplus"><span>offers inside budget</span><b>{offers.length}</b></div>
    </div>
    <div className="route">
      {route.map((o,i)=><div className="stop" key={o.offerId}>
        <div className="when">LIVE {String(i+1).padStart(2,"0")}</div>
        <div><b>✓ {o.city}, {o.country}</b><small>{o.nights} nights · {o.provider} · verified {new Date(o.verifiedAt).toLocaleDateString()}</small></div>
        <div className="cost"><a href={"/api/referral?offer="+encodeURIComponent(o.offerId)+"&from=%2Fplanner"}>{money(o.monthlyEquivalent,o.currency)}/mo →</a></div>
      </div>)}
    </div>
  </div>;
}
