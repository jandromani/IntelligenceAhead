import { getSystemReadiness } from "@/src/system/readiness";

export const metadata={title:"System proof",robots:{index:false,follow:false}};

const cls=(state:string)=>state==="LIVE"||state==="READY"?"green":state==="WAITING_EXTERNAL"?"amber":"";

export default async function SystemPage(){
  const status=await getSystemReadiness();
  const layers=[
    ["01","EXPERIENCE / GROWTH",status.layers.experience],
    ["02","SUPPLY / TRUTH",status.layers.supply],
    ["03","MONEY / REFERRAL",status.layers.money],
    ["04","AUTONOMOUS OPS",status.layers.autonomy],
  ] as const;

  return <main className="controlPage">
    <div className="shell">
      <a className="eyebrow" style={{color:"#0a1630"}} href="/">← consumer product</a>
      <h1>FULL SYSTEM PROOF</h1>
      <p style={{color:"#91a0b8",maxWidth:820}}>LIVE means production evidence exists. READY means the software path is complete. WAITING EXTERNAL means credentials, partner data or commercial traffic are still outside the codebase.</p>

      <div className="metrics" style={{marginTop:28}}>
        {layers.map(([n,name,layer])=><div className="metricDark" key={name}>
          <span>{n} · {name}</span>
          <b className={cls(layer.state)}>{layer.state}</b>
          <span>{layer.score}% software readiness</span>
        </div>)}
      </div>

      <div className="table" style={{marginTop:26}}>
        {layers.map(([n,name,layer])=><div className="tr" key={name}>
          <b>{n} · {name}</b><span className={cls(layer.state)}>{layer.state}</span><span>{layer.score}%</span><span>{layer.detail}</span>
        </div>)}
      </div>

      <h2 style={{marginTop:38}}>Infrastructure truth</h2>
      <div className="metrics">
        <div className="metricDark"><b className={status.infrastructure.databaseConfigured?"green":"amber"}>{status.infrastructure.databaseConfigured?"ONLINE":"NOT CONNECTED"}</b><span>persistent database</span></div>
        <div className="metricDark"><b className={status.infrastructure.agentConfigured?"green":"amber"}>{status.infrastructure.agentConfigured?"ONLINE":"NOT CONNECTED"}</b><span>OpenRouter agent runtime</span></div>
        <div className="metricDark"><b>{status.infrastructure.configuredProviders.length}/3</b><span>hotel providers configured</span></div>
        <div className="metricDark"><b>{status.ops.liveOffers}</b><span>truth-gated live offers</span></div>
        <div className="metricDark"><b>{status.ops.referralClicks30d}</b><span>tracked referrals · 30d</span></div>
      </div>

      <h2 style={{marginTop:38}}>Deterministic circuit test</h2>
      <div className="table">
        {status.proof.checks.map(check=><div className="tr" key={check.name}>
          <b>{check.name}</b><span className={check.pass?"green":""}>{check.pass?"PASS":"FAIL"}</span><span>{check.detail}</span><span>{check.pass?"gate satisfied":"investigate"}</span>
        </div>)}
      </div>

      <h2 style={{marginTop:38}}>Provider readiness</h2>
      <div className="table">
        {status.infrastructure.providers.map(p=><div className="tr" key={p.provider}>
          <b>{p.provider}</b><span className={p.configured?"green":"amber"}>{p.configured?"CONFIGURED":"WAITING CREDENTIALS"}</span><span>{p.environment}</span><span>{p.configured?"eligible for live probes":"adapter compiled + conformance-tested"}</span>
        </div>)}
      </div>

      <p style={{marginTop:30,color:"#91a0b8"}}>Generated {status.generatedAt}. No secret values are exposed.</p>
    </div>
  </main>;
}
