"use client";

import { useEffect,useState } from "react";
import type { LiveCatalogOffer } from "@/src/core/live-offers";
import { growthEvent } from "@/src/growth/client";

const euro=(n:number,currency:string)=>new Intl.NumberFormat("en-US",{style:"currency",currency,maximumFractionDigits:0}).format(n);

export default function LiveOffers(){
  const [offers,setOffers]=useState<LiveCatalogOffer[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [configured,setConfigured]=useState(false);

  useEffect(()=>{
    let alive=true;
    fetch("/api/catalog/live?limit=12",{cache:"no-store"})
      .then(r=>r.ok?r.json():null)
      .then(data=>{
        if(!alive) return;
        const rows=Array.isArray(data?.offers)?data.offers:[];
        setConfigured(Boolean(data?.configured));
        setOffers(rows);
        setLoaded(true);
        if(rows.length) growthEvent("live_catalog_loaded",{count:rows.length});
      })
      .catch(()=>{if(alive)setLoaded(true);});
    return()=>{alive=false;};
  },[]);

  if(!loaded) return <section className="discovery liveDiscovery"><div className="shell"><div className="card"><b>LIVE SUPPLY LANE</b><p>Checking the truth-gated commercial catalogue…</p></div></div></section>;

  if(!offers.length) return <section className="discovery liveDiscovery">
    <div className="shell">
      <div className="sectionTitle">
        <h2>Live supply lane.<br/>Nothing hidden.</h2>
        <p>The live catalogue never falls back to demo inventory. If no verified commercial offers exist, we show the state explicitly.</p>
      </div>
      <div className="card">
        <div className="eyebrow">{configured?"DATABASE ONLINE":"SOFTWARE READY"}</div>
        <h3 style={{fontSize:28,marginBottom:8}}>{configured?"Waiting for the first SELLABLE provider wave.":"Production data plane not connected on this environment."}</h3>
        <p style={{color:"#68738b"}}>{configured?"Booking / RateHawk / HBX evidence must pass the Truth Gate before anything appears here.":"The adapters, evidence ledger, sellability gate and referral path are compiled and tested; external DB/provider credentials are still required."}</p>
        <a className="btn ghost" href="/system">Open full-system proof →</a>
      </div>
    </div>
  </section>;

  return <section className="discovery liveDiscovery">
    <div className="shell">
      <div className="sectionTitle">
        <h2>Live. Verified.<br/>Bookable paths.</h2>
        <p>These offers passed provider evidence, freshness and fulfilment gates. The price shown comes from the stored verified snapshot, never from an LLM.</p>
      </div>
      <div className="hotels">
        {offers.map((o,index)=><article className="hotel liveHotel" key={o.offerId}>
          <div className="hotelVisual"><span className="flag">✓</span><span className="score">LIVE {Math.round(o.confidence*100)}%</span></div>
          <div className="hotelBody">
            <h3>{o.name}</h3>
            <div className="loc">{o.city}, {o.country} · {o.provider} · verified {new Date(o.verifiedAt).toLocaleString()}</div>
            <div className="chips"><span className="chip">{o.nights} nights</span>{o.board&&<span className="chip">{o.board}</span>}<span className="chip">{o.checkIn} → {o.checkOut}</span></div>
            <div className="priceRow">
              <div><b>{euro(o.monthlyEquivalent,o.currency)}</b><small>/30-day equivalent · total {euro(o.displayPrice,o.currency)}</small></div>
              <a className="linkbtn" href={"/api/referral?offer="+encodeURIComponent(o.offerId)+"&from=%2Flive&pos="+(index+1)}>Open verified offer →</a>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  </section>;
}
