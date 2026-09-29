'use client';
import { useEffect, useMemo, useState } from 'react';

type Job = any;
const fmt = (n: string | number = 0) => {
  let x = Number(n || 0); const u = ['B','KB','MB','GB','TB']; let i=0;
  while (x >= 1024 && i < u.length-1) { x/=1024; i++; }
  return `${x.toFixed(i ? 1 : 0)} ${u[i]}`;
};
function nameOf(j: Job) {
  return j?.bittorrent?.info?.name || j?.files?.[0]?.path?.split('/').pop() || j?.gid || 'job';
}
function pct(j: Job) {
  const t=Number(j.totalLength||0), c=Number(j.completedLength||0); return t ? Math.min(100,(c/t)*100) : 0;
}

export default function Home() {
  const [text,setText]=useState(''); const [data,setData]=useState<any>(null); const [files,setFiles]=useState<any[]>([]);
  const [busy,setBusy]=useState(false); const [metadataOnly,setMetadataOnly]=useState(false); const [msg,setMsg]=useState('');
  const uris=useMemo(()=>text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),[text]);
  const refresh=async()=>{ try { const [a,b]=await Promise.all([fetch('/api/jobs',{cache:'no-store'}),fetch('/api/files',{cache:'no-store'})]); setData(await a.json()); const bf=await b.json(); setFiles(bf.files||[]); } catch(e:any){setMsg(e.message)} };
  useEffect(()=>{refresh(); const id=setInterval(refresh,3000); return()=>clearInterval(id)},[]);
  const add=async()=>{setBusy(true);setMsg('');try{const r=await fetch('/api/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uris,metadataOnly})});const j=await r.json(); if(!r.ok) throw new Error(j.error||'Error'); setMsg(`Añadidos ${j.gids.length} jobs a aria2`); setText(''); await refresh();}catch(e:any){setMsg(e.message)}finally{setBusy(false)}};
  const swarm=async()=>{setBusy(true);setMsg('Probando swarm oficial de Ubuntu…');try{const r=await fetch('/api/test-swarm',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.message||j.error||'Error');setMsg(`SWARM OK · peers ${j.peakConnections} · pico ${fmt(j.peakDownloadSpeed)}/s · muestra ${fmt(j.sampledBytes)} · job eliminado tras la prueba`);await refresh();}catch(e:any){setMsg(e.message)}finally{setBusy(false)}};
  const jobs=[...(data?.active||[]),...(data?.waiting||[]),...(data?.stopped||[])];

  return <main>
    <header><div><span className="eyebrow">VERCEL SANDBOX × ARIA2</span><h1>Batch Download Lab</h1><p>HTTP/HTTPS + BitTorrent magnets · hasta 200 links · DHT/trackers/peers.</p></div><div className="live"><i/> {data?.sandbox ? 'SANDBOX ONLINE' : 'CONNECTING'}</div></header>
    <section className="grid">
      <div className="panel composer"><div className="panelTitle"><span>01</span> ENTRADA MASIVA</div><textarea value={text} onChange={e=>setText(e.target.value)} placeholder={'Pega un enlace por línea\nhttps://…\nmagnet:?xt=urn:btih:…'} /><div className="controls"><label><input type="checkbox" checked={metadataOnly} onChange={e=>setMetadataOnly(e.target.checked)}/> sólo metadata para magnets</label><b>{uris.length} / 200 links</b></div><div className="actions"><button onClick={add} disabled={!uris.length||uris.length>200||busy}>AÑADIR A COLA</button><button className="ghost" onClick={swarm} disabled={busy}>TEST SWARM UBUNTU</button></div>{msg&&<div className="message">{msg}</div>}</div>
      <div className="panel stats"><div className="panelTitle"><span>02</span> MOTOR</div><div className="statgrid"><div><strong>{data?.active?.length||0}</strong><small>ACTIVE</small></div><div><strong>{data?.waiting?.length||0}</strong><small>WAITING</small></div><div><strong>{data?.stopped?.length||0}</strong><small>STOPPED</small></div><div><strong>{files.length}</strong><small>FILES</small></div></div><p className="hint">aria2 corre en una microVM persistente de Vercel. Los magnets usan BitTorrent/DHT/trackers; HTTP(S) usa descarga directa. El test de Ubuntu corta el payload automáticamente.</p></div>
    </section>
    <section className="panel queue"><div className="panelTitle"><span>03</span> COLA / SWARM</div>{jobs.length===0?<div className="empty">Sin jobs. Pega URLs/magnets o ejecuta el test de swarm.</div>:jobs.map((j:any)=><div className="job" key={j.gid}><div className="jobHead"><div><b>{nameOf(j)}</b><code>{j.gid}</code></div><span className={'status '+j.status}>{j.status}</span></div><div className="bar"><i style={{width:`${pct(j)}%`}}/></div><div className="meta"><span>{pct(j).toFixed(1)}%</span><span>↓ {fmt(j.downloadSpeed)}/s</span><span>↑ {fmt(j.uploadSpeed)}/s</span><span>peers {j.connections||0}</span><span>seeders {j.numSeeders||0}</span><span>{fmt(j.completedLength)} / {fmt(j.totalLength)}</span></div>{j.errorMessage&&<div className="error">{j.errorMessage}</div>}</div>)}</section>
    <section className="panel files"><div className="panelTitle"><span>04</span> FICHEROS EN SANDBOX</div>{files.length===0?<div className="empty">Todavía no hay ficheros materializados.</div>:files.map((f:any)=><div className="file" key={f.path}><code>{f.path}</code><span>{fmt(f.size)}</span></div>)}</section>
    <footer>Para contenido que tengas derecho a descargar. La prueba integrada usa el torrent oficial de Ubuntu.</footer>
  </main>;
}