import './style.css';
import * as ort from 'onnxruntime-web/webgpu';
import { createViewer } from '@playcanvas/supersplat-viewer/viewer';
import { defaultSettings } from '@playcanvas/supersplat-viewer/settings';
import '@playcanvas/supersplat-viewer/viewer.css';
import {
  Florence2ForConditionalGeneration,
  AutoProcessor,
  AutoTokenizer,
  RawImage,
} from '@huggingface/transformers';

const DA3_MODEL = 'https://huggingface.co/Heliosoph/da3-base-4view-onnx/resolve/main/model_fp16.onnx?download=true';
const MODEL_CACHE = 'reality-compiler-da3-v3';
const SIZE = 504;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const C0 = 0.28209479177387814;
const PRO_JOB_KEY = 'reality-compiler-pro-job-v1';

const $ = (id) => document.getElementById(id);
const screens = ['landing','capture','analyze','world'];
const state = {
  frames: [],
  stream: null,
  autoTimer: null,
  session: null,
  modelBuffer: null,
  plyBlob: null,
  plyUrl: null,
  sourceFrame: null,
  semantic: null,
  viewer: null,
  mode: 'instant',
  proConfig: null,
  proConfigAt: 0,
  proJob: null,
  videoFile: null,
  photoFiles: [],
  proClient: null,
  instantPreset: 'interior',
  instantClean: 70,
  lastInstant: null,
};

function show(name){
  for(const id of screens) $(id).classList.toggle('active', id===name);
}
function toast(msg, ms=2800){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),ms);
}
function modal(title, html){ $('modalTitle').textContent=title; $('modalBody').innerHTML=html; $('modal').classList.add('open'); }
$('modalClose').onclick=()=> $('modal').classList.remove('open');

function setHealth(){
  $('gpuChip').textContent = navigator.gpu ? 'WEBGPU · READY' : 'WEBGPU · UNAVAILABLE';
  $('gpuChip').style.color = navigator.gpu ? 'var(--lime)' : 'var(--red)';
  $('netChip').textContent = navigator.onLine ? 'HF · ONLINE' : 'HF · OFFLINE';
  $('netChip').style.color = navigator.onLine ? '' : 'var(--red)';
}
setHealth(); addEventListener('online',setHealth); addEventListener('offline',setHealth);

function targetViews(){ return state.mode==='instant' ? 12 : (state.mode==='metric' ? 4 : (state.mode==='ultra' ? 24 : 48)); }
const INSTANT_PRESETS={
  terrace:{label:'TERRACE',confQ:.22,edgeSoft:.115,shellQ:.82,voxel:.010,maxScale:.0160,sizeMul:.78,thickness:.48,opacity:.88,bgOpacity:.62,bgScale:.023},
  interior:{label:'INTERIOR',confQ:.20,edgeSoft:.145,shellQ:.95,voxel:.008,maxScale:.0175,sizeMul:.82,thickness:.42,opacity:.91,bgOpacity:.58,bgScale:.021},
  object:{label:'OBJECT',confQ:.18,edgeSoft:.120,shellQ:.985,voxel:.0055,maxScale:.0120,sizeMul:.66,thickness:.34,opacity:.94,bgOpacity:.50,bgScale:.016},
  raw:{label:'RAW',confQ:.10,edgeSoft:9,shellQ:1,voxel:0,maxScale:.0240,sizeMul:1.0,thickness:.55,opacity:.94,bgOpacity:.70,bgScale:.024}
};
function instantConfig(){
  const base=INSTANT_PRESETS[state.instantPreset]||INSTANT_PRESETS.interior;
  const clean=Math.max(0,Math.min(1,state.instantClean/100));
  if(state.instantPreset==='raw')return {...base,clean};
  return {
    ...base,clean,
    confQ:Math.max(.08,Math.min(.42,base.confQ+(clean-.55)*.10)),
    voxel:base.voxel*(.72+.52*clean),
    maxScale:base.maxScale*(1.12-.22*clean),
    sizeMul:base.sizeMul*(1.08-.20*clean),
    thickness:base.thickness*(1.08-.18*clean),
    opacity:Math.max(.78,Math.min(.96,base.opacity+(clean-.5)*.035))
  };
}
function instantTuneMarkup(extra=''){
  return `<div class="instantTuning ${extra}">
    <div class="instantTuneHead"><b>INSTANT FUSION</b><span data-tune-summary></span></div>
    <div class="presetRow">
      ${Object.entries(INSTANT_PRESETS).map(([id,p])=>`<button type="button" data-instant-preset="${id}">${p.label}</button>`).join('')}
    </div>
    <div class="cleanRow"><span>DENSE</span><input type="range" min="0" max="100" step="1" data-instant-clean><span>CLEAN</span><b data-clean-value></b></div>
    ${extra.includes('worldTune')?'<button type="button" class="applyTune" data-apply-instant>REFILTER · NO AI RERUN</button>':''}
  </div>`;
}
function syncInstantControls(){
  document.querySelectorAll('[data-instant-preset]').forEach(b=>b.classList.toggle('active',b.dataset.instantPreset===state.instantPreset));
  document.querySelectorAll('[data-instant-clean]').forEach(x=>x.value=String(state.instantClean));
  document.querySelectorAll('[data-clean-value]').forEach(x=>x.textContent=String(state.instantClean));
  document.querySelectorAll('[data-tune-summary]').forEach(x=>x.textContent=`${INSTANT_PRESETS[state.instantPreset]?.label||'INTERIOR'} · ${state.instantClean}% CLEAN`);
  document.querySelectorAll('.instantTuning').forEach(x=>x.classList.toggle('hiddenTune',state.mode!=='instant'));
}
function wireInstantControls(root=document){
  root.querySelectorAll('[data-instant-preset]').forEach(btn=>{
    btn.onclick=()=>{state.instantPreset=btn.dataset.instantPreset;syncInstantControls();};
  });
  root.querySelectorAll('[data-instant-clean]').forEach(sl=>{
    sl.oninput=()=>{state.instantClean=Number(sl.value);syncInstantControls();};
  });
  root.querySelectorAll('[data-apply-instant]').forEach(btn=>btn.onclick=()=>refilterInstant());
  syncInstantControls();
}


function installV4UI(){
  const brandSmall=document.querySelector('.brand small');
  if(brandSmall) brandSmall.textContent='V7 · STREAMING SIM3 FUSION';
  const health=document.querySelector('.health');
  if(health && !$('proChip')){
    const chip=document.createElement('span'); chip.id='proChip'; chip.textContent='PRO GPU · CHECK'; health.appendChild(chip);
  }
  const card=document.querySelector('.capture-card');
  if(card && !$('modeSwitch')){
    const wrap=document.createElement('div');
    wrap.id='modeSwitch'; wrap.className='modeSwitch';
    wrap.innerHTML=`
      <button data-mode="instant" class="active"><b>INSTANT</b><small>12-view · streaming</small></button>
      <button data-mode="pro"><b>PRO</b><small>Splatfacto · 30K</small></button>
      <button data-mode="ultra"><b>ULTRA</b><small>Splatfacto Big · 30K</small></button>
      <button data-mode="metric"><b>METRIC</b><small>LiDAR / RGB-D</small></button>`;
    const actions=card.querySelector('.actions'); card.insertBefore(wrap,actions);
    wrap.querySelectorAll('button').forEach(btn=>btn.onclick=()=>setMode(btn.dataset.mode));
    const tuning=document.createElement('div');tuning.innerHTML=instantTuneMarkup();wrap.insertAdjacentElement('afterend',tuning.firstElementChild);
  }
  const world=$('world');
  if(world && !world.querySelector('.worldTune')){
    const box=document.createElement('div');box.innerHTML=instantTuneMarkup('worldTune');world.appendChild(box.firstElementChild);
  }
  wireInstantControls(document);
  const saved=loadSavedProJob();
  if(card && saved && !$('resumeJobBtn')){
    const btn=document.createElement('button');
    btn.id='resumeJobBtn';btn.className='wide ghost';btn.textContent='RESUME GPU JOB';
    btn.onclick=resumeSavedProJob;
    card.appendChild(btn);
  }
  refreshProStatus();
}

function setMode(mode){
  state.mode=mode;
  document.querySelectorAll('#modeSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const copy=document.querySelector('.capture-card > p');
  if(copy){
    copy.textContent=mode==='instant'
      ? 'Streaming local reconstruction. 10–16 chronological views are processed as overlapping DA3 windows and aligned with dense Sim(3).'
      : mode==='pro'
      ? 'Full-room GPU path. Video is solved with SfM, then Splatfacto/gsplat optimizes the room for 30,000 iterations and exports a real Gaussian PLY.'
      : mode==='ultra'
      ? 'Highest-quality GPU path. More source frames + Splatfacto Big + 30,000 iterative optimization steps. This is intentionally slower and denser.'
      : 'Metric path. Import an RGB-D / LiDAR splat now; automatic SplaTAM ingestion is the next wired backend.';
  }
  const engine=$('engineChip');
  if(engine) engine.textContent=mode==='instant'?'DA3 · LOCAL':mode==='metric'?'LIDAR · IMPORT':mode.toUpperCase()+' · GPU';
  renderFrames();
  syncInstantControls();
}

async function refreshProStatus(){
  const chip=$('proChip'); if(!chip)return;
  try{
    const r=await fetch('/api/reality-pro-config',{cache:'no-store'});
    const j=await r.json();
    state.proConfig=j; state.proConfigAt=Date.now();
    if(j.configured && j.health?.ok && j.health?.gpu){
      chip.textContent='PRO GPU · READY';chip.style.color='var(--lime)';
      chip.title=j.health.gpu_name||j.backend;
    }else if(j.configured && j.health?.ok){
      chip.textContent='PRO GPU · NO CUDA';chip.style.color='var(--red)';
      chip.title='Worker reachable but no CUDA GPU detected';
    }else if(j.configured){
      chip.textContent='PRO GPU · OFFLINE';chip.style.color='var(--red)';
      chip.title=j.health?.error||'Worker health check failed';
    }else{
      chip.textContent='PRO GPU · UNWIRED';chip.style.color='#d6bd69';
      chip.title='Commercial worker is built but REALITY_PRO_BACKEND_URL is not configured';
    }
  }catch{
    chip.textContent='PRO GPU · UNKNOWN';chip.style.color='#d6bd69';
  }
}

installV4UI();

function setStep(name, pct, note=''){
  const el=document.querySelector(`[data-step="${name}"]`); if(!el) return;
  el.querySelector('u').style.width=`${pct}%`;
  el.querySelector('b').textContent = note || (pct>=100?'DONE':`${Math.round(pct)}%`);
}
function buildSteps(){
  const remote=state.mode==='pro'||state.mode==='ultra';
  const items=remote
    ? [['upload','GPU UPLOAD'],['infer','FRAME PREP'],['fusion','CAMERA SOLVE'],['gauss',state.mode==='ultra'?'GSPLAT BIG · 30K':'GSPLAT · 30K'],['export','PLY EXPORT'],['viewer','SPLAT VIEWER']]
    : [['keyframes','KEYFRAMES'],['weights','DA3 WEIGHTS'],['infer','DA3 WINDOWS'],['fusion','SIM(3) STREAM FUSION'],['gauss','SOFT GAUSSIAN PACK'],['viewer','SPLAT VIEWER']];
  $('steps').innerHTML=items.map(([id,label])=>`<div class="step" data-step="${id}"><div><span>${label}</span><b>WAIT</b></div><i><u></u></i></div>`).join('');
}
function status(kicker,text,sub,pct){ $('statusKicker').textContent=kicker; $('statusText').textContent=text; $('statusSub').textContent=sub||''; $('mainProgress').style.width=`${pct||0}%`; }
function diag(s){ $('diag').textContent=s; }

function drawImageCover(ctx, source, w, h){
  const sw=source.videoWidth||source.naturalWidth||source.width, sh=source.videoHeight||source.naturalHeight||source.height;
  const scale=Math.max(w/sw,h/sh), dw=sw*scale, dh=sh*scale;
  ctx.drawImage(source,(w-dw)/2,(h-dh)/2,dw,dh);
}
async function blobToImage(blob){
  const url=URL.createObjectURL(blob); const img=new Image(); img.decoding='async'; img.src=url; await img.decode(); return {img,url,blob};
}
async function canvasToBlob(canvas,q=.92){ return new Promise(r=>canvas.toBlob(r,'image/jpeg',q)); }

function graySignature(source, w=96, h=72){
  const c=document.createElement('canvas'); c.width=w;c.height=h; const x=c.getContext('2d',{willReadFrequently:true}); drawImageCover(x,source,w,h);
  const d=x.getImageData(0,0,w,h).data; const g=new Float32Array(w*h);
  for(let i=0,j=0;i<d.length;i+=4,j++) g[j]=.299*d[i]+.587*d[i+1]+.114*d[i+2];
  return {g,w,h};
}
function sharpnessOf(sig){
  const {g,w,h}=sig; let sum=0,sum2=0,n=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x; const v=-4*g[i]+g[i-1]+g[i+1]+g[i-w]+g[i+w]; sum+=v; sum2+=v*v;n++;
  }
  const m=sum/n; return Math.max(0,sum2/n-m*m);
}
function diffOf(a,b){ if(!a||!b)return 999; let s=0; const n=Math.min(a.g.length,b.g.length); for(let i=0;i<n;i++)s+=Math.abs(a.g[i]-b.g[i]); return s/n; }
function qualityFrame(source){ const sig=graySignature(source); return {sig,sharp:sharpnessOf(sig)}; }

async function sourceToFrame(source, label='VIEW'){
  const canvas=document.createElement('canvas'); canvas.width=SIZE;canvas.height=SIZE; const ctx=canvas.getContext('2d',{willReadFrequently:true}); drawImageCover(ctx,source,SIZE,SIZE);
  const blob=await canvasToBlob(canvas,.94); const url=URL.createObjectURL(blob); const img=new Image();img.src=url;await img.decode();
  const sig=graySignature(img); const sharp=sharpnessOf(sig); return {blob,url,img,sig,sharp,label,canvas};
}
function renderFrames(){
  $('frames').innerHTML=state.frames.map((f,i)=>`<figure><img src="${f.url}"><figcaption>V${i+1} · ${Math.round(f.sharp)}</figcaption></figure>`).join('');
  const needed=targetViews();
  $('viewCount').textContent=`${state.frames.length} / ${needed}`;
  $('finishCaptureBtn').disabled=state.frames.length<needed;
}

$('videoBtn').onclick=()=> $('videoInput').click();
$('photosBtn').onclick=()=> $('photosInput').click();
$('splatBtn').onclick=()=> $('splatInput').click();
$('recordBtn').onclick=startCamera;

$('videoInput').onchange=async(e)=>{
  const f=e.target.files?.[0]; if(!f)return; state.videoFile=f;
  if(state.mode==='pro'||state.mode==='ultra') await submitPro({video:f});
  else if(state.mode==='metric') metricNotYet();
  else await extractVideoFrames(f);
};
$('photosInput').onchange=async(e)=>{
  const files=[...(e.target.files||[])]; if(!files.length)return; state.photoFiles=files;
  if(state.mode==='pro'||state.mode==='ultra') await submitPro({images:files.slice(0,72)});
  else if(state.mode==='metric') metricNotYet();
  else await choosePhotoFrames(files);
};
$('splatInput').onchange=async(e)=>{ const file=e.target.files?.[0]; if(file) openExistingSplat(file); };

async function startCamera(){
  try{
    state.frames=[];renderFrames();
    state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
    const v=$('camera');v.srcObject=state.stream;await v.play(); show('capture'); drawCaptureOverlay(); updateLiveQuality();
  }catch(err){ modal('Camera unavailable',`<p>${escapeHtml(err.message)}</p><p>Use <b>Upload video</b> instead.</p>`); }
}
function stopCamera(){ if(state.stream){for(const t of state.stream.getTracks())t.stop();state.stream=null;} clearInterval(state.autoTimer);state.autoTimer=null; }
function drawCaptureOverlay(){
  const c=$('captureOverlay'),dpr=Math.min(devicePixelRatio||1,2);c.width=innerWidth*dpr;c.height=innerHeight*dpr;const x=c.getContext('2d');x.scale(dpr,dpr);x.clearRect(0,0,innerWidth,innerHeight);
  x.strokeStyle='rgba(202,255,72,.65)';x.lineWidth=1;x.setLineDash([7,8]);const m=Math.min(innerWidth,innerHeight)*.14;x.strokeRect(m,m,innerWidth-2*m,innerHeight-2*m);x.setLineDash([]);
  x.beginPath();x.moveTo(innerWidth/2-18,innerHeight/2);x.lineTo(innerWidth/2+18,innerHeight/2);x.moveTo(innerWidth/2,innerHeight/2-18);x.lineTo(innerWidth/2,innerHeight/2+18);x.stroke();
}
addEventListener('resize',()=>{if($('capture').classList.contains('active'))drawCaptureOverlay();});
function updateLiveQuality(){
  if(!$('capture').classList.contains('active'))return; const v=$('camera'); if(v.readyState>=2){const q=qualityFrame(v);$('sharpness').textContent=q.sharp>220?'GOOD':q.sharp>90?'OK':'BLUR';$('sharpness').style.color=q.sharp>90?'var(--lime)':'var(--red)';}
  requestAnimationFrame(updateLiveQuality);
}
$('captureFrameBtn').onclick=()=>captureCameraFrame(false);
$('autoCaptureBtn').onclick=()=>{
  if(state.autoTimer){clearInterval(state.autoTimer);state.autoTimer=null;$('autoCaptureBtn').textContent='AUTO SCAN';return;}
  $('autoCaptureBtn').textContent='SCANNING…'; state.autoTimer=setInterval(()=>captureCameraFrame(true),900);
};
async function captureCameraFrame(auto){
  const needed=targetViews();
  if(state.frames.length>=needed){clearInterval(state.autoTimer);state.autoTimer=null;$('autoCaptureBtn').textContent='AUTO SCAN';return;}
  const v=$('camera');if(v.readyState<2)return; const candidate=await sourceToFrame(v,`CAM ${state.frames.length+1}`);
  const prev=state.frames.at(-1);const diff=prev?diffOf(candidate.sig,prev.sig):999;
  $('motion').textContent=diff>34?'WIDE':diff>16?'GOOD':'LOW'; $('motion').style.color=diff>16?'var(--lime)':'#d6bd69';
  if(auto && (candidate.sharp<95 || diff<15)){URL.revokeObjectURL(candidate.url);return;}
  state.frames.push(candidate); renderFrames(); const cover=Math.min(100,Math.round(state.frames.length/needed*100));$('coverage').textContent=`${cover}%`;$('coverageBar').style.width=`${cover}%`;
  const guides=['MOVE SIDEWAYS →','KEEP OVERLAP · DO NOT PAN IN PLACE','ARC AROUND THE SPACE ↗','REVISIT A CORNER ↩','CAPTURE FAR SIDE ←','STREAM COVERAGE GOOD'];const gi=Math.min(guides.length-1,Math.floor(state.frames.length/2));$('captureGuide').textContent=guides[gi]||guides[0];
  if(state.frames.length>=needed){clearInterval(state.autoTimer);state.autoTimer=null;$('autoCaptureBtn').textContent='AUTO SCAN';}
}
$('finishCaptureBtn').onclick=async()=>{
  stopCamera();
  if(state.mode==='pro'||state.mode==='ultra'){
    const files=state.frames.map((f,i)=>new File([f.blob],`capture-${String(i+1).padStart(3,'0')}.jpg`,{type:'image/jpeg'}));
    await submitPro({images:files});
  }else if(state.mode==='metric'){
    metricNotYet();
  }else{
    compileWorld(state.frames.slice(0,targetViews()));
  }
};

function chooseChronologicalFrames(samples,target){
  const count=Math.min(target,samples.length);
  if(count<=4)return samples.slice(0,count);
  const chosen=[];
  for(let b=0;b<count;b++){
    const lo=Math.floor(b*samples.length/count),hi=Math.max(lo+1,Math.floor((b+1)*samples.length/count));
    const group=samples.slice(lo,hi);
    let best=null,bestScore=-Infinity;
    for(const fr of group){
      const prev=chosen.at(-1);
      const novelty=prev?Math.min(55,diffOf(fr.sig,prev.sig)):28;
      const score=Math.log1p(fr.sharp)*16+novelty*.7;
      if(score>bestScore){best=fr;bestScore=score;}
    }
    if(best)chosen.push(best);
  }
  return chosen.sort((a,b)=>(a.t??a._order??0)-(b.t??b._order??0));
}

async function extractVideoFrames(file){
  show('analyze');buildSteps();
  status('VIDEO ANALYSIS','Building a chronological streaming capture','Blur rejection · temporal coverage · overlap',3);
  diag('Decoding video locally. V7 keeps a temporal sequence instead of throwing the scan away.');
  const url=URL.createObjectURL(file),v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=url;
  await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=rej;});
  const dur=Math.max(.1,v.duration);
  const target=dur>30?16:dur>16?14:12;
  const N=Math.min(52,Math.max(target*3,Math.round(dur*2.2)));
  const samples=[];
  for(let i=0;i<N;i++){
    const t=(dur*.035)+(dur*.93)*(i/(N-1));v.currentTime=t;
    await new Promise(r=>{v.onseeked=()=>r();});
    const fr=await sourceToFrame(v,`T${t.toFixed(1)}s`);fr.t=t;fr._order=i;samples.push(fr);
    status('VIDEO ANALYSIS','Building a chronological streaming capture',`Candidate ${i+1}/${N} · target ${target} views`,3+10*(i+1)/N);
  }
  URL.revokeObjectURL(url);
  const chosen=chooseChronologicalFrames(samples,target);
  for(const fr of samples)if(!chosen.includes(fr))URL.revokeObjectURL(fr.url);
  state.frames=chosen;renderFrames();setStep('keyframes',100,`${chosen.length} VIEWS`);
  await compileWorld(chosen,true);
}

async function choosePhotoFrames(files){
  show('analyze');buildSteps();
  status('PHOTO ANALYSIS','Preparing ordered multiview sequence','Keep capture order for streaming alignment',5);
  const all=[];
  for(let i=0;i<files.length;i++){
    const {img,url}=await blobToImage(files[i]);const fr=await sourceToFrame(img,files[i].name);URL.revokeObjectURL(url);
    fr._order=i;all.push(fr);
  }
  if(all.length<4){
    modal('Need at least four views','<p>Upload at least <b>4 overlapping photos</b>. 10–16 ordered views work much better.</p>');show('landing');return;
  }
  const target=Math.min(16,Math.max(4,all.length>=12?12:all.length));
  const chosen=all.length>target?chooseChronologicalFrames(all,target):all;
  for(const fr of all)if(!chosen.includes(fr))URL.revokeObjectURL(fr.url);
  state.frames=chosen;renderFrames();setStep('keyframes',100,`${chosen.length} VIEWS`);
  await compileWorld(chosen,true);
}

async function getModelBuffer(){
  if(state.modelBuffer)return state.modelBuffer;
  $('engineChip').textContent='DA3 · LOADING';
  try{
    const cache=await caches.open(MODEL_CACHE);let res=await cache.match(DA3_MODEL);
    if(res){setStep('weights',100,'CACHE');const buf=await res.arrayBuffer();state.modelBuffer=buf;$('engineChip').textContent='DA3 · HOT';return buf;}
    const net=await fetch(DA3_MODEL,{mode:'cors'});if(!net.ok)throw new Error(`HF model HTTP ${net.status}`);
    const len=Number(net.headers.get('content-length')||0);const reader=net.body.getReader();let got=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);got+=value.byteLength;const p=len?got/len*100:Math.min(95,got/2_000_000);setStep('weights',p,len?`${(got/1048576).toFixed(0)} / ${(len/1048576).toFixed(0)} MB`:`${(got/1048576).toFixed(0)} MB`);status('MODEL STREAM','Downloading DA3 multi-view weights',`${(got/1048576).toFixed(0)} MB`,15+p*.25);}
    const out=new Uint8Array(got);let off=0;for(const c of chunks){out.set(c,off);off+=c.length;}state.modelBuffer=out.buffer;
    try{await cache.put(DA3_MODEL,new Response(out,{headers:{'content-type':'application/octet-stream'}}));}catch{}
    setStep('weights',100,'CACHED');$('engineChip').textContent='DA3 · HOT';return state.modelBuffer;
  }catch(err){$('engineChip').textContent='DA3 · ERROR';throw new Error(`DA3 weights could not be fetched: ${err.message}. Hugging Face may be blocked by this browser/network.`);}
}

function prepFrames(frames){
  const tensor=new Float32Array(1*4*3*SIZE*SIZE);const colors=[];
  for(let v=0;v<4;v++){
    const c=document.createElement('canvas');c.width=SIZE;c.height=SIZE;const x=c.getContext('2d',{willReadFrequently:true});drawImageCover(x,frames[v].img,SIZE,SIZE);const id=x.getImageData(0,0,SIZE,SIZE);colors.push(id.data);
    const plane=SIZE*SIZE;for(let p=0;p<plane;p++){const o=p*4;for(let ch=0;ch<3;ch++){const val=id.data[o+ch]/255;tensor[((v*3+ch)*plane)+p]=(val-MEAN[ch])/STD[ch];}}
  }
  return {tensor,colors};
}

async function ensureSession(){
  if(state.session)return state.session; const buf=await getModelBuffer();
  status('WEBGPU','Compiling DA3 graph','First run compiles GPU shaders',45);setStep('infer',8,'COMPILE');
  const providers=navigator.gpu?['webgpu','wasm']:['wasm'];
  ort.env.wasm.numThreads=Math.min(4,navigator.hardwareConcurrency||2);
  try{state.session=await ort.InferenceSession.create(buf,{executionProviders:providers,graphOptimizationLevel:'all'});return state.session;}
  catch(e){if(providers[0]==='webgpu'){diag(`WebGPU compile failed; trying WASM.\n${e.message}`);state.session=await ort.InferenceSession.create(buf,{executionProviders:['wasm'],graphOptimizationLevel:'all'});return state.session;}throw e;}
}



function percentile(arr,p){
  const a=Array.from(arr).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return 0;
  return a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))];
}
function invertRt(ext,base){
  const r=[ext[base],ext[base+1],ext[base+2],ext[base+4],ext[base+5],ext[base+6],ext[base+8],ext[base+9],ext[base+10]];
  const t=[ext[base+3],ext[base+7],ext[base+11]];
  const rt=[r[0],r[3],r[6],r[1],r[4],r[7],r[2],r[5],r[8]];
  const c=[-(rt[0]*t[0]+rt[1]*t[1]+rt[2]*t[2]),-(rt[3]*t[0]+rt[4]*t[1]+rt[5]*t[2]),-(rt[6]*t[0]+rt[7]*t[1]+rt[8]*t[2])];
  return {rt,c,R:r,t};
}
function norm3(v){const n=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/n,v[1]/n,v[2]/n];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function add3(a,b){return[a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub3(a,b){return[a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function mul3(v,s){return[v[0]*s,v[1]*s,v[2]*s];}
function mat3Mul(A,B){return[
  A[0]*B[0]+A[1]*B[3]+A[2]*B[6],A[0]*B[1]+A[1]*B[4]+A[2]*B[7],A[0]*B[2]+A[1]*B[5]+A[2]*B[8],
  A[3]*B[0]+A[4]*B[3]+A[5]*B[6],A[3]*B[1]+A[4]*B[4]+A[5]*B[7],A[3]*B[2]+A[4]*B[5]+A[5]*B[8],
  A[6]*B[0]+A[7]*B[3]+A[8]*B[6],A[6]*B[1]+A[7]*B[4]+A[8]*B[7],A[6]*B[2]+A[7]*B[5]+A[8]*B[8]
];}
function mat3T(A){return[A[0],A[3],A[6],A[1],A[4],A[7],A[2],A[5],A[8]];}
function mat3Vec(A,v){return[A[0]*v[0]+A[1]*v[1]+A[2]*v[2],A[3]*v[0]+A[4]*v[1]+A[5]*v[2],A[6]*v[0]+A[7]*v[1]+A[8]*v[2]];}
function mat3ToQuat(m){
  const tr=m[0]+m[4]+m[8];let w,x,y,z;
  if(tr>0){const S=Math.sqrt(tr+1)*2;w=.25*S;x=(m[7]-m[5])/S;y=(m[2]-m[6])/S;z=(m[3]-m[1])/S;}
  else if(m[0]>m[4]&&m[0]>m[8]){const S=Math.sqrt(1+m[0]-m[4]-m[8])*2;w=(m[7]-m[5])/S;x=.25*S;y=(m[1]+m[3])/S;z=(m[2]+m[6])/S;}
  else if(m[4]>m[8]){const S=Math.sqrt(1+m[4]-m[0]-m[8])*2;w=(m[2]-m[6])/S;x=(m[1]+m[3])/S;y=.25*S;z=(m[5]+m[7])/S;}
  else{const S=Math.sqrt(1+m[8]-m[0]-m[4])*2;w=(m[3]-m[1])/S;x=(m[2]+m[6])/S;y=(m[5]+m[7])/S;z=.25*S;}
  const n=Math.hypot(w,x,y,z)||1;return[w/n,x/n,y/n,z/n];
}
function quatToMat3(q){
  const [w,x,y,z]=q,xx=x*x,yy=y*y,zz=z*z,xy=x*y,xz=x*z,yz=y*z,wx=w*x,wy=w*y,wz=w*z;
  return[1-2*(yy+zz),2*(xy-wz),2*(xz+wy),2*(xy+wz),1-2*(xx+zz),2*(yz-wx),2*(xz-wy),2*(yz+wx),1-2*(xx+yy)];
}
function averageRotations(mats){
  if(mats.length===1)return mats[0];
  const q0=mat3ToQuat(mats[0]),sum=[0,0,0,0];
  for(const m of mats){
    let q=mat3ToQuat(m);if(q0[0]*q[0]+q0[1]*q[1]+q0[2]*q[2]+q0[3]*q[3]<0)q=q.map(v=>-v);
    for(let i=0;i<4;i++)sum[i]+=q[i];
  }
  const n=Math.hypot(...sum)||1;return quatToMat3(sum.map(v=>v/n));
}
function quatFromZ(n){
  n=norm3(n);const d=Math.max(-1,Math.min(1,n[2]));
  if(d<-0.9999)return[0,1,0,0];
  const w=Math.sqrt((1+d)*.5),k=1/(2*w||1);return[w,-n[1]*k,n[0]*k,0];
}
function identitySim3(){return{s:1,R:[1,0,0,0,1,0,0,0,1],t:[0,0,0]};}
function applySim3(T,p){return add3(mul3(mat3Vec(T.R,p),T.s),T.t);}
function applySim3Dir(T,n){return norm3(mat3Vec(T.R,n));}
function composeSim3(A,B){return{s:A.s*B.s,R:mat3Mul(A.R,B.R),t:add3(mul3(mat3Vec(A.R,B.t),A.s),A.t)};}

function extractDA3Arrays(out){
  const depth=out.depth?.data||out[Object.keys(out).find(k=>k.includes('depth')&&!k.includes('conf'))]?.data;
  const conf=out.depth_conf?.data||out[Object.keys(out).find(k=>k.includes('conf'))]?.data;
  const ext=out.extrinsics?.data||out[Object.keys(out).find(k=>k.includes('extr'))]?.data;
  const K=out.intrinsics?.data||out[Object.keys(out).find(k=>k.includes('intr'))]?.data;
  if(!depth||!conf||!ext||!K)throw new Error(`Unexpected DA3 outputs: ${Object.keys(out).join(', ')}`);
  return{depth,conf,ext,K};
}
function windowSpecs(frames){
  if(frames.length<4)throw new Error('V7 needs at least four overlapping views.');
  const starts=[];for(let s=0;s<=frames.length-4;s+=2)starts.push(s);
  const last=frames.length-4;if(!starts.includes(last))starts.push(last);
  return starts.map(start=>{
    const chrono=[start,start+1,start+2,start+3];
    const inputIds=[start+2,start+1,start+3,start]; // temporal middle first: DA3 fixed-first reference behaves closer to official video guidance
    return{start,chrono,inputIds,inputFrames:inputIds.map(i=>frames[i])};
  });
}
function windowCamera(win,slot){
  const e=slot*12,k=slot*9,inv=invertRt(win.ext,e);
  return{...inv,fx:win.K[k],fy:win.K[k+4],cx:win.K[k+2],cy:win.K[k+5]};
}
function unprojectAt(win,slot,x,y){
  const base=slot*SIZE*SIZE,i=base+y*SIZE+x,z=win.depth[i];
  if(!Number.isFinite(z)||z<=0)return null;
  const cam=windowCamera(win,slot),pc=[(x-cam.cx)/cam.fx*z,(y-cam.cy)/cam.fy*z,z];
  return{p:add3(mat3Vec(cam.rt,pc),cam.c),z,conf:win.conf[i],cam};
}
function sampledPercentile(data,base,p,step=23){
  const a=[];for(let i=base;i<base+SIZE*SIZE;i+=step){const v=data[i];if(Number.isFinite(v)&&v>0)a.push(v);}
  return percentile(a,p);
}
function depthEdgeSoft(win,slot,x,y,z,step,cfg){
  let mx=0,n=0,base=slot*SIZE*SIZE;
  for(const[dx,dy]of[[step,0],[-step,0],[0,step],[0,-step]]){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=SIZE||yy>=SIZE)continue;
    const d=win.depth[base+yy*SIZE+xx];if(!Number.isFinite(d)||d<=0)continue;
    mx=Math.max(mx,Math.abs(d-z)/Math.max(.001,(Math.abs(d)+Math.abs(z))*.5));n++;
  }
  if(!n||cfg.edgeSoft>5)return 1;
  const r=mx/Math.max(.025,cfg.edgeSoft);return Math.exp(-r*r);
}
function windowSoftSupport(win,slot,pLocal,cfg){
  let sum=0,n=0;
  for(let j=0;j<4;j++){
    if(j===slot)continue;const c=windowCamera(win,j);
    const pc=add3(mat3Vec(c.R,pLocal),c.t),z=pc[2];if(z<=1e-5)continue;
    const u=c.fx*pc[0]/z+c.cx,v=c.fy*pc[1]/z+c.cy;if(u<1||v<1||u>SIZE-2||v>SIZE-2)continue;
    const ix=Math.round(u),iy=Math.round(v),base=j*SIZE*SIZE,d=win.depth[base+iy*SIZE+ix];if(!Number.isFinite(d)||d<=0)continue;
    const rel=Math.abs(d-z)/Math.max(.001,(Math.abs(d)+Math.abs(z))*.5);
    sum+=Math.exp(-Math.pow(rel/.14,2));n++;
  }
  return n?(.42+.58*sum/n):.58;
}
function fixedRotationFit(pairs,R){
  let sw=0,cp=[0,0,0],cq=[0,0,0];
  for(const a of pairs){sw+=a.w;cp=add3(cp,mul3(a.p,a.w));cq=add3(cq,mul3(a.q,a.w));}
  if(sw<=0)return null;cp=mul3(cp,1/sw);cq=mul3(cq,1/sw);
  let num=0,den=0;
  for(const a of pairs){const pp=sub3(a.p,cp),qq=sub3(a.q,cq),rp=mat3Vec(R,pp);num+=a.w*dot3(qq,rp);den+=a.w*dot3(pp,pp);}
  let scale=den>1e-9?num/den:1;if(!Number.isFinite(scale)||scale<=0)scale=1;
  scale=Math.max(.25,Math.min(4,scale));
  const t=sub3(cq,mul3(mat3Vec(R,cp),scale));
  return{s:scale,R,t};
}
function estimateWindowSim3(prev,cur){
  const common=cur.frameIds.filter(id=>prev.frameIds.includes(id));
  if(!common.length)throw new Error('Streaming windows lost overlap.');
  const rotations=[];
  for(const id of common){
    const a=windowCamera(prev,prev.frameIds.indexOf(id)),b=windowCamera(cur,cur.frameIds.indexOf(id));
    rotations.push(mat3Mul(mat3T(a.R),b.R));
  }
  const R=averageRotations(rotations),pairs=[];
  for(const id of common){
    const sa=prev.frameIds.indexOf(id),sb=cur.frameIds.indexOf(id);
    const ca=sampledPercentile(prev.conf,sa*SIZE*SIZE,.28),cb=sampledPercentile(cur.conf,sb*SIZE*SIZE,.28);
    for(let y=12;y<SIZE-12;y+=18)for(let x=12;x<SIZE-12;x+=18){
      const ia=sa*SIZE*SIZE+y*SIZE+x,ib=sb*SIZE*SIZE+y*SIZE+x;
      if(prev.conf[ia]<ca||cur.conf[ib]<cb)continue;
      const A=unprojectAt(prev,sa,x,y),B=unprojectAt(cur,sb,x,y);if(!A||!B)continue;
      pairs.push({p:B.p,q:A.p,w:1});
    }
  }
  if(pairs.length<80)throw new Error(`Only ${pairs.length} dense overlap correspondences for Sim(3). Capture more overlap.`);
  let T=fixedRotationFit(pairs,R);if(!T)throw new Error('Sim(3) alignment failed.');
  let residual=pairs.map(a=>Math.hypot(...sub3(a.q,applySim3(T,a.p))));
  const cut=Math.max(1e-4,percentile(residual,.68)*1.75);
  const inliers=pairs.filter((a,i)=>residual[i]<=cut);
  if(inliers.length>=50)T=fixedRotationFit(inliers,R)||T;
  residual=inliers.map(a=>Math.hypot(...sub3(a.q,applySim3(T,a.p))));
  return{T,pairs:pairs.length,inliers:inliers.length,rmse:Math.sqrt(residual.reduce((s,x)=>s+x*x,0)/Math.max(1,residual.length))};
}
function frameNormal(win,slot,x,y,z,step){
  const base=slot*SIZE*SIZE,c=windowCamera(win,slot),i=base+y*SIZE+x,zr=win.depth[i+step],zd=win.depth[i+step*SIZE];
  if(!Number.isFinite(zr)||!Number.isFinite(zd)||zr<=0||zd<=0)return[0,0,1];
  const a=[(x-c.cx)/c.fx*z,(y-c.cy)/c.fy*z,z],b=[(x+step-c.cx)/c.fx*zr,(y-c.cy)/c.fy*zr,zr],d=[(x-c.cx)/c.fx*zd,(y+step-c.cy)/c.fy*zd,zd];
  const nc=norm3(cross3(sub3(b,a),sub3(d,a)));return norm3(mat3Vec(c.rt,nc));
}
function generateFramePoints(win,slot,T,cfg,frameId){
  const base=slot*SIZE*SIZE,confLo=sampledPercentile(win.conf,base,cfg.confQ),confHi=Math.max(confLo+1e-6,sampledPercentile(win.conf,base,.92));
  const depthLo=sampledPercentile(win.depth,base,.004),depthHi=sampledPercentile(win.depth,base,.998),farDepth=sampledPercentile(win.depth,base,cfg.shellQ);
  const c=windowCamera(win,slot),color=win.colors[slot],stride=navigator.gpu?2:3,out=[];
  for(let y=1+stride;y<SIZE-stride-1;y+=stride)for(let x=1+stride;x<SIZE-stride-1;x+=stride){
    const i=base+y*SIZE+x,z=win.depth[i],cf=win.conf[i];if(!Number.isFinite(z)||z<=depthLo||z>=depthHi||cf<confLo)continue;
    const pc=[(x-c.cx)/c.fx*z,(y-c.cy)/c.fy*z,z],local=add3(mat3Vec(c.rt,pc),c.c);
    const confW=Math.max(0,Math.min(1,(cf-confLo)/(confHi-confLo))),edgeW=depthEdgeSoft(win,slot,x,y,z,stride,cfg),support=windowSoftSupport(win,slot,local,cfg);
    const weight=(.28+.72*confW)*(.35+.65*edgeW)*(.42+.58*support);if(weight<.075)continue;
    const world=applySim3(T,local),normal=applySim3Dir(T,frameNormal(win,slot,x,y,z,stride)),ci=(y*SIZE+x)*4;
    out.push({x:world[0],y:world[1],z:world[2],n:normal,r:color[ci],g:color[ci+1],b:color[ci+2],weight,far:z>=farDepth,foot:z/Math.sqrt(Math.max(1,c.fx*c.fy))*stride*T.s,frameId});
  }
  return out;
}
function cameraGlobal(win,frameId){
  const slot=win.frameIds.indexOf(frameId),c=windowCamera(win,slot);
  return{c:applySim3(win.T,c.c),rt:mat3Mul(win.T.R,c.rt)};
}
function dominantNormalKey(n){const a=n.map(Math.abs),axis=a.indexOf(Math.max(...a));return`${axis}${n[axis]>=0?'+':'-'}`;}
function surfaceAwareMerge(points,cfg){
  if(!cfg.voxel)return points.map(p=>({...p,q:quatFromZ(p.n)}));
  const map=new Map();
  for(const p of points){
    const voxel=p.far?cfg.voxel*2.4:cfg.voxel,ix=Math.floor(p.x/voxel),iy=Math.floor(p.y/voxel),iz=Math.floor(p.z/voxel);
    const key=`${p.far?'B':'N'}:${ix},${iy},${iz}:${dominantNormalKey(p.n)}`,w=Math.max(.05,p.weight);
    let a=map.get(key);
    if(!a){a={w:0,x:0,y:0,z:0,nx:0,ny:0,nz:0,r:0,g:0,b:0,sx:0,sy:0,sz:0,alpha:0,far:p.far};map.set(key,a);}
    a.w+=w;a.x+=p.x*w;a.y+=p.y*w;a.z+=p.z*w;a.nx+=p.n[0]*w;a.ny+=p.n[1]*w;a.nz+=p.n[2]*w;a.r+=p.r*w;a.g+=p.g*w;a.b+=p.b*w;a.sx+=p.sx*w;a.sy+=p.sy*w;a.sz+=p.sz*w;a.alpha+=p.alpha*w;
  }
  const out=[];
  for(const a of map.values()){const w=a.w,n=norm3([a.nx/w,a.ny/w,a.nz/w]);out.push({x:a.x/w,y:a.y/w,z:a.z/w,n,r:a.r/w,g:a.g/w,b:a.b/w,sx:a.sx/w,sy:a.sy/w,sz:a.sz/w,alpha:a.alpha/w,far:a.far,q:quatFromZ(n)});}
  return out;
}
function fuseStreamingWindows(windows,frames){
  const cfg=instantConfig(),emitted=new Set(),points=[],alignStats=[];
  for(let wi=0;wi<windows.length;wi++){
    const win=windows[wi];
    if(win.align)alignStats.push(win.align);
    for(const id of win.chronoIds){
      if(emitted.has(id))continue;emitted.add(id);
      const slot=win.frameIds.indexOf(id);if(slot<0)continue;
      points.push(...generateFramePoints(win,slot,win.T,cfg,id));
    }
  }
  if(points.length<2500)throw new Error(`Streaming fusion produced only ${points.length} weighted points. Capture more translation/overlap.`);

  const anchorWin=windows.find(w=>w.frameIds.includes(0))||windows[0],anchor=cameraGlobal(anchorWin,0);
  const right=norm3([anchor.rt[0],anchor.rt[3],anchor.rt[6]]),down=norm3([anchor.rt[1],anchor.rt[4],anchor.rt[7]]),forward=norm3([anchor.rt[2],anchor.rt[5],anchor.rt[8]]);
  const up=mul3(down,-1),back=mul3(forward,-1);
  for(const p of points){const d=sub3([p.x,p.y,p.z],anchor.c);p.x=dot3(d,right);p.y=dot3(d,up);p.z=dot3(d,back);p.n=norm3([dot3(p.n,right),dot3(p.n,up),dot3(p.n,back)]);}
  const near=points.filter(p=>!p.far),sample=(near.length>1000?near:points).filter((_,i)=>i%29===0),rad=Math.max(1e-4,percentile(sample.map(p=>Math.hypot(p.x,p.y,p.z)),.90)),scale=2.45/rad;
  let bg=0;
  for(const p of points){
    p.x*=scale;p.y*=scale;p.z*=scale;p.foot*=scale;
    if(p.far&&cfg.shellQ<.999){const d=norm3([p.x,p.y,p.z]),shell=3.45+.18*(1-p.weight);p.x=d[0]*shell;p.y=d[1]*shell;p.z=d[2]*shell;p.n=mul3(d,-1);bg++;}
    const tangent=p.far&&cfg.shellQ<.999?cfg.bgScale:Math.max(.0018,Math.min(cfg.maxScale,p.foot*cfg.sizeMul));
    p.sx=tangent;p.sy=tangent;p.sz=Math.max(.0012,tangent*(p.far?.72:cfg.thickness));
    p.alpha=Math.max(.30,Math.min(.97,(p.far?cfg.bgOpacity:cfg.opacity)*(.52+.48*p.weight)));
    p.q=quatFromZ(p.n);
  }
  const preMerge=points.length,merged=surfaceAwareMerge(points,cfg);
  let poseSpread=0;const cameraCenters=[];
  for(let id=0;id<frames.length;id++){
    const w=windows.find(x=>x.frameIds.includes(id));if(!w)continue;const cg=cameraGlobal(w,id),d=sub3(cg.c,anchor.c),c=[dot3(d,right)*scale,dot3(d,up)*scale,dot3(d,back)*scale];cameraCenters.push(c);
  }
  for(let i=0;i<cameraCenters.length;i++)for(let j=i+1;j<cameraCenters.length;j++)poseSpread=Math.max(poseSpread,Math.hypot(cameraCenters[i][0]-cameraCenters[j][0],cameraCenters[i][1]-cameraCenters[j][1],cameraCenters[i][2]-cameraCenters[j][2]));
  const avgRmse=alignStats.length?alignStats.reduce((a,b)=>a+b.rmse,0)/alignStats.length:0;
  return{points:merged,poseSpread,confKeep:merged.length/preMerge,stats:{preset:state.instantPreset,clean:state.instantClean,windows:windows.length,views:frames.length,raw:preMerge,mergedAway:preMerge-merged.length,background:bg,avgRmse,alignStats,final:merged.length}};
}
function instantDiag(result){
  const x=result.stats||{};
  return[
    `V7 STREAM     ${x.views||0} VIEWS · ${x.windows||0} WINDOWS`,
    `PRESET        ${String(x.preset||state.instantPreset).toUpperCase()} · CLEAN ${x.clean??state.instantClean}%`,
    `SIM3 RMSE     ${Number(x.avgRmse||0).toFixed(4)}`,
    `RAW SURFELS   ${(x.raw||0).toLocaleString()}`,
    `BACKGROUND    ${(x.background||0).toLocaleString()} → SHELL`,
    `SURFACE MERGE -${(x.mergedAway||0).toLocaleString()}`,
    `FINAL         ${(x.final||result.points.length).toLocaleString()} GAUSSIANS`
  ].join('\n');
}
async function applyInstantResult(result,label='V7 STREAM FUSION'){
  $('metricConf').textContent=`${Math.round(result.confKeep*100)}% packed`;$('metricGauss').textContent=result.points.length.toLocaleString();$('metricPose').textContent=result.poseSpread.toFixed(2);diag(instantDiag(result));
  setStep('fusion',100,'SIM3 LOCK');status('SOFT GAUSSIAN PACK','Encoding weighted surfels','No hard MVS deletion · moderate thickness · surface-aware merge',86);setStep('gauss',30,'PACKING');
  const ply=writeGaussianPLY(result.points);state.plyBlob=ply;if(state.plyUrl)URL.revokeObjectURL(state.plyUrl);state.plyUrl=URL.createObjectURL(ply);setStep('gauss',100,`${(ply.size/1048576).toFixed(1)} MB`);
  status('VIEWER','Starting SuperSplat WebGPU','Loading streamed Gaussian scene',96);await openWorldBlob(state.plyUrl,`${INSTANT_PRESETS[state.instantPreset].label} · V7 STREAM`);setStep('viewer',100,'LIVE');status('DONE','Streaming reality compiled',`${result.points.length.toLocaleString()} Gaussian primitives`,100);
}
async function refilterInstant(){
  if(!state.lastInstant?.windows)return toast('Run one V7 INSTANT reconstruction first');
  try{show('analyze');buildSteps();setStep('keyframes',100,'CACHE');setStep('weights',100,'CACHE');setStep('infer',100,`${state.lastInstant.windows.length} WIN CACHE`);status('REFILTER','Repacking cached streaming geometry',`${INSTANT_PRESETS[state.instantPreset].label} · ${state.instantClean}% CLEAN · no DA3 rerun`,70);await new Promise(r=>requestAnimationFrame(r));const result=fuseStreamingWindows(state.lastInstant.windows,state.lastInstant.frames);await applyInstantResult(result,'V7 REFILTER');}
  catch(err){console.error(err);diag(err.stack||err.message);modal('Refilter stopped',`<p>${escapeHtml(err.message)}</p><p>Move toward DENSE or use RAW.</p>`);show('world');}
}
async function compileWorld(frames,alreadyAnalyze=false){
  show('analyze');buildSteps();renderFrames();state.sourceFrame=frames[Math.min(2,frames.length-1)];setStep('keyframes',100,`${frames.length} VIEWS`);
  $('metricInput').textContent=`${frames.length} × 504² · STREAM`;diag(`V7: overlapping 4-view DA3 windows with dense Sim(3) alignment. ${frames.length} ordered views.`);
  const preview=$('analysisCanvas');preview.width=SIZE;preview.height=SIZE;preview.getContext('2d').drawImage(state.sourceFrame.img,0,0,SIZE,SIZE);
  try{
    const session=await ensureSession(),specs=windowSpecs(frames),windows=[];let totalSec=0;
    for(let wi=0;wi<specs.length;wi++){
      const spec=specs[wi],{tensor,colors}=prepFrames(spec.inputFrames);
      status('DA3 STREAMING',`Window ${wi+1}/${specs.length}`,`Frames ${spec.chrono.map(x=>x+1).join(' · ')} · 50% overlap`,20+wi/specs.length*42);
      setStep('infer',Math.max(10,wi/specs.length*92),`${wi}/${specs.length}`);
      const input=new ort.Tensor('float32',tensor,[1,4,3,SIZE,SIZE]),t0=performance.now(),out=await session.run({images:input});totalSec+=(performance.now()-t0)/1000;
      const data=extractDA3Arrays(out),win={...data,colors,frameIds:spec.inputIds,chronoIds:spec.chrono,T:identitySim3(),align:null};
      if(windows.length){const prev=windows.at(-1),align=estimateWindowSim3(prev,win);win.align=align;win.T=composeSim3(prev.T,align.T);setStep('fusion',Math.max(8,wi/specs.length*82),`SIM3 ${wi}/${specs.length-1}`);}
      windows.push(win);
    }
    setStep('infer',100,`${specs.length} WIN · ${totalSec.toFixed(1)}s`);setStep('fusion',88,'GLOBAL');
    state.lastInstant={windows,frames,createdAt:Date.now()};
    status('STREAM FUSION','Building one global place','Dense overlap alignment · soft confidence · far-field shell',72);
    const result=fuseStreamingWindows(windows,frames);await applyInstantResult(result,'V7 STREAM FUSION');
  }catch(err){console.error(err);diag(err.stack||err.message);modal('V7 reconstruction stopped',`<p>${escapeHtml(err.message)}</p><p>V7 needs temporal overlap. Record while <b>moving sideways/forward</b>; do not only rotate in place. RAW reduces post-fusion cleanup but still keeps streaming alignment.</p>`);show('landing');}
}

function writeGaussianPLY(points){
  const rest=45;let header=`ply\nformat binary_little_endian 1.0\nelement vertex ${points.length}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\n`;
  for(let i=0;i<rest;i++)header+=`property float f_rest_${i}\n`;
  header+=`property float opacity\nproperty float scale_0\nproperty float scale_1\nproperty float scale_2\nproperty float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\nend_header\n`;
  const hb=new TextEncoder().encode(header);const floatsPer=3+3+3+rest+1+3+4;const buf=new ArrayBuffer(hb.length+points.length*floatsPer*4);const u8=new Uint8Array(buf);u8.set(hb,0);const dv=new DataView(buf);let o=hb.length;
  const put=(v)=>{dv.setFloat32(o,v,true);o+=4;};
  for(const p of points){put(p.x);put(p.y);put(p.z);put(p.n?.[0]||0);put(p.n?.[1]||0);put(p.n?.[2]||0);put((p.r/255-.5)/C0);put((p.g/255-.5)/C0);put((p.b/255-.5)/C0);for(let i=0;i<rest;i++)put(0);const alpha=Math.max(.01,Math.min(.99,p.alpha??.94));put(Math.log(alpha/(1-alpha)));put(Math.log(p.sx||.008));put(Math.log(p.sy||.008));put(Math.log(p.sz||.002));const q=p.q||[1,0,0,0];put(q[0]);put(q[1]);put(q[2]);put(q[3]);}
  return new Blob([buf],{type:'application/octet-stream'});
}

async function openWorldBlob(url,label){
  $('worldId').textContent=String(Math.floor(Math.random()*10000)).padStart(4,'0');$('worldBadgeText').textContent=label;syncInstantControls();
  if(state.viewer){ try{state.viewer.destroy();}catch{} state.viewer=null; }
  const container=$('splatViewer'); container.innerHTML=''; show('world'); setStep('viewer',35,'WEBGPU');
  const baseOptions={
    container,
    settings: defaultSettings(),
    contentUrl:url,
    contentFilename: label.includes('IMPORT') ? (state.plyBlob?.name || 'scene.ply') : 'scene.ply',
    ui:true,
    backgroundColor:[0.01,0.01,0.01]
  };
  try{
    state.viewer=await createViewer({...baseOptions,renderer:navigator.gpu?'webgpu':'webgl'});
  }catch(err){
    if(!navigator.gpu) throw err;
    console.warn('SuperSplat WebGPU failed; retrying WebGL',err);
    container.innerHTML='';
    state.viewer=await createViewer({...baseOptions,renderer:'webgl'});
  }
  state.viewer.events.on('progress:changed',(p)=>setStep('viewer',Math.max(35,p),`${Math.round(p)}%`));
  if(state.viewer.state.loaded){state.viewer.frameScene();setStep('viewer',100,'LIVE');}
  else state.viewer.events.once('loaded:changed',()=>{try{state.viewer.frameScene();}catch{} setStep('viewer',100,'LIVE');});
}
function openExistingSplat(file){
  if(state.plyUrl)URL.revokeObjectURL(state.plyUrl);state.plyBlob=file;state.plyUrl=URL.createObjectURL(file);openWorldBlob(state.plyUrl,'LIDAR / SPLAT IMPORT');
}
$('downloadPly').onclick=()=>{if(!state.plyBlob)return;const a=document.createElement('a');a.href=state.plyUrl;a.download=`reality-${Date.now()}.ply`;a.click();};
$('newScan').onclick=()=>{stopCamera();show('landing');};

$('semanticBtn').onclick=async()=>{
  $('semanticPanel').classList.toggle('open');if(state.semantic||!state.sourceFrame)return;
  try{
    $('semanticStatus').textContent='Loading Florence-2…';
    const modelId='onnx-community/Florence-2-base-ft';
    const hasFp16=await gpuFp16();
    const [processor,tokenizer,model]=await Promise.all([
      AutoProcessor.from_pretrained(modelId),AutoTokenizer.from_pretrained(modelId),Florence2ForConditionalGeneration.from_pretrained(modelId,{device:navigator.gpu?'webgpu':'wasm',dtype:{embed_tokens:hasFp16?'fp16':'fp32',vision_encoder:hasFp16?'fp16':'fp32',encoder_model:'q4',decoder_model_merged:'q4'}})
    ]);
    $('semanticStatus').textContent='Mapping objects…';const image=await RawImage.fromURL(state.sourceFrame.url);const vision=await processor(image);const task='<OD>';const prompts=processor.construct_prompts(task);const text=tokenizer(prompts);const ids=await model.generate({...text,...vision,max_new_tokens:128,num_beams:1,do_sample:false});const decoded=tokenizer.batch_decode(ids,{skip_special_tokens:false})[0];const result=processor.post_process_generation(decoded,task,image.size);state.semantic=result;
    const payload=result?.[task]||result;const labels=payload?.labels||[];$('objects').innerHTML=labels.length?labels.map((x,i)=>`<div class="objectRow"><span>${escapeHtml(String(x))}</span><b>#${String(i+1).padStart(2,'0')}</b></div>`).join(''):'<div class="diag">No object labels returned.</div>';$('semanticStatus').textContent=`${labels.length} objects from reference view.`;
  }catch(e){$('semanticStatus').textContent=`Semantic model unavailable: ${e.message}`;}
};
async function gpuFp16(){try{const a=await navigator.gpu?.requestAdapter();return !!a?.features?.has('shader-f16')}catch{return false}}

function metricNotYet(){
  modal('METRIC PIPELINE',`<p><b>Direct LiDAR/splat import is live now.</b></p><p>Use <b>OPEN PLY / SPLAT / SOG</b> with a Scaniverse, Polycam, SplaTAM or other RGB-D export. Automatic SplaTAM capture ingestion is scaffolded for the private GPU node but is not yet exposed as a browser capture protocol.</p>`);
}

async function getProConfig(force=false){
  if(!force && state.proConfig && Date.now()-state.proConfigAt<45000)return state.proConfig;
  const r=await fetch('/api/reality-pro-config',{cache:'no-store'});
  if(!r.ok)throw new Error(`GPU config HTTP ${r.status}`);
  const j=await r.json();state.proConfig=j;state.proConfigAt=Date.now();return j;
}

function loadSavedProJob(){
  try{
    const x=JSON.parse(localStorage.getItem(PRO_JOB_KEY)||'null');
    if(!x?.job_id||!x?.access_token||!x?.backend)return null;
    if(Date.now()-(x.saved_at||0)>26*3600*1000){localStorage.removeItem(PRO_JOB_KEY);return null;}
    return x;
  }catch{return null;}
}
function rememberProJob(cfg,job,mode){
  try{
    localStorage.setItem(PRO_JOB_KEY,JSON.stringify({
      backend:cfg.backend,job_id:job.job_id,access_token:job.access_token,
      mode,saved_at:Date.now()
    }));
  }catch{}
}
async function loadWorkerResult(cfg,job,done){
  setStep('export',100,done.splats?`${Number(done.splats).toLocaleString()} GS`:'DONE');
  status('DOWNLOAD','Streaming optimized Gaussian PLY','Loading trained splats into SuperSplat',98);
  const rr=await fetch(`${cfg.backend}/jobs/${encodeURIComponent(job.job_id)}/result`,{
    headers:{'X-Reality-Job-Token':job.access_token}
  });
  if(!rr.ok)throw new Error(`GPU result HTTP ${rr.status}: ${await rr.text()}`);
  const blob=await rr.blob();
  if(blob.size<1024)throw new Error('GPU worker returned an unexpectedly small PLY.');
  state.plyBlob=blob;
  if(state.plyUrl)URL.revokeObjectURL(state.plyUrl);
  state.plyUrl=URL.createObjectURL(blob);
  setStep('viewer',25,'LOAD');
  await openWorldBlob(state.plyUrl,state.mode==='ultra'?'ULTRA · SPLATFACTO BIG 30K':'PRO · SPLATFACTO 30K');
  setStep('viewer',100,'LIVE');
  status('DONE','Optimized room-scale Gaussian world',`${(blob.size/1048576).toFixed(1)} MB · ${done.splats?Number(done.splats).toLocaleString()+' splats · ':''}30K training`,100);
}
async function resumeSavedProJob(){
  const saved=loadSavedProJob();
  if(!saved)return toast('No resumable GPU job');
  state.mode=saved.mode==='ultra'?'ultra':'pro';
  show('analyze');buildSteps();
  status('RESUME','Reconnecting to GPU reconstruction',saved.job_id,3);
  try{
    const cfg={backend:saved.backend};
    const done=await pollWorkerJob(cfg,saved);
    await loadWorkerResult(cfg,saved,done);
  }catch(err){
    console.error(err);diag(err.stack||err.message);
    modal('Could not resume GPU job',`<p>${escapeHtml(err.message)}</p><p>The worker retains completed results for about 24 hours by default.</p>`);
    if(/404|Unknown job|Invalid job/i.test(String(err.message)))localStorage.removeItem(PRO_JOB_KEY);
    show('landing');
  }
}

function workerStep(stage,progress){
  const p=Math.max(0,Math.min(100,Number(progress)||0));
  if(stage==='queued'){setStep('upload',10,'QUEUED');}
  if(stage==='preflight'){setStep('upload',100,'DONE');setStep('infer',Math.min(100,p*4),'CHECK');}
  if(stage==='camera_solve'){setStep('upload',100,'DONE');setStep('infer',100,'FRAMES');setStep('fusion',Math.max(5,Math.min(100,(p-5)*5)),'SOLVING');}
  if(stage==='gaussian_optimization'){setStep('fusion',100,'DONE');setStep('gauss',Math.max(1,Math.min(100,(p-25)/63*100)),`${Math.round(Math.max(0,(p-25)/63*30000))}/30K`);}
  if(stage==='export'||stage==='evaluation'||stage==='finalize'){setStep('gauss',100,'30K DONE');setStep('export',Math.max(10,Math.min(100,(p-88)/11*100)),'EXPORT');}
}

async function pollWorkerJob(cfg,job){
  while(true){
    await new Promise(r=>setTimeout(r,1800));
    const r=await fetch(`${cfg.backend}/jobs/${encodeURIComponent(job.job_id)}`,{
      cache:'no-store',
      headers:{'X-Reality-Job-Token':job.access_token}
    });
    if(!r.ok)throw new Error(`GPU job status HTTP ${r.status}`);
    const j=await r.json();
    state.proJob=j;
    workerStep(j.stage,j.progress);
    const tail=(j.log_tail||[]).slice(-8).join('\n');
    diag(JSON.stringify({job:j.job_id,status:j.status,stage:j.stage,progress:j.progress,splats:j.splats||null,video:j.video||null},null,2)+(tail?'\n\n'+tail:''));
    status(
      j.stage==='gaussian_optimization'?'GSPLAT OPTIMIZATION':'GPU RECONSTRUCTION',
      j.stage==='gaussian_optimization'?'Densifying and optimizing the room':'Building the commercial room reconstruction',
      `${Math.round(j.progress||0)}% · ${j.status}`,
      j.progress||0
    );
    if(j.status==='error')throw new Error(j.error||'GPU worker failed');
    if(j.status==='done')return j;
  }
}

async function submitPro({video=null,images=[]}){
  show('analyze');buildSteps();
  const ultra=state.mode==='ultra';
  status('GPU PREFLIGHT','Checking commercial reconstruction worker',ultra?'SPLATFACTO BIG · 30K':'SPLATFACTO · 30K',2);
  try{
    const cfg=await getProConfig(true);
    if(!cfg.configured){
      throw new Error('Commercial GPU worker is built but not deployed/configured yet (REALITY_PRO_BACKEND_URL missing).');
    }
    if(!cfg.health?.ok)throw new Error(`GPU worker is unreachable: ${cfg.health?.error||cfg.health?.status||'health check failed'}`);
    if(cfg.health.gpu===false)throw new Error('GPU worker is reachable but CUDA is not available.');

    const form=new FormData();
    form.append('mode',ultra?'ultra':'pro');
    form.append('frames_target',ultra?'240':'140');
    if(video){
      form.append('file',video,video.name||'capture.mp4');
    }else{
      const selected=spreadFiles(images,ultra?240:140);
      selected.forEach((f,i)=>form.append('files',f,f.name||`view-${String(i).padStart(4,'0')}.jpg`));
    }

    setStep('upload',12,'UPLOAD');
    status('GPU UPLOAD','Uploading capture to the private worker',video?(video.name||'video'):`${images.length} images`,7);
    const create=await fetch(`${cfg.backend}/jobs`,{
      method:'POST',
      headers:{Authorization:`Bearer ${cfg.token}`},
      body:form
    });
    if(!create.ok)throw new Error(`GPU job creation HTTP ${create.status}: ${await create.text()}`);
    const job=await create.json();
    state.proJob=job;
    rememberProJob(cfg,job,ultra?'ultra':'pro');
    setStep('upload',100,'DONE');
    diag(JSON.stringify({backend:cfg.backend,job_id:job.job_id,mode:job.mode,frames_target:job.frames_target},null,2));

    const done=await pollWorkerJob(cfg,job);
    await loadWorkerResult(cfg,job,done);
  }catch(err){
    console.error(err);diag(err.stack||err.message);
    modal('PRO reconstruction stopped',`<p>${escapeHtml(err.message)}</p><p><b>INSTANT</b> remains local. PRO/ULTRA now intentionally require our own private CUDA worker; the public Hugging Face Space is no longer presented as production infrastructure.</p>`);
    show('landing');refreshProStatus();
  }
}

function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// Explain advanced engines without pretending they run in-browser when they do not.
addEventListener('keydown',(e)=>{
  if(e.key.toLowerCase()==='i' && e.shiftKey) modal('ENGINE MATRIX · V6',`<p><b>INSTANT / LIVE:</b> DA3-BASE-derived 4-view ONNX → pose-aware fusion → Gaussian PLY → SuperSplat WebGPU.</p><p><b>PRO / PRIVATE GPU:</b> video/images → COLMAP camera solve → Nerfstudio Splatfacto/gsplat → 30,000 iterative steps → Gaussian PLY → SuperSplat.</p><p><b>ULTRA / PRIVATE GPU:</b> Splatfacto Big, more source views and denser Gaussian optimization.</p><p><b>LAB:</b> public DA3 Spaces remain audit/reference only; they are not the commercial backend.</p><p><b>METRIC / PARTIAL:</b> direct PLY/SPLAT/SOG import is live; automatic SplaTAM RGB-D ingestion remains the next backend adapter.</p><p><b>SEMANTICS / LIVE:</b> Florence-2 WebGPU after geometry.</p><p><b>EXCLUDED FROM COMMERCIAL CORE:</b> non-commercial model weights / repos are not silently shipped.</p>`);
});

