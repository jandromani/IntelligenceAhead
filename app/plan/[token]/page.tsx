import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hotels } from "@/src/data/hotels";
import { buildPlan, planTotals } from "@/src/core/planner";
import { decodePlanToken } from "@/src/core/share";

const euro=(n:number)=>"€"+Math.round(n).toLocaleString("en-US");

export async function generateMetadata({params}:{params:Promise<{token:string}>}):Promise<Metadata>{
  const {token}=await params;
  const input=decodePlanToken(token);
  if(!input) return {title:"Shared life plan",robots:{index:false,follow:false}};
  const income=input.pension+input.rent+input.other;
  const budget=Math.round(income*input.share/100);
  const plan=buildPlan(hotels,budget,input.party,input.duration,input.mode);
  const totals=planTotals(plan);
  const avg=Math.round(totals.total/Math.max(1,totals.days/30));

  return{
    title:`A year around the world for about ${euro(avg)}/month`,
    description:`A ${totals.days}-night retirement-living route generated from a recurring-income budget.`,
    robots:{index:false,follow:true},
    openGraph:{
      title:`Could you live like this for ${euro(avg)}/month?`,
      description:"A shareable retirement-living route. Copy it, change the numbers and build your own.",
      type:"website",
    }
  };
}

export default async function SharedPlan({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const input=decodePlanToken(token);
  if(!input) notFound();

  const income=input.pension+input.rent+input.other;
  const budget=Math.round(income*input.share/100);
  const plan=buildPlan(hotels,budget,input.party,input.duration,input.mode);
  const totals=planTotals(plan);
  const avg=Math.round(totals.total/Math.max(1,totals.days/30));

  return <main className="seoPage">
    <div className="shell">
      <a href="/" className="eyebrow">ATLAS · SHARED LIFE</a>
      <section className="seoHero" style={{marginTop:20}}>
        <div className="eyebrow">COULD YOU LIVE LIKE THIS?</div>
        <h1 style={{marginTop:20}}>{totals.days} nights.<br/>{euro(avg)}/month.</h1>
        <p style={{fontSize:20,maxWidth:720}}>This is not a booking. It is a shareable life scenario built from recurring income, long stays and a flexible calendar.</p>
        <div className="heroActions">
          <a className="btn" href={"/?plan="+encodeURIComponent(token)}>Copy this life →</a>
          <a className="btn ghost" href="/">Start from zero</a>
        </div>
      </section>

      <div className="seoGrid">
        <div className="card">
          <div className="eyebrow">THE ROUTE</div>
          <div className="route" style={{marginTop:16}}>
            {plan.map((s,i)=><div className="stop" key={s.hotel.id}>
              <div className="when">STOP {String(i+1).padStart(2,"0")}</div>
              <div><b>{s.hotel.flag} {s.hotel.city}</b><small>{s.days} nights · {s.hotel.board} · Silver {s.hotel.score}</small></div>
              <div className="cost">{euro(s.monthlyCost)}/mo</div>
            </div>)}
          </div>
        </div>
        <div className="card">
          <div className="eyebrow">THE NUMBERS</div>
          <h2 style={{fontSize:44,letterSpacing:"-.05em",marginBottom:6}}>{euro(income)}<small style={{fontSize:13,color:"#68738b"}}>/month income</small></h2>
          <p>Living allocation: <b>{input.share}%</b></p>
          <p>Route hotel + transport estimate: <b>{euro(totals.total)}</b></p>
          <p>Cadence: <b>{input.duration} days</b></p>
          <p>Travelling: <b>{input.party}</b></p>
          <p style={{fontSize:12,color:"#68738b"}}>Prototype economics. Live availability and price must pass provider verification before a commercial offer is displayed.</p>
        </div>
      </div>
    </div>
  </main>;
}
