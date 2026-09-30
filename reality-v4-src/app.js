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

function targetViews(){ return state.mode==='instant' ? 4 : (state.mode==='metric' ? 4 : (state.mode==='ultra' ? 24 : 48)); }
const INSTANT_PRESETS={
  terrace:{label:'TERRACE',confQ:.44,depthLo:.010,depthHi:.982,edgeRel:.085,mvsTol:.085,minAgree:1,allowOrphan:false,sky:true,voxel:.0075,neighbors:1,maxScale:.0115,sizeMul:.58,thickness:.10,opacity:.90,manhattan:.82},
  interior:{label:'INTERIOR',confQ:.36,depthLo:.008,depthHi:.994,edgeRel:.115,mvsTol:.105,minAgree:1,allowOrphan:false,sky:false,voxel:.0065,neighbors:1,maxScale:.0140,sizeMul:.68,thickness:.12,opacity:.93,manhattan:.88},
  object:{label:'OBJECT',confQ:.33,depthLo:.006,depthHi:.997,edgeRel:.095,mvsTol:.115,minAgree:1,allowOrphan:true,sky:false,voxel:.0045,neighbors:0,maxScale:.0090,sizeMul:.52,thickness:.08,opacity:.95,manhattan:0},
  raw:{label:'RAW',confQ:.22,depthLo:.004,depthHi:.999,edgeRel:999,mvsTol:999,minAgree:0,allowOrphan:true,sky:false,voxel:0,neighbors:0,maxScale:.0260,sizeMul:1.12,thickness:.22,opacity:.965,manhattan:0}
};
function instantConfig(){
  const base=INSTANT_PRESETS[state.instantPreset]||INSTANT_PRESETS.interior;
  if(state.instantPreset==='raw')return {...base,clean:state.instantClean/100};
  const clean=Math.max(0,Math.min(1,state.instantClean/100));
  return {
    ...base,clean,
    confQ:Math.max(.22,Math.min(.62,base.confQ+(clean-.55)*.12)),
    depthHi:Math.max(.94,base.depthHi-clean*.0045),
    edgeRel:base.edgeRel*(1.22-.48*clean),
    mvsTol:base.mvsTol*(1.22-.42*clean),
    voxel:base.voxel*(.78+.48*clean),
    maxScale:base.maxScale*(1.12-.34*clean),
    sizeMul:base.sizeMul*(1.10-.38*clean),
    thickness:base.thickness*(1.10-.34*clean),
    opacity:Math.max(.86,Math.min(.96,base.opacity+(clean-.5)*.025))
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
  if(brandSmall) brandSmall.textContent='V6.2 · CLEAN MULTIVIEW FUSION';
  const health=document.querySelector('.health');
  if(health && !$('proChip')){
    const chip=document.createElement('span'); chip.id='proChip'; chip.textContent='PRO GPU · CHECK'; health.appendChild(chip);
  }
  const card=document.querySelector('.capture-card');
  if(card && !$('modeSwitch')){
    const wrap=document.createElement('div');
    wrap.id='modeSwitch'; wrap.className='modeSwitch';
    wrap.innerHTML=`
      <button data-mode="instant" class="active"><b>INSTANT</b><small>4-view · local</small></button>
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
      ? 'Fast local preview. Four overlapping views are reconstructed in your browser.'
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
    : [['keyframes','KEYFRAMES'],['weights','DA3 WEIGHTS'],['infer','MULTIVIEW INFERENCE'],['fusion','POSE FUSION'],['gauss','GAUSSIAN PACK'],['viewer','SPLAT VIEWER']];
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
  const guides=['MOVE SLOWLY TO THE RIGHT →','ARC AROUND THE SCENE ↗','CAPTURE THE OTHER SIDE ←','ENOUGH PARALLAX · BUILD'];$('captureGuide').textContent=guides[Math.min(state.frames.length,4)-1]||guides[0];
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
    compileWorld(state.frames.slice(0,4));
  }
};

async function extractVideoFrames(file){
  show('analyze'); buildSteps(); status('VIDEO ANALYSIS','Finding four strong viewpoints','Sharpness + temporal spread + appearance diversity',4);diag('Decoding video locally. No upload.');
  const url=URL.createObjectURL(file);const v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=url;await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=rej;});
  const dur=Math.max(.1,v.duration);const samples=[];const N=Math.min(20,Math.max(12,Math.round(dur*2)));
  for(let i=0;i<N;i++){
    const t=(dur*.05)+(dur*.9)*(i/(N-1)); v.currentTime=t; await new Promise(r=>{v.onseeked=()=>r();});
    const fr=await sourceToFrame(v,`T${t.toFixed(1)}s`); fr.t=t;samples.push(fr);status('VIDEO ANALYSIS','Finding four strong viewpoints',`Candidate ${i+1}/${N}`,4+10*(i+1)/N);
  }
  URL.revokeObjectURL(url);
  // Four temporal quartiles; choose sharpest frame in each, penalizing similarity to already chosen views.
  const chosen=[];
  for(let q=0;q<4;q++){
    const a=Math.floor(q*N/4),b=Math.max(a+1,Math.floor((q+1)*N/4));const group=samples.slice(a,b);
    let best=null,bestScore=-Infinity;
    for(const fr of group){const diversity=chosen.length?Math.min(...chosen.map(c=>diffOf(fr.sig,c.sig))):50;const score=Math.log1p(fr.sharp)*14+diversity;if(score>bestScore){bestScore=score;best=fr;}}
    chosen.push(best);
  }
  for(const fr of samples) if(!chosen.includes(fr)) URL.revokeObjectURL(fr.url);
  state.frames=chosen;renderFrames(); setStep('keyframes',100,'4 VIEWS'); await compileWorld(chosen,true);
}
async function choosePhotoFrames(files){
  show('analyze');buildSteps();status('PHOTO ANALYSIS','Selecting the best four views','Prefer overlapping views with lateral movement',5);
  const all=[];for(let i=0;i<files.length;i++){const {img,url,blob}=await blobToImage(files[i]);const fr=await sourceToFrame(img,files[i].name);URL.revokeObjectURL(url);all.push(fr);}
  if(all.length<4){modal('Need four views','<p>DA3 multiview needs exactly <b>4 views</b>. Upload at least four overlapping photos.</p>');show('landing');return;}
  const chosen=[]; let first=all.reduce((a,b)=>b.sharp>a.sharp?b:a);chosen.push(first);
  while(chosen.length<4){let best=null,score=-1;for(const fr of all){if(chosen.includes(fr))continue;const div=Math.min(...chosen.map(c=>diffOf(fr.sig,c.sig)));const s=Math.log1p(fr.sharp)*12+div*1.4;if(s>score){score=s;best=fr;}}chosen.push(best);}
  for(const fr of all)if(!chosen.includes(fr))URL.revokeObjectURL(fr.url);state.frames=chosen;renderFrames();setStep('keyframes',100,'4 VIEWS');await compileWorld(chosen,true);
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


function instantDiag(result){
  const x=result.stats||{};
  return [
    `PRESET       ${String(x.preset||state.instantPreset).toUpperCase()} · CLEAN ${x.clean??state.instantClean}%`,
    `CANDIDATES   ${(x.candidates||0).toLocaleString()}`,
    `CONF/RANGE   -${((x.confidenceRejected||0)+(x.rangeRejected||0)).toLocaleString()}`,
    `DEPTH EDGES  -${(x.edgeRejected||0).toLocaleString()}`,
    `SKY/BG       -${(x.skyRejected||0).toLocaleString()}`,
    `MVIEW FAIL   -${(x.mvsRejected||0).toLocaleString()}`,
    `VOXEL MERGE  -${(x.mergedAway||0).toLocaleString()}`,
    `ISLANDS      -${(x.islandRejected||0).toLocaleString()}`,
    `FINAL        ${(x.final||result.points.length).toLocaleString()} GAUSSIANS`
  ].join('\n');
}
async function applyInstantResult(result,label='DA3 CLEAN FUSION'){
  $('metricConf').textContent=`${Math.round(result.confKeep*100)}% final`;
  $('metricGauss').textContent=result.points.length.toLocaleString();
  $('metricPose').textContent=result.poseSpread.toFixed(2);
  diag(instantDiag(result));
  setStep('fusion',100,'CLEAN');
  status('GAUSSIAN PACK','Encoding filtered splats','MVS consistency · voxel merge · anisotropic surfaces',84);setStep('gauss',25,'PACKING');
  const ply=writeGaussianPLY(result.points);state.plyBlob=ply;
  if(state.plyUrl)URL.revokeObjectURL(state.plyUrl);state.plyUrl=URL.createObjectURL(ply);
  setStep('gauss',100,`${(ply.size/1048576).toFixed(1)} MB`);
  status('VIEWER','Starting SuperSplat WebGPU','Loading cleaned Gaussian scene',95);
  await openWorldBlob(state.plyUrl,`${INSTANT_PRESETS[state.instantPreset].label} · ${state.instantClean}% CLEAN`);
  setStep('viewer',100,'LIVE');
  status('DONE','Reality cleaned',`${result.points.length.toLocaleString()} Gaussian primitives`,100);
}
async function refilterInstant(){
  if(!state.lastInstant?.out||!state.lastInstant?.colors)return toast('Run one INSTANT reconstruction first');
  try{
    show('analyze');buildSteps();setStep('keyframes',100,'CACHE');setStep('weights',100,'CACHE');setStep('infer',100,'CACHE');
    status('REFILTER','Rebuilding the same DA3 geometry',`${INSTANT_PRESETS[state.instantPreset].label} · ${state.instantClean}% CLEAN · no model rerun`,65);
    await new Promise(r=>requestAnimationFrame(()=>r()));
    const result=fuseDA3(state.lastInstant.out,state.lastInstant.colors);
    await applyInstantResult(result,'DA3 REFILTER');
  }catch(err){
    console.error(err);diag(err.stack||err.message);modal('Refilter stopped',`<p>${escapeHtml(err.message)}</p><p>Move the slider toward <b>DENSE</b> or choose RAW.</p>`);show('world');
  }
}

async function compileWorld(frames,alreadyAnalyze=false){
  show('analyze');buildSteps();renderFrames();setStep('keyframes',100,'4 VIEWS');state.sourceFrame=frames[0];
  $('metricInput').textContent=`4 × 504² · ${INSTANT_PRESETS[state.instantPreset].label}`;
  diag(`True 4-view DA3 inference. Fusion preset: ${INSTANT_PRESETS[state.instantPreset].label}; CLEAN ${state.instantClean}%.`);
  const preview=$('analysisCanvas');preview.width=SIZE;preview.height=SIZE;preview.getContext('2d').drawImage(frames[0].img,0,0,SIZE,SIZE);
  try{
    status('PREPROCESS','Normalizing four views','ImageNet normalization · NCHW',12);const {tensor,colors}=prepFrames(frames);
    const session=await ensureSession();
    status('MULTIVIEW INFERENCE','Recovering visual space','Depth · confidence · intrinsics · extrinsics',50);setStep('infer',35,'RUNNING');
    const input=new ort.Tensor('float32',tensor,[1,4,3,SIZE,SIZE]);
    const t0=performance.now(),out=await session.run({images:input}),dt=(performance.now()-t0)/1000;
    state.lastInstant={out,colors,frames,createdAt:Date.now()};
    setStep('infer',100,`${dt.toFixed(1)}s`);
    status('CLEAN FUSION','Cross-checking every point against other cameras','Depth edges · MVS consistency · sky/background · voxel merge',70);setStep('fusion',15,'FILTER');
    const result=fuseDA3(out,colors);
    await applyInstantResult(result,'DA3 CLEAN FUSION');
  }catch(err){
    console.error(err);diag(err.stack||err.message);
    modal('Reconstruction stopped',`<p>${escapeHtml(err.message)}</p><p>The local path is intentionally strict now. Try <b>RAW</b> or move CLEAN toward DENSE if a difficult scene loses too much geometry.</p>`);
    show('landing');
  }
}

function percentile(arr,p){const a=Array.from(arr).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return 0;return a[Math.min(a.length-1,Math.max(0,Math.floor((a.length-1)*p)))];}
function invertRt(ext,base){
  // world->camera [R|t]. Return camera->world R^T and translation -R^T t.
  const r=[ext[base],ext[base+1],ext[base+2],ext[base+4],ext[base+5],ext[base+6],ext[base+8],ext[base+9],ext[base+10]];
  const t=[ext[base+3],ext[base+7],ext[base+11]]; const rt=[r[0],r[3],r[6],r[1],r[4],r[7],r[2],r[5],r[8]];
  const c=[-(rt[0]*t[0]+rt[1]*t[1]+rt[2]*t[2]),-(rt[3]*t[0]+rt[4]*t[1]+rt[5]*t[2]),-(rt[6]*t[0]+rt[7]*t[1]+rt[8]*t[2])]; return {rt,c};
}
function norm3(v){const n=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/n,v[1]/n,v[2]/n];}
function dot3(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross3(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function quatFromZ(n){
  n=norm3(n); const d=Math.max(-1,Math.min(1,n[2]));
  if(d<-0.9999)return [0,1,0,0];
  const w=Math.sqrt((1+d)*.5), k=1/(2*w||1);
  return [w,-n[1]*k,n[0]*k,0];
}

function bilinearDepth(arr,base,x,y){
  if(x<0||y<0||x>SIZE-1||y>SIZE-1)return NaN;
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(SIZE-1,x0+1),y1=Math.min(SIZE-1,y0+1);
  const tx=x-x0,ty=y-y0;
  const a=arr[base+y0*SIZE+x0],b=arr[base+y0*SIZE+x1],c=arr[base+y1*SIZE+x0],d=arr[base+y1*SIZE+x1];
  if(![a,b,c,d].every(Number.isFinite))return NaN;
  return a*(1-tx)*(1-ty)+b*tx*(1-ty)+c*(1-tx)*ty+d*tx*ty;
}
function localDepthEdge(depth,base,x,y,z,step){
  let mx=0,valid=0;
  for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]){
    const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=SIZE||yy>=SIZE)continue;
    const d=depth[base+yy*SIZE+xx];if(!Number.isFinite(d)||d<=0)continue;
    mx=Math.max(mx,Math.abs(d-z)/Math.max(.001,(Math.abs(d)+Math.abs(z))*.5));valid++;
  }
  return valid?mx:0;
}
function likelySky(r,g,b,y,z,farDepth){
  const max=Math.max(r,g,b),min=Math.min(r,g,b),sat=max?((max-min)/max):0;
  const upper=y<SIZE*.62;
  const blue=upper&&b>95&&b>r*1.055&&b>g*1.015&&(b-r)>9;
  const cloud= y<SIZE*.34 && max>188 && sat<.10 && z>farDepth;
  return blue||cloud;
}
function multiviewAgreement(wx,wy,wz,src,depth,conf,viewParams,confFloor,tol){
  let agree=0,visible=0,occluded=0;
  for(let j=0;j<4;j++){
    if(j===src)continue;
    const v=viewParams[j],R=v.R,t=v.t;
    const xc=R[0]*wx+R[1]*wy+R[2]*wz+t[0];
    const yc=R[3]*wx+R[4]*wy+R[5]*wz+t[1];
    const zc=R[6]*wx+R[7]*wy+R[8]*wz+t[2];
    if(zc<=1e-5)continue;
    const u=v.fx*xc/zc+v.cx,py=v.fy*yc/zc+v.cy;
    if(u<1||py<1||u>SIZE-2||py>SIZE-2)continue;
    const ii=j*SIZE*SIZE+Math.round(py)*SIZE+Math.round(u);
    if(conf[ii]<confFloor*.72)continue;
    const dz=bilinearDepth(depth,j*SIZE*SIZE,u,py);
    if(!Number.isFinite(dz)||dz<=0)continue;
    // A nearer observed surface can legitimately occlude this point.
    if(zc>dz*(1+tol*1.7)){occluded++;continue;}
    visible++;
    const rel=Math.abs(dz-zc)/Math.max(.001,(Math.abs(dz)+Math.abs(zc))*.5);
    if(rel<=tol)agree++;
  }
  return {agree,visible,occluded};
}
function snapManhattan(n,strength){
  if(!strength)return n;
  const a=n.map(Math.abs),axis=a.indexOf(Math.max(...a));
  if(a[axis]<strength)return n;
  const out=[0,0,0];out[axis]=n[axis]>=0?1:-1;return out;
}
function voxelMerge(points,voxel){
  if(!voxel||points.length<2)return points;
  const map=new Map();
  for(const p of points){
    const ix=Math.floor(p.x/voxel),iy=Math.floor(p.y/voxel),iz=Math.floor(p.z/voxel),key=`${ix},${iy},${iz}`;
    let a=map.get(key);
    if(!a){a={key,ix,iy,iz,n:0,x:0,y:0,z:0,nx:0,ny:0,nz:0,r:0,g:0,b:0,sx:0,sy:0,sz:0,conf:0,alpha:0,mask:0};map.set(key,a);}
    a.n++;a.x+=p.x;a.y+=p.y;a.z+=p.z;a.nx+=p.n[0];a.ny+=p.n[1];a.nz+=p.n[2];a.r+=p.r;a.g+=p.g;a.b+=p.b;
    a.sx+=p.sx;a.sy+=p.sy;a.sz+=p.sz;a.conf+=p.conf;a.alpha+=p.alpha;a.mask|=(1<<p.view);
  }
  const out=[];
  for(const a of map.values()){
    const n=a.n,normal=norm3([a.nx/n,a.ny/n,a.nz/n]);
    out.push({x:a.x/n,y:a.y/n,z:a.z/n,n:normal,r:a.r/n,g:a.g/n,b:a.b/n,sx:a.sx/n,sy:a.sy/n,sz:a.sz/n,conf:a.conf/n,alpha:a.alpha/n,q:quatFromZ(normal),_cell:[a.ix,a.iy,a.iz],viewMask:a.mask});
  }
  return out;
}
function pruneIsolatedVoxels(points,minNeighbors){
  if(!minNeighbors||points.length<2)return {points,rejected:0};
  const set=new Set(points.map(p=>p._cell?.join(',')));
  const kept=[];
  for(const p of points){
    const [x,y,z]=p._cell||[0,0,0];let near=0;
    outer:for(let dz=-1;dz<=1;dz++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(!dx&&!dy&&!dz)continue;
      if(set.has(`${x+dx},${y+dy},${z+dz}`)&&++near>=minNeighbors)break outer;
    }
    if(near>=minNeighbors)kept.push(p);
  }
  return {points:kept,rejected:points.length-kept.length};
}
function fuseDA3(out,colors){
  const depth=out.depth?.data||out[Object.keys(out).find(k=>k.includes('depth')&&!k.includes('conf'))]?.data;
  const conf=out.depth_conf?.data||out[Object.keys(out).find(k=>k.includes('conf'))]?.data;
  const ext=out.extrinsics?.data||out[Object.keys(out).find(k=>k.includes('extr'))]?.data;
  const K=out.intrinsics?.data||out[Object.keys(out).find(k=>k.includes('intr'))]?.data;
  if(!depth||!conf||!ext||!K)throw new Error(`Unexpected DA3 outputs: ${Object.keys(out).join(', ')}`);

  const cfg=instantConfig(),plane=SIZE*SIZE;
  const sampleConf=[];for(let i=0;i<conf.length;i+=19)if(Number.isFinite(conf[i]))sampleConf.push(conf[i]);
  const confTh=percentile(sampleConf,cfg.confQ);
  const sampleDepth=[];for(let i=0;i<depth.length;i+=19)if(Number.isFinite(depth[i])&&depth[i]>0)sampleDepth.push(depth[i]);
  const dLo=percentile(sampleDepth,cfg.depthLo),dHi=percentile(sampleDepth,cfg.depthHi),farDepth=percentile(sampleDepth,.82);
  const viewParams=[],cams=[];
  for(let v=0;v<4;v++){
    const ebase=v*12,kbase=v*9,{rt,c}=invertRt(ext,ebase);
    cams.push({c,rt});
    viewParams.push({
      R:[ext[ebase],ext[ebase+1],ext[ebase+2],ext[ebase+4],ext[ebase+5],ext[ebase+6],ext[ebase+8],ext[ebase+9],ext[ebase+10]],
      t:[ext[ebase+3],ext[ebase+7],ext[ebase+11]],
      fx:K[kbase],fy:K[kbase+4],cx:K[kbase+2],cy:K[kbase+5]
    });
  }

  const stats={preset:state.instantPreset,clean:state.instantClean,candidates:0,confidenceRejected:0,rangeRejected:0,edgeRejected:0,skyRejected:0,mvsRejected:0,preMerge:0,mergedAway:0,islandRejected:0,final:0};
  const points=[],stride=navigator.gpu?2:3;
  for(let v=0;v<4;v++){
    const {c,rt}=cams[v],vp=viewParams[v],base=v*plane;
    for(let y=1+stride;y<SIZE-stride-1;y+=stride)for(let x=1+stride;x<SIZE-stride-1;x+=stride){
      stats.candidates++;
      const pi=base+y*SIZE+x,z=depth[pi],cf=conf[pi];
      if(!Number.isFinite(z)||z<=dLo||z>=dHi){stats.rangeRejected++;continue;}
      if(cf<confTh){stats.confidenceRejected++;continue;}
      const edge=localDepthEdge(depth,base,x,y,z,stride);
      if(edge>cfg.edgeRel){stats.edgeRejected++;continue;}

      const ci=(y*SIZE+x)*4,r=colors[v][ci],g=colors[v][ci+1],b=colors[v][ci+2];
      if(cfg.sky&&likelySky(r,g,b,y,z,farDepth)){stats.skyRejected++;continue;}

      const xc=(x-vp.cx)/vp.fx*z,yc=(y-vp.cy)/vp.fy*z,zc=z;
      const wx=rt[0]*xc+rt[1]*yc+rt[2]*zc+c[0];
      const wy=rt[3]*xc+rt[4]*yc+rt[5]*zc+c[1];
      const wz=rt[6]*xc+rt[7]*yc+rt[8]*zc+c[2];

      if(cfg.minAgree){
        const mv=multiviewAgreement(wx,wy,wz,v,depth,conf,viewParams,confTh,cfg.mvsTol);
        if(mv.agree<cfg.minAgree && !(cfg.allowOrphan&&mv.visible===0)){stats.mvsRejected++;continue;}
      }

      let nw=[0,0,1];
      const zr=depth[pi+stride],zd=depth[pi+stride*SIZE];
      if(Number.isFinite(zr)&&Number.isFinite(zd)&&zr>0&&zd>0){
        const ar=[xc,yc,zc];
        const br=[(x+stride-vp.cx)/vp.fx*zr,(y-vp.cy)/vp.fy*zr,zr];
        const dr=[(x-vp.cx)/vp.fx*zd,(y+stride-vp.cy)/vp.fy*zd,zd];
        const t1=[br[0]-ar[0],br[1]-ar[1],br[2]-ar[2]],t2=[dr[0]-ar[0],dr[1]-ar[1],dr[2]-ar[2]];
        const nc=norm3(cross3(t1,t2));
        nw=norm3([rt[0]*nc[0]+rt[1]*nc[1]+rt[2]*nc[2],rt[3]*nc[0]+rt[4]*nc[1]+rt[5]*nc[2],rt[6]*nc[0]+rt[7]*nc[1]+rt[8]*nc[2]]);
      }
      points.push({x:wx,y:wy,z:wz,nw,r,g,b,depth:z,conf:cf,view:v,foot:z/Math.sqrt(Math.max(1,vp.fx*vp.fy))*stride});
    }
  }
  if(points.length<1800)throw new Error(`${INSTANT_PRESETS[state.instantPreset].label} filtering left only ${points.length} points. Move DENSE↔CLEAN toward DENSE or capture with more overlap.`);

  const c0=cams[0].c,rt0=cams[0].rt;
  const right=norm3([rt0[0],rt0[3],rt0[6]]),down=norm3([rt0[1],rt0[4],rt0[7]]),forward=norm3([rt0[2],rt0[5],rt0[8]]);
  const up=[-down[0],-down[1],-down[2]],back=[-forward[0],-forward[1],-forward[2]];
  for(const p of points){
    const d=[p.x-c0[0],p.y-c0[1],p.z-c0[2]];
    p.x=dot3(d,right);p.y=dot3(d,up);p.z=dot3(d,back);
    p.n=snapManhattan(norm3([dot3(p.nw,right),dot3(p.nw,up),dot3(p.nw,back)]),cfg.manhattan);
  }

  const sample=points.filter((_,i)=>i%31===0);
  const mx=percentile(sample.map(p=>p.x),.5),my=percentile(sample.map(p=>p.y),.5),mz=percentile(sample.map(p=>p.z),.5);
  const radii=sample.map(p=>Math.hypot(p.x-mx,p.y-my,p.z-mz));
  const rad=Math.max(1e-4,percentile(radii,.90)),scale=2.8/rad;
  for(const p of points){
    p.x=(p.x-mx)*scale;p.y=(p.y-my)*scale;p.z=(p.z-mz)*scale;
    const tangent=Math.max(.0017,Math.min(cfg.maxScale,p.foot*scale*cfg.sizeMul));
    const far=Math.max(0,Math.min(1,(p.depth-dLo)/Math.max(1e-5,dHi-dLo)));
    const farShrink=cfg.sky?1-.30*Math.max(0,(far-.65)/.35):1;
    p.sx=tangent*farShrink;p.sy=tangent*farShrink;p.sz=Math.max(.0007,tangent*cfg.thickness);
    p.alpha=Math.max(.72,cfg.opacity-(cfg.sky?Math.max(0,far-.72)*.22:0));
    p.q=quatFromZ(p.n);
  }

  stats.preMerge=points.length;
  let cleanPoints=voxelMerge(points,cfg.voxel);
  stats.mergedAway=points.length-cleanPoints.length;
  const island=pruneIsolatedVoxels(cleanPoints,cfg.neighbors);
  cleanPoints=island.points;stats.islandRejected=island.rejected;stats.final=cleanPoints.length;
  if(cleanPoints.length<1200)throw new Error(`Fusion cleanup left only ${cleanPoints.length} Gaussians. Move the CLEAN slider toward DENSE.`);

  let poseSpread=0;
  const canonCams=cams.map(cam=>{const d=[cam.c[0]-c0[0],cam.c[1]-c0[1],cam.c[2]-c0[2]];return [dot3(d,right)*scale,dot3(d,up)*scale,dot3(d,back)*scale];});
  for(let i=0;i<canonCams.length;i++)for(let j=i+1;j<canonCams.length;j++)poseSpread=Math.max(poseSpread,Math.hypot(canonCams[i][0]-canonCams[j][0],canonCams[i][1]-canonCams[j][1],canonCams[i][2]-canonCams[j][2]));
  return {points:cleanPoints,confKeep:cleanPoints.length/Math.max(1,stats.candidates),poseSpread,stats,cfg};
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

