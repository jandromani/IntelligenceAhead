import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AGENTS } from "@/src/agents/registry";
import { liveProviderStatuses } from "@/src/providers/live/registry";
import { databaseConfigured } from "@/src/db/client";
import { getOpsSnapshot } from "@/src/db/ops";

export const metadata={title:"Control Tower",robots:{index:false,follow:false}};

export default async function ControlTower(){
  const jar=await cookies();
  const configured=process.env.OPS_ACCESS_KEY;
  if(!configured || jar.get("atlas_ops")?.value!==configured) notFound();

  const providers=liveProviderStatuses();
  const ops=await getOpsSnapshot();
  const db=databaseConfigured();
  const agentConfigured=Boolean(process.env.OPENROUTER_API_KEY);

  return <main className="controlPage">
    <div className="shell">
      <a href="/" className="eyebrow" style={{color:"#0a1630"}}>← consumer experience</a>
      <h1>CONTROL TOWER 2.0</h1>
      <p style={{color:"#91a0b8",maxWidth:820}}>Private operating plane. These numbers are runtime truth, not marketing counters.</p>

      <div className="metrics">
        <div className="metricDark"><b className={db?"green":"amber"}>{db?"ONLINE":"OFFLINE"}</b><span>database</span></div>
        <div className="metricDark"><b className={agentConfigured?"green":"amber"}>{agentConfigured?"ONLINE":"OFFLINE"}</b><span>agent runtime</span></div>
        <div className="metricDark"><b className="green">{ops.liveOffers}</b><span>SELLABLE live offers</span></div>
        <div className="metricDark"><b>{ops.referralClicks30d}</b><span>referral clicks · 30d</span></div>
        <div className="metricDark"><b>€{Math.round(ops.commission30d).toLocaleString("en-US")}</b><span>commission · 30d</span></div>
      </div>

      <h2 style={{marginTop:36}}>Provider readiness</h2>
      <div className="table">
        <div className="tr"><b>Provider</b><b>Environment</b><b>Configured</b><b>Commercial gate</b></div>
        {providers.map(p=><div className="tr" key={p.provider}>
          <b>{p.provider}</b><span>{p.environment}</span><span className={p.configured?"green":"amber"}>{p.configured?"YES":"NO"}</span><span>{p.configured?"eligible for live probes":"waiting external credentials"}</span>
        </div>)}
      </div>

      <h2 style={{marginTop:36}}>Recent acquisition waves</h2>
      <div className="table">
        {ops.acquisitionRuns.length?ops.acquisitionRuns.map(r=><div className="tr" key={r.waveKey+r.startedAt}>
          <b>{r.waveKey}</b><span>{r.provider||"multi"}</span><span className={r.status==="COMPLETE"?"green":"amber"}>{r.status}</span><span>{r.sellable} sellable · {r.errors} errors</span>
        </div>):<div className="tr"><b>No persisted waves yet</b><span>DB {db?"online":"offline"}</span><span className="amber">WAITING</span><span>Run a live provider wave after credentials are attached.</span></div>}
      </div>

      <h2 style={{marginTop:36}}>Autonomous workforce</h2>
      <div className="table">
        {Object.values(AGENTS).map(a=><div className="tr" key={a.key}>
          <b>{a.key}</b><span>{a.reduces}</span><span>{a.requiredJudges.join(", ")}</span><span className="amber">€{a.maxExternalSpendEur} authority</span>
        </div>)}
      </div>

      <h2 style={{marginTop:36}}>Recent agent runs</h2>
      <div className="table">
        {ops.agentRuns.length?ops.agentRuns.map(r=><div className="tr" key={r.agentKey+r.startedAt}>
          <b>{r.agentKey}</b><span>{r.status}</span><span>{r.costCents===null?"—":"€"+(r.costCents/100).toFixed(2)}</span><span>{r.completedAt||"running"}</span>
        </div>):<div className="tr"><b>No persisted agent runs yet</b><span>{agentConfigured?"runtime online":"runtime offline"}</span><span className="amber">WAITING</span><span>Runs appear after the deployed agent endpoint is exercised.</span></div>}
      </div>

      <h2 style={{marginTop:36}}>Human attention budget</h2>
      <div className="metrics">
        <div className="metricDark"><b>&lt; 60m</b><span>daily governance target</span></div>
        <div className="metricDark"><b>0</b><span>agents allowed to publish prices</span></div>
        <div className="metricDark"><b>0</b><span>agents allowed to sign contracts</span></div>
        <div className="metricDark"><b>{Object.keys(AGENTS).length}</b><span>bounded agent roles</span></div>
        <div className="metricDark"><b>{ops.conversions30d}</b><span>conversions · 30d</span></div>
      </div>
    </div>
  </main>;
}
