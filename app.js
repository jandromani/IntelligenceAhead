(() => {
  const toast = (msg) => { const el=document.getElementById('toast'); if(!el)return; el.textContent=msg; el.classList.add('show'); clearTimeout(window.__tiaToast); window.__tiaToast=setTimeout(()=>el.classList.remove('show'),1800); };
  const track=(name,data={})=>{try{window.va&&window.va('event',{name,data})}catch(_){}}; window.tiaTrack=track;
  document.querySelectorAll('[data-track]').forEach(el=>el.addEventListener('click',()=>track(el.dataset.track,{href:el.getAttribute('href')||''})));
  document.querySelectorAll('[data-share-url]').forEach(btn=>btn.addEventListener('click',async()=>{const url=btn.dataset.shareUrl,title=btn.dataset.shareTitle||document.title;track('page_share',{title});try{if(navigator.share)await navigator.share({title,url});else if(navigator.clipboard){await navigator.clipboard.writeText(url);toast('Link copiado')}}catch(_){}}));

  document.querySelectorAll('.graph-node').forEach(node=>node.addEventListener('click',()=>{
    document.querySelectorAll('.graph-node').forEach(n=>n.classList.remove('active')); node.classList.add('active');
    const note=document.getElementById('graph-note'); if(note) note.textContent=node.dataset.note || ''; track('future_graph_click',{concept:node.dataset.concept||node.textContent.trim()});
  }));

  const poll=document.querySelector('[data-poll="next-issue"]');
  if(poll){
    const key='tia-next-issue-vote'; const selected=localStorage.getItem(key);
    if(selected){const b=poll.querySelector(`[data-vote="${selected}"]`); if(b)b.classList.add('selected');}
    poll.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{
      poll.querySelectorAll('button').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');localStorage.setItem(key,btn.dataset.vote);
      track('next_issue_vote',{choice:btn.dataset.vote}); const note=document.getElementById('poll-note');if(note)note.textContent='Señal registrada. Gracias por ayudar a orientar la siguiente investigación.';
    }));
  }

  const image=document.getElementById('magazine-image');
  if(image){
    const fallbackPages=[
      {img:'/assets/issues/001/01-cover.webp',title:'2027: cuando la IA deja de ser un chatbot',desc:'La tesis de apertura: el siguiente salto no es sólo un modelo más grande, sino un sistema capaz de decidir cuándo y cómo utilizar inteligencia.',chips:['2027','Adaptive AI','Organisms'],slug:'2027-cuando-la-ia-deja-de-ser-un-chatbot'},
      {img:'/assets/issues/001/02-modelo-organismo.webp',title:'Del modelo al organismo',desc:'El modelo deja de ser el producto completo. Memoria, planificación, herramientas, presupuesto y mundo real empiezan a determinar la capacidad final.',chips:['Harness','Memory','Planning'],slug:'del-modelo-al-organismo'},
      {img:'/assets/issues/001/03-agentes-inteligencia.webp',title:'Más agentes ≠ más inteligencia',desc:'Un swarm puede duplicar trabajo, converger demasiado pronto y quemar recursos. La coordinación, los incentivos y la evidencia importan más que el número de agentes.',chips:['Swarms','Coordination','Evidence'],slug:'mas-agentes-no-es-mas-inteligencia'},
      {img:'/assets/issues/001/04-mosca-pista.webp',title:'La mosca nos da una pista',desc:'La biología sugiere una arquitectura: circuitos locales para lo frecuente y un córtex excepcional sólo cuando la situación realmente lo necesita.',chips:['Connectome','Reflex Mesh','Bio-inspired'],slug:'la-mosca-nos-da-una-pista'},
      {img:'/assets/issues/001/05-pensar-mejor.webp',title:'Pensar menos. Pensar mejor.',desc:'REFLEX, THINK y DELIBERATE convierten el cómputo en un presupuesto. No todas las decisiones merecen el mismo nivel de razonamiento.',chips:['Metabolism','SLM','Efficiency'],slug:'pensar-menos-pensar-mejor'},
      {img:'/assets/issues/001/06-harness.webp',title:'El harness es el nuevo modelo',desc:'El sistema puede compilar un runtime específico para cada tarea: memoria, tools, protocolo, modelo, plan y subagentes temporales.',chips:['JIT Harness','Runtime','Ephemeral Agents'],slug:'el-harness-es-el-nuevo-modelo'},
      {img:'/assets/issues/001/07-razonamiento-software.webp',title:'Del razonamiento al software',desc:'Una solución costosa se extrae, se valida, pasa canary y puede convertirse en un procedimiento local reutilizable.',chips:['Skills','Canary','Immune System'],slug:'del-razonamiento-al-software'},
      {img:'/assets/issues/001/08-reality-bridge.webp',title:'Reality Bridge',desc:'La IA propone; la evidencia decide. Archivos, líneas y fragmentos reales forman un paquete verificable antes de aceptar una hipótesis.',chips:['Reality','Grounding','Verification'],slug:'reality-bridge'},
      {img:'/assets/issues/001/09-ecologia.webp',title:'Del swarm a la ecología',desc:'La siguiente unidad podría no ser un único agente, sino poblaciones especializadas que compiten, colaboran y evolucionan.',chips:['Population','Migration','Evolution'],slug:'del-swarm-a-la-ecologia'},
      {img:'/assets/issues/001/10-cinco-piezas.webp',title:'Mi apuesta para 2027: 5 piezas',desc:'Adaptive harness + metabolismo cognitivo + world graph y evidencia + skill genome e inmunidad + población conectada a la realidad.',chips:['Thesis','2027','Five Pieces'],slug:'cinco-piezas-para-2027'}
    ];
    const cfg=window.TIA_ISSUE_CONFIG || {issue:'001',route:'/issues/001',pages:fallbackPages};
    const pages=cfg.pages;
    let current=0,maxSeen=0;
    const thumbs=document.getElementById('thumbs'), counter=document.getElementById('page-counter'), no=document.getElementById('page-no'), title=document.getElementById('page-title'), desc=document.getElementById('page-desc'), chips=document.getElementById('page-chips'), progress=document.getElementById('progress');
    pages.forEach((p,i)=>{const b=document.createElement('button');b.className='thumb';b.type='button';b.innerHTML=`<img src="${p.img}" alt="Miniatura página ${i+1}" loading="lazy"><span>${String(i+1).padStart(2,'0')}</span>`;b.addEventListener('click',()=>show(i,true));thumbs.appendChild(b);});
    const pageUrl=(idx)=>{const p=pages[idx];return p.slug ? `${cfg.route}/${p.slug}` : `${cfg.route}?page=${idx+1}`;};
    const show=(i,push=false)=>{
      current=(i+pages.length)%pages.length;const p=pages[current];image.src=p.img;image.alt=`Página ${current+1}: ${p.title}`;
      counter.textContent=`${String(current+1).padStart(2,'0')} / ${String(pages.length).padStart(2,'0')}`;no.textContent=String(current+1).padStart(2,'0');title.textContent=p.title;desc.textContent=p.desc;chips.innerHTML=(p.chips||[]).map(c=>`<span class="chip">${c}</span>`).join('');progress.style.width=`${((current+1)/pages.length)*100}%`;
      thumbs.querySelectorAll('.thumb').forEach((x,j)=>x.classList.toggle('active',j===current));const active=thumbs.children[current];if(active?.scrollIntoView)active.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
      if(push){const u=new URL(location.href);u.searchParams.set('page',current+1);history.pushState({page:current+1},'',u);}
      maxSeen=Math.max(maxSeen,current+1);track('issue_page_view',{issue:cfg.issue,page:current+1});
      const completeKey=`tia-${cfg.issue}-complete`;if(maxSeen===pages.length&&!sessionStorage.getItem(completeKey)){sessionStorage.setItem(completeKey,'1');track('issue_complete',{issue:cfg.issue});}
    };
    document.getElementById('prev-page')?.addEventListener('click',()=>show(current-1,true));document.getElementById('next-page')?.addEventListener('click',()=>show(current+1,true));
    const lb=document.getElementById('lightbox'),lbi=document.getElementById('lightbox-img');
    const openLightbox=()=>{if(!lb||!lbi)return;lbi.src=pages[current].img;lb.classList.add('open');lb.setAttribute('aria-hidden','false');track('issue_fullscreen',{issue:cfg.issue,page:current+1});};
    const closeLightbox=()=>{if(!lb)return;lb.classList.remove('open');lb.setAttribute('aria-hidden','true');};
    addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key==='ArrowLeft')show(current-1,true);if(e.key==='ArrowRight')show(current+1,true);if(e.key==='Escape')closeLightbox();});
    addEventListener('popstate',()=>{const n=parseInt(new URL(location.href).searchParams.get('page')||'1',10);show(Math.max(0,Math.min(pages.length-1,n-1)),false);});
    document.getElementById('open-page')?.addEventListener('click',openLightbox);document.getElementById('lightbox-close')?.addEventListener('click',closeLightbox);lb?.addEventListener('click',e=>{if(e.target===lb)closeLightbox();});
    document.getElementById('share-page')?.addEventListener('click',async()=>{const u=new URL(pageUrl(current),location.origin);const share={title:`The Intelligence Ahead · Nº${cfg.issue} · ${String(current+1).padStart(2,'0')}/10`,text:pages[current].title,url:u.toString()};track('issue_share',{issue:cfg.issue,page:current+1});try{if(navigator.share)await navigator.share(share);else if(navigator.clipboard){await navigator.clipboard.writeText(u.toString());toast('Link copiado');}}catch(_){}});
    const requested=parseInt(new URL(location.href).searchParams.get('page')||'1',10);show(Math.max(0,Math.min(pages.length-1,requested-1)),false);
  }
})();
