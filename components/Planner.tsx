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
import SilverSearch from "@/components/SilverSearch";
import SilverHotelCard from "@/components/SilverHotelCard";
import SilverPromise from "@/components/SilverPromise";

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
  const affordableCount = useMemo(() => hotels.filter(h => adjustedMonthly(h,party) <= livingBudget).length, [hotels,livingBudget,party]);

  useEffect(() => {
    growthEvent("planner_loaded", { catalogue_size: hotels.length, hero_variant:heroVariant });
  }, [hotels.length]);

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = hotels.filter(h => (region === "All" || h.region === region) && (!q || [h.name,h.city,h.country,...h.tags].join(" ").toLowerCase().includes(q)));
    return list.sort((a,b) => sort === "price" ? adjustedMonthly(a,party)-adjustedMonthly(b,party) : sort === "score" ? b.score-a.score : (b.score / adjustedMonthly(b,party)) - (a.score / adjustedMonthly(a,party)));
  }, [hotels, query, region, sort, party]);

  function jumpToExplore(){
    growthEvent("hero_search",{query,region,party,duration,budget:livingBudget});
    document.getElementById("explore")?.scrollIntoView({behavior:"smooth"});
  }

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
          <a className="brand" href="#">ATLAS<span>LONG STAY</span></a>
          <nav className="navlinks">
            <a href="#explore">Stays</a>
            <a href="#planner">Build my year</a>
            <a href="#agent">Ask Atlas</a>
            <a className="btn" href="#explore">Find a stay →</a>
          </nav>
        </div>
      </header>

      <section className="hero silverHero">
        <div className="shell">
          <div className="eyebrow"><i className="dot"/> LONG-STAY HOTEL LIVING · 30–180 DAYS</div>
          <h1>Live somewhere better.<br/><em>Stay for a season.</em></h1>
          <p className="heroLead">Compare long-stay hotels by monthly cost, not nightly rate. Build a flexible life around the budget you already have.</p>
          <SilverSearch query={query} setQuery={setQuery} region={region} setRegion={setRegion} duration={duration} setDuration={setDuration} party={party} setParty={setParty} count={affordableCount} onSearch={jumpToExplore}/>
          <div className="proof silverProof">
            <div className="proofCard"><b>€ / month</b><span>compare living cost, not a weekend</span></div>
            <div className="proofCard"><b>30–180 days</b><span>one month, one season or longer</span></div>
            <div className="proofCard"><b>Silver Score</b><span>comfort and value signals</span></div>
            <div className="proofCard"><b>Truth-gated</b><span>verified offers stay separate from demos</span></div>
          </div>
        </div>
      </section>

      <section className="howBand">
        <div className="shell howGrid">
          <div><span>01</span><b>Set your monthly reality</b><p>Tell Atlas how much you want to spend and how long you want to stay.</p></div>
          <div><span>02</span><b>Compare months, not nights</b><p>Filter by climate, food, walkability, sea, pool and healthcare access.</p></div>
          <div><span>03</span><b>Live there. Then move.</b><p>Build the year one 30–90 day stay at a time.</p></div>
        </div>
      </section>

      <section id="planner" className="dark">
        <div className="shell">
          <div className="sectionTitle">
            <h2>Build your<br/>living budget.</h2>
            <p>Your monthly budget becomes a route. AI can help explain choices, but live prices and sellability remain evidence-controlled.</p>
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
          <div className="sectionTitle"><h2>Long-stay hotels<br/>for your budget.</h2><p>Filter by what matters when you are actually living somewhere: monthly cost, climate, board, walkability, sea, pool and healthcare access.</p></div>
          <div className="toolbar">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search city, country, pool, sea, clinic…"/>
            <select value={region} onChange={e=>setRegion(e.target.value)}><option>All</option><option>Europe</option><option>Asia</option><option>Africa</option><option>Americas</option></select>
            <select value={sort} onChange={e=>setSort(e.target.value)}><option value="value">Best value</option><option value="price">Lowest monthly</option><option value="score">Silver score</option></select>
          </div>
          <div className="hotels">
            {visible.map(h => <SilverHotelCard key={h.id} hotel={h} party={party} duration={duration}/>)}
          </div>
        </div>
      </section>

      <section id="agent" className="agentBand">
        <div className="shell">
          <div className="sectionTitle"><h2>Ask Atlas.<br/>Your long-stay concierge.</h2><p>Ask for warm sea, healthcare and a maximum monthly budget. Atlas can shortlist and explain while verified prices remain evidence-controlled.</p></div>
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

      <SilverPromise />
      <footer className="footer"><div className="shell footerGrid"><span>ATLAS · LONG-STAY LIVING</span><span>Prototype catalogue is clearly marked until live provider inventory is connected.</span><a href="/system">System proof</a></div></footer>
    </>
  );
}
