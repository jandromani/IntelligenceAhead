import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hotels } from "@/src/data/hotels";
import { DISCOVERY_PAGES, discoveryBySlug } from "@/src/seo/catalog";
import { seoGate } from "@/src/seo/gate";

const euro=(n:number)=>"€"+Math.round(n).toLocaleString("en-US");

export function generateStaticParams(){
  return DISCOVERY_PAGES.map(p=>({slug:p.slug}));
}

function evidenceFor(slug:string){
  const page=discoveryBySlug(slug);
  if(!page) return null;
  const matches=hotels.filter(page.filter);
  const gate=seoGate({
    liveIndexingEnabled:process.env.SEO_LIVE_INDEXING==="true",
    sellableHotels:matches.length,
    uniqueCountries:new Set(matches.map(h=>h.country)).size,
    hasFreshProviderEvidence:process.env.SEO_HAS_LIVE_PROVIDER_EVIDENCE==="true",
    uniqueNarrative:true,
  });
  return{page,matches,gate};
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const result=evidenceFor(slug);
  if(!result) return{};
  return{
    title:result.page.title,
    description:result.page.description,
    robots:{index:result.gate.index,follow:true},
    openGraph:{title:result.page.headline,description:result.page.description,type:"website"},
  };
}

export default async function Discovery({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const result=evidenceFor(slug);
  if(!result) notFound();
  const sorted=[...result.matches].sort((a,b)=>(b.score/b.monthly)-(a.score/a.monthly));

  return <main className="seoPage">
    <div className="shell">
      <a href="/" className="eyebrow">← WORLD EXPLORER</a>
      <section className="seoHero" style={{marginTop:20}}>
        <div className="eyebrow">{result.page.intent.toUpperCase().replaceAll("-"," ")}</div>
        <h1 style={{marginTop:20}}>{result.page.headline}</h1>
        <p style={{fontSize:20,maxWidth:740}}>{result.page.description}</p>
        {!result.gate.index && <p style={{fontSize:12,color:"#68738b"}}>Indexing is intentionally disabled until live provider evidence is attached. The page is usable as a product/SEM landing meanwhile.</p>}
      </section>

      <div className="hotels">
        {sorted.slice(0,12).map(h=><article className="hotel" key={h.id}>
          <div className="hotelVisual"><span className="flag">{h.flag}</span><span className="score">SILVER {h.score}</span></div>
          <div className="hotelBody">
            <h3>{h.city}</h3>
            <div className="loc">{h.country} · {h.name}</div>
            <div className="chips">{h.tags.slice(0,4).map(t=><span className="chip" key={t}>{t}</span>)}</div>
            <div className="priceRow">
              <div><b>{euro(h.monthly)}</b><small>/month prototype · {h.board}</small></div>
              <a className="linkbtn" href={"/api/referral?hotel="+h.slug+"&provider="+h.provider+"&from="+encodeURIComponent("/discover/"+slug)}>View →</a>
            </div>
          </div>
        </article>)}
      </div>
    </div>
  </main>;
}
