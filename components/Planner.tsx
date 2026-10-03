"use client";

import { useEffect, useMemo, useState } from "react";
import type { Hotel } from "@/src/data/hotels";
import { adjustedMonthly, buildPlan, planTotals, type Party, type PlanMode } from "@/src/core/planner";
import { growthEvent } from "@/src/growth/client";
import { encodePlanToken, type SharedPlanInput } from "@/src/core/share";
import { HERO_VARIANTS, type HeroVariant } from "@/src/growth/experiments";
import WorldMap from "@/components/WorldMap";
import LiveOffers from "@/components/LiveOffers";
import VerifiedRoute from "@/components/VerifiedRoute";

const euro = (n: number) => "€" + Math.round(n).toLocaleString("en-US");

export default function Planner({ hotels, initial, heroVariant="freedom" }: { hotels: Hotel[]; initial?: Partial<SharedPlanInput>; heroVariant?: HeroVariant }) {
  const [pension, setPension] = useState(initial?.pension ?? 1700);
  const [rent, setRent] = useState(initial?.rent ?? 1300);
  const [other, setOther] = useState(initial?.other ?? 200);
  const [share, setShare] = useState(initial?.share ?? 64);
  const [party, setParty] = useState<Party>(initial?.party ?? "solo");
  const [duration, setDuration] = useState<30|60|90>(initial?.duration ?? 90);
  const [mode, setMode] = useState<PlanMode>(initial?.mode ?? "world");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");
  const [sort, setSort] = useState("value");
  const [chat, setChat] = useState<{role:"user"|"ai";text:string}[]>([
    { role: "ai", text: "Tell me how you want the next year of your life to feel. I can use the current catalogue to suggest a route." }
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share this life");

  const hero=HERO_VARIANTS[heroVariant];
  const income = pension + rent + other;
  const livingBudget = Math.round(income * share / 100);
  const plan = useMemo(() => buildPlan(hotels, livingBudget, party, duration, mode), [hotels, livingBudget, party, duration, mode]);
  const totals = useMemo(() => planTotals(plan), [plan]);
  const avg = Math.round(totals.total / Math.max(1, totals.days / 30));

  useEffect(() => {
    growthEvent("planner_loaded", { catalogue_size: hotels.length, hero_variant:heroVariant });
  }, [hotels.length]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = hotels.filter(h => (region === "All" || h.region === region) && (!q || [h.name,h.city,h.country,...h.tags].join(" ").toLowerCase().includes(q)));
    return list.sort((a,b) => sort === "price" ? adjustedMonthly(a,party)-adjustedMonthly(b,party) : sort === "score" ? b.score-a.score : (b.score / adjustedMonthly(b,party)) - (a.score / adjustedMonthly(a,party)));
  }, [hotels, query, region, sort, party]);

  async function sharePlan() {
    const token=encodePlanToken({pension,rent,other,share,party,duration,mode});
    const url=window.location.origin+"/plan/"+token;
    growthEvent("route_shared",{mode,party,duration,budget:livingBudget});
    try{
      if(navigator.share){
        await navigator.share({title:"Could you live like this?",text:"My retirement-life route",url});
        setShareLabel("Shared ✓");
      }else{
        await navigator.clipboard.writeText(url);
        setShareLabel("Link copied ✓");
      }
    }catch{
      setShareLabel("Share this life");
    }
  }

  async function askAgent() {
    const prompt = draft.trim();
    if (!prompt || thinking) return;
    growthEvent("agent_question", { mode, party, duration, budget: livingBudget });
    setChat(v => [...v, {role:"user",text:prompt}]);
    setDraft("");
    setThinking(true);
    try {
      const res = await fetch("/api/agent", {
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({ prompt, income, livingBudget, party, duration, mode })
      });
      const data = await res.json();
      setChat(v => [...v, {role:"ai",text:data.answer || data.error || "Agent temporarily unavailable."}]);
    } catch {
      setChat(v => [...v, {role:"ai",text:"Agent temporarily unavailable. The deterministic planner is still working."}]);
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      <header className="nav">
        <div className="shell navin">
          <a className="brand" href="#">ATLAS<span>LAB</span></a>
          <nav className="navlinks">
            <a href="#planner">Build my year</a>
            <a href="#explore">Explore</a>
            <a href="#agent">AI concierge</a>
            <a href="/system">System proof</a>
            <a className="btn" href="#planner">Build my year →</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="shell">
          <div className="eyebrow"><i className="dot"/> {hero.eyebrow}</div>
          <h1>{hero.line1}<br/><em>{hero.line2}</em></h1>
          <p>{hero.lead}</p>
          <div className="heroActions">
            <a className="btn" href="#planner">See what my retirement buys →</a>
            <a className="btn ghost" href="#explore">Browse 30 places</a>
          </div>
          <div className="actions" style={{marginTop:18}}>
            <a className="btn ghost" href="/discover/under-1500-month">Under €1,500</a>
            <a className="btn ghost" href="/discover/winter-sun">Winter sun</a>
            <a className="btn ghost" href="/discover/all-inclusive">All inclusive</a>
          </div>
          <div className="proof">
            <div className="proofCard"><b>30–180 days</b><span>the unit is a season, not a night</span></div>
            <div className="proofCard"><b>30 places</b><span>seed catalogue across 4 regions</span></div>
            <div className="proofCard"><b>1 click ledger</b><span>every outbound offer is attributable</span></div>
            <div className="proofCard"><b>Truth-gated</b><span>nothing sells just because an agent says so</span></div>
          </div>
        </div>
      </section>

      <section id="planner" className="dark">
        <div className="shell">
          <div className="sectionTitle">
            <h2>What does your<br/>retirement buy?</h2>
            <p>The planner is deterministic. AI can explain and suggest; it cannot invent a price or mark an offer sellable.</p>
          </div>
          <WorldMap hotels={hotels} route={plan.map(s=>s.hotel)} />
          <div className="grid2">
            <div className="card">
              {[
                ["Monthly pension", pension, setPension, 800, 5000],
                ["Net income from home", rent, setRent, 0, 4500],
                ["Other recurring income", other, setOther, 0, 2500],
              ].map(([label,value,setter,min,max]) => (
                <div className="control" key={String(label)}>
                  <div className="label"><span>{String(label)}</span><b>{euro(Number(value))}</b></div>
                  <input type="range" min={Number(min)} max={Number(max)} step="50" value={Number(value)} onChange={e => (setter as (x:number)=>void)(Number(e.target.value))}/>
                </div>
              ))}
              <div className="control">
                <div className="label"><span>Living budget allocation</span><b>{share}%</b></div>
                <input type="range" min="45" max="90" value={share} onChange={e=>setShare(Number(e.target.value))}/>
              </div>
              <div className="control">
                <div className="label"><span>Travelling as</span><b>{party}</b></div>
                <div className="segment">
                  <button className={party==="solo"?"active":""} onClick={()=>setParty("solo")}>Solo</button>
                  <button className={party==="couple"?"active":""} onClick={()=>setParty("couple")}>Couple</button>
                </div>
              </div>
              <div className="control">
                <div className="label"><span>Move every</span><b>{duration} days</b></div>
                <div className="segment">
                  {[30,60,90].map(d=><button key={d} className={duration===d?"active":""} onClick={()=>setDuration(d as 30|60|90)}>{d}d</button>)}
                </div>
              </div>
            </div>

            <div className="card">
              <div className="moneyline">
                <div><div className="label"><span>YOUR GENERATED LIFE BUDGET</span></div><div className="money">{euro(avg)}<small>/month est.</small></div></div>
                <div className="surplus"><span>monthly headroom</span><b>{euro(Math.max(0,income-avg))}</b></div>
              </div>
              <div className="actions">
                {([["world","World tour"],["winter","Winter sun"],["value","Max value"],["slow","Slow Europe"]] as [PlanMode,string][]).map(([m,l])=>
                  <button className={"btn "+(mode===m?"lime":"ghost")} key={m} onClick={()=>{ setMode(m); growthEvent("route_strategy_selected", { mode:m, budget:livingBudget, party, duration }); }}>{l}</button>
                )}
              </div>
              <div className="actions"><button className="btn lime" onClick={sharePlan}>{shareLabel}</button></div>
              <div className="route">
                {plan.slice(0,6).map((s,i)=><div className="stop" key={s.hotel.id}>
                  <div className="when">STOP {String(i+1).padStart(2,"0")}</div>
                  <div><b>{s.hotel.flag} {s.hotel.city}</b><small>{s.days} nights · {s.hotel.board} · score {s.hotel.score}{s.transportMode!=="start"?" · "+s.transportMode+" ~"+s.transportDistanceKm.toLocaleString()+" km / "+euro(s.transport):""}</small></div>
                  <div className="cost">{euro(s.monthlyCost)}/mo</div>
                </div>)}
              </div>
              <div className="label" style={{marginTop:14}}>
                <span>{totals.days} nights · mobility estimate {euro(totals.transportTotal)}</span>
                <b>{euro(totals.total)} total</b>
              </div>
            </div>
          </div>
          <VerifiedRoute monthlyBudget={livingBudget} />
        </div>
      </section>

      <LiveOffers />

      <section id="explore" className="discovery">
        <div className="shell">
          <div className="sectionTitle"><h2>Explore the world<br/>by monthly cost.</h2><p>These are prototype seed prices used to exercise the architecture. The production path replaces them with live provider quotes and direct long-stay rates.</p></div>
          <div className="toolbar">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search city, country, pool, sea, clinic…"/>
            <select value={region} onChange={e=>setRegion(e.target.value)}><option>All</option><option>Europe</option><option>Asia</option><option>Africa</option><option>Americas</option></select>
            <select value={sort} onChange={e=>setSort(e.target.value)}><option value="value">Best value</option><option value="price">Lowest monthly</option><option value="score">Silver score</option></select>
          </div>
          <div className="hotels">
            {visible.map(h => {
              const p = adjustedMonthly(h,party);
              return <article className="hotel" key={h.id}>
                <div className="hotelVisual"><span className="flag">{h.flag}</span><span className="score">SILVER {h.score}</span></div>
                <div className="hotelBody">
                  <h3>{h.name}</h3><div className="loc">{h.city}, {h.country} · demo scenario · not a live quote</div>
                  <div className="chips">{h.tags.slice(0,4).map(t=><span className="chip" key={t}>{t}</span>)}</div>
                  <div className="priceRow">
                    <div><b>{euro(p)}</b><small>/month · {h.board}</small></div>
                    <a className="linkbtn" href={"/api/referral?hotel="+encodeURIComponent(h.slug)+"&provider="+h.provider+"&from=%2Fexplore"}>Search externally →</a>
                  </div>
                  <div className="actions"><a className="btn ghost" href={"/live/"+h.slug}>Life page</a></div>
                </div>
              </article>
            })}
          </div>
        </div>
      </section>

      <section id="agent" className="agentBand">
        <div className="shell">
          <div className="sectionTitle"><h2>AI concierge.<br/>Evidence underneath.</h2><p>The agent can reason over your budget and the catalogue, but it cannot change truth-state, prices or attribution.</p></div>
          <div className="agentGrid">
            <div className="chat">
              <div className="chatlog">{chat.map((m,i)=><div className={"msg "+m.role} key={i}>{m.text}</div>)}</div>
              <div className="chatrow">
                <input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==="Enter"&&askAgent()} placeholder="e.g. I want warm sea, healthcare and max €1,600…"/>
                <button className="btn lime" onClick={askAgent}>{thinking?"…":"Ask"}</button>
              </div>
            </div>
            <div className="truth">
              <div className="metric"><b>30</b><span>catalogue records</span></div>
              <div className="metric"><b>3</b><span>provider adapters modelled</span></div>
              <div className="metric"><b>100%</b><span>outbound clicks through attribution endpoint</span></div>
              <div className="metric"><b>0</b><span>LLM-written prices allowed</span></div>
              <div className="metric"><b>4</b><span>route strategies</span></div>
              <div className="metric"><b>∞</b><span>SEO life pages once live supply is attached</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="vc">
        <div className="shell vcgrid">
          <div><div className="eyebrow" style={{color:"#0a1630"}}>THE THESIS</div><h2 style={{marginTop:22}}>An attention → intent → referral → revenue machine.</h2><p style={{fontSize:18,color:"#dce5ff"}}>Booking optimizes room nights. Atlas optimizes months of life — and monetizes the natural services around each decision without owning inventory.</p></div>
          <div className="vcbox">
            <div><b>Wedge</b>Curiosity-first retirement calculator</div>
            <div><b>Commerce</b>Tracked hotel / flight / insurance referrals</div>
            <div><b>Margin expansion</b>B2B net rates + direct long-stay supply</div>
            <div><b>Moat</b>Long-stay price history + Silver Score + intent graph</div>
            <div><b>Operating model</b>Deterministic core, agentic perimeter, external judges</div>
          </div>
        </div>
      </section>
      <footer className="footer"><div className="shell">ATLAS LAB · internal codename · prototype inventory is illustrative until provider credentials are connected.</div></footer>
    </>
  );
}
