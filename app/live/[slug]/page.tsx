import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { hotelBySlug, hotels } from "@/src/data/hotels";
import { evaluateSellability } from "@/src/core/truth";

export function generateStaticParams() {
  return hotels.map(h=>({slug:h.slug}));
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}): Promise<Metadata> {
  const {slug} = await params;
  const hotel = hotelBySlug(slug);
  if (!hotel) return {};
  return {
    title: hotel.city + " long stay",
    description: "Explore a 30–90 day retirement-living scenario in " + hotel.city + " with monthly-cost framing and Silver Score.",
    robots:{ index:false, follow:true },
  };
}

export default async function LifePage({params}:{params:Promise<{slug:string}>}) {
  const {slug} = await params;
  const h = hotelBySlug(slug);
  if (!h) notFound();
  const truth = evaluateSellability(h);

  return <main className="seoPage">
    <div className="shell">
      <a href="/" className="eyebrow">← Atlas world explorer</a>
      <section className="seoHero" style={{marginTop:20}}>
        <div style={{fontSize:48}}>{h.flag}</div>
        <h1>Live in {h.city}<br/>for a season.</h1>
        <p style={{fontSize:20,maxWidth:700}}>{h.name} · {h.board} · {h.climate}. This is a prototype life scenario, not a live hotel offer.</p>
      </section>
      <div className="seoGrid">
        <div className="card">
          <div className="eyebrow">DEMO ECONOMICS</div>
          <h2 style={{fontSize:46,letterSpacing:"-.05em",marginBottom:8}}>€{h.monthly.toLocaleString("en-US")}<small style={{fontSize:14,color:"#68738b"}}>/month seed</small></h2>
          <p>30 days: €{h.monthly.toLocaleString("en-US")} · 60 days: €{(h.monthly*2).toLocaleString("en-US")} · 90 days: €{(h.monthly*3).toLocaleString("en-US")}</p>
          <div className="chips">{h.tags.map(t=><span className="chip" key={t}>{t}</span>)}</div>
          <a className="btn" href={"/api/referral?hotel="+h.slug+"&provider="+h.provider}>Search externally →</a>
        </div>
        <div className="card">
          <div className="eyebrow">TRUTH RECORD</div>
          <h2>Silver Score {h.score}</h2>
          <p>Provider surface target: <b>{h.provider}</b></p>
          <p>Commercial state: <b>{truth.state}</b></p>
          <p>Commercial confidence: <b>{Math.round(truth.confidence*100)}%</b></p>
          <p>Reason: <b>{truth.reasons.join(", ")}</b></p>
          <p style={{color:"#68738b",fontSize:12}}>A live offer will only become SELLABLE after provider quote evidence, provenance hash, freshness and a commercial deep link all pass the deterministic gate.</p>
        </div>
      </div>
    </div>
  </main>
}
