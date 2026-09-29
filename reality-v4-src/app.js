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

function installV4UI(){
  const brandSmall=document.querySelector('.brand small');
  if(brandSmall) brandSmall.textContent='V5 · ROOM-SCALE GAUSSIAN PIPELINE';
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
      <button data-mode="pro"><b>PRO</b><small>full scan · DA3 GS</small></button>
      <button data-mode="ultra"><b>ULTRA</b><small>high-res · DA3 GS</small></button>
      <button data-mode="metric"><b>METRIC</b><small>LiDAR / RGB-D</small></button>`;
    const actions=card.querySelector('.actions'); card.insertBefore(wrap,actions);
    wrap.querySelectorAll('button').forEach(btn=>btn.onclick=()=>setMode(btn.dataset.mode));
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

async function compileWorld(frames,alreadyAnalyze=false){
  show('analyze');buildSteps();renderFrames();setStep('keyframes',100,'4 VIEWS');state.sourceFrame=frames[0];
  $('metricInput').textContent='4 × 504²';diag('True 4-view inference. Depth and camera poses are solved together.');
  const preview=$('analysisCanvas');preview.width=SIZE;preview.height=SIZE;preview.getContext('2d').drawImage(frames[0].img,0,0,SIZE,SIZE);
  try{
    status('PREPROCESS','Normalizing four views','ImageNet normalization · NCHW',12);const {tensor,colors}=prepFrames(frames);
    const session=await ensureSession();
    status('MULTIVIEW INFERENCE','Recovering visual space','Depth · confidence · intrinsics · extrinsics',50);setStep('infer',35,'RUNNING');
    const input=new ort.Tensor('float32',tensor,[1,4,3,SIZE,SIZE]);
    const t0=performance.now();const out=await session.run({images:input});const dt=(performance.now()-t0)/1000;
    setStep('infer',100,`${dt.toFixed(1)}s`);status('GEOMETRY','Fusing camera rays into one world','Confidence-gated reprojection',72);setStep('fusion',20,'UNPROJECT');
    const result=fuseDA3(out,colors); $('metricConf').textContent=`${Math.round(result.confKeep*100)}% kept`; $('metricGauss').textContent=result.points.length.toLocaleString();$('metricPose').textContent=result.poseSpread.toFixed(2);
    setStep('fusion',100,'ALIGNED');status('GAUSSIAN PACK','Encoding splat cloud','SH color · opacity · scale · rotation',82);setStep('gauss',25,'PACKING');
    const ply=writeGaussianPLY(result.points);state.plyBlob=ply;if(state.plyUrl)URL.revokeObjectURL(state.plyUrl);state.plyUrl=URL.createObjectURL(ply);setStep('gauss',100,`${(ply.size/1048576).toFixed(1)} MB`);
    status('VIEWER','Starting SuperSplat WebGPU','Loading Gaussian scene',95);await openWorldBlob(state.plyUrl,'DA3 MULTIVIEW');setStep('viewer',100,'LIVE');status('DONE','Reality compiled',`${result.points.length.toLocaleString()} Gaussian primitives`,100);
  }catch(err){console.error(err);diag(err.stack||err.message);modal('Reconstruction stopped',`<p>${escapeHtml(err.message)}</p><p><b>What changed in V3:</b> this is a real 4-view model. It will not silently fall back to a fake cardboard depth map. If DA3 cannot run, use a current Chrome/Edge with hardware acceleration, or import a PLY/SPLAT capture directly.</p>`);show('landing');}
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
function fuseDA3(out,colors){
  const depth=out.depth?.data||out[Object.keys(out).find(k=>k.includes('depth')&&!k.includes('conf'))]?.data;
  const conf=out.depth_conf?.data||out[Object.keys(out).find(k=>k.includes('conf'))]?.data;
  const ext=out.extrinsics?.data||out[Object.keys(out).find(k=>k.includes('extr'))]?.data;
  const K=out.intrinsics?.data||out[Object.keys(out).find(k=>k.includes('intr'))]?.data;
  if(!depth||!conf||!ext||!K)throw new Error(`Unexpected DA3 outputs: ${Object.keys(out).join(', ')}`);
  const plane=SIZE*SIZE;
  const sampleConf=[];for(let i=0;i<conf.length;i+=23)if(Number.isFinite(conf[i]))sampleConf.push(conf[i]);
  const confTh=percentile(sampleConf,.28);
  const sampleDepth=[];for(let i=0;i<depth.length;i+=23)if(Number.isFinite(depth[i])&&depth[i]>0)sampleDepth.push(depth[i]);
  const dLo=percentile(sampleDepth,.008),dHi=percentile(sampleDepth,.995);
  const points=[];const cams=[];const stride=navigator.gpu?2:3;
  for(let v=0;v<4;v++){
    const ebase=v*12,kbase=v*9;const {rt,c}=invertRt(ext,ebase);cams.push({c,rt});
    const fx=K[kbase],fy=K[kbase+4],cx=K[kbase+2],cy=K[kbase+5];
    for(let y=1;y<SIZE-stride-1;y+=stride)for(let x=1;x<SIZE-stride-1;x+=stride){
      const pi=v*plane+y*SIZE+x,z=depth[pi],cf=conf[pi];
      if(!Number.isFinite(z)||z<=dLo||z>=dHi||cf<confTh)continue;
      const xc=(x-cx)/fx*z,yc=(y-cy)/fy*z,zc=z;
      const wx=rt[0]*xc+rt[1]*yc+rt[2]*zc+c[0];
      const wy=rt[3]*xc+rt[4]*yc+rt[5]*zc+c[1];
      const wz=rt[6]*xc+rt[7]*yc+rt[8]*zc+c[2];

      // Local surface normal from two neighboring depth samples.
      let nw=[0,0,1];
      const zr=depth[pi+stride],zd=depth[pi+stride*SIZE];
      if(Number.isFinite(zr)&&Number.isFinite(zd)&&zr>0&&zd>0){
        const ar=[xc,yc,zc];
        const br=[(x+stride-cx)/fx*zr,(y-cy)/fy*zr,zr];
        const dr=[(x-cx)/fx*zd,(y+stride-cy)/fy*zd,zd];
        const t1=[br[0]-ar[0],br[1]-ar[1],br[2]-ar[2]];
        const t2=[dr[0]-ar[0],dr[1]-ar[1],dr[2]-ar[2]];
        const nc=norm3(cross3(t1,t2));
        nw=norm3([
          rt[0]*nc[0]+rt[1]*nc[1]+rt[2]*nc[2],
          rt[3]*nc[0]+rt[4]*nc[1]+rt[5]*nc[2],
          rt[6]*nc[0]+rt[7]*nc[1]+rt[8]*nc[2]
        ]);
      }
      const ci=(y*SIZE+x)*4;
      points.push({x:wx,y:wy,z:wz,nw,r:colors[v][ci],g:colors[v][ci+1],b:colors[v][ci+2],depth:z,conf:cf,foot:z/Math.sqrt(Math.max(1,fx*fy))*stride});
    }
  }
  if(points.length<2000)throw new Error(`DA3 returned too few confident points (${points.length}). Capture more overlap and move more slowly.`);

  // Canonical room frame: use camera-0 axes, not an arbitrary global flip.
  const c0=cams[0].c,rt0=cams[0].rt;
  const right=norm3([rt0[0],rt0[3],rt0[6]]);
  const down=norm3([rt0[1],rt0[4],rt0[7]]);
  const forward=norm3([rt0[2],rt0[5],rt0[8]]);
  const up=[-down[0],-down[1],-down[2]];
  const back=[-forward[0],-forward[1],-forward[2]];

  for(const p of points){
    const d=[p.x-c0[0],p.y-c0[1],p.z-c0[2]];
    p.x=dot3(d,right); p.y=dot3(d,up); p.z=dot3(d,back);
    p.n=[dot3(p.nw,right),dot3(p.nw,up),dot3(p.nw,back)];
  }

  const sample=points.filter((_,i)=>i%31===0);
  const mx=percentile(sample.map(p=>p.x),.5),my=percentile(sample.map(p=>p.y),.5),mz=percentile(sample.map(p=>p.z),.5);
  const radii=sample.map(p=>Math.hypot(p.x-mx,p.y-my,p.z-mz));
  const rad=Math.max(1e-4,percentile(radii,.9)),scale=2.8/rad;
  for(const p of points){
    p.x=(p.x-mx)*scale;p.y=(p.y-my)*scale;p.z=(p.z-mz)*scale;
    const tangent=Math.max(.0025,Math.min(.026,p.foot*scale*1.15));
    p.sx=tangent;p.sy=tangent;p.sz=Math.max(.0012,tangent*.22);
    p.q=quatFromZ(p.n);
  }
  let poseSpread=0;
  const canonCams=cams.map(cam=>{
    const d=[cam.c[0]-c0[0],cam.c[1]-c0[1],cam.c[2]-c0[2]];
    return [dot3(d,right)*scale,dot3(d,up)*scale,dot3(d,back)*scale];
  });
  for(let i=0;i<canonCams.length;i++)for(let j=i+1;j<canonCams.length;j++)poseSpread=Math.max(poseSpread,Math.hypot(canonCams[i][0]-canonCams[j][0],canonCams[i][1]-canonCams[j][1],canonCams[i][2]-canonCams[j][2]));
  return {points,confKeep:points.length/(4*Math.ceil(SIZE/stride)*Math.ceil(SIZE/stride)),poseSpread};
}

function writeGaussianPLY(points){
  const rest=45;let header=`ply\nformat binary_little_endian 1.0\nelement vertex ${points.length}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\n`;
  for(let i=0;i<rest;i++)header+=`property float f_rest_${i}\n`;
  header+=`property float opacity\nproperty float scale_0\nproperty float scale_1\nproperty float scale_2\nproperty float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\nend_header\n`;
  const hb=new TextEncoder().encode(header);const floatsPer=3+3+3+rest+1+3+4;const buf=new ArrayBuffer(hb.length+points.length*floatsPer*4);const u8=new Uint8Array(buf);u8.set(hb,0);const dv=new DataView(buf);let o=hb.length;
  const put=(v)=>{dv.setFloat32(o,v,true);o+=4;};
  for(const p of points){put(p.x);put(p.y);put(p.z);put(p.n?.[0]||0);put(p.n?.[1]||0);put(p.n?.[2]||0);put((p.r/255-.5)/C0);put((p.g/255-.5)/C0);put((p.b/255-.5)/C0);for(let i=0;i<rest;i++)put(0);put(Math.log(.965/.035));put(Math.log(p.sx||.008));put(Math.log(p.sy||.008));put(Math.log(p.sz||.002));const q=p.q||[1,0,0,0];put(q[0]);put(q[1]);put(q[2]);put(q[3]);}
  return new Blob([buf],{type:'application/octet-stream'});
}

async function openWorldBlob(url,label){
  $('worldId').textContent=String(Math.floor(Math.random()*10000)).padStart(4,'0');$('worldBadgeText').textContent=label;
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
    const r=await fetch(`${cfg.backend}/jobs/${encodeURIComponent(job.job_id)}?access_token=${encodeURIComponent(job.access_token)}`,{cache:'no-store'});
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
    setStep('upload',100,'DONE');
    diag(JSON.stringify({backend:cfg.backend,job_id:job.job_id,mode:job.mode,frames_target:job.frames_target},null,2));

    const done=await pollWorkerJob(cfg,job);
    setStep('export',100,done.splats?`${Number(done.splats).toLocaleString()} GS`:'DONE');
    status('DOWNLOAD','Streaming optimized Gaussian PLY','Loading trained splats into SuperSplat',98);
    const rr=await fetch(`${cfg.backend}/jobs/${encodeURIComponent(job.job_id)}/result?access_token=${encodeURIComponent(job.access_token)}`);
    if(!rr.ok)throw new Error(`GPU result HTTP ${rr.status}: ${await rr.text()}`);
    const blob=await rr.blob();
    if(blob.size<1024)throw new Error('GPU worker returned an unexpectedly small PLY.');

    state.plyBlob=blob;
    if(state.plyUrl)URL.revokeObjectURL(state.plyUrl);
    state.plyUrl=URL.createObjectURL(blob);
    setStep('viewer',25,'LOAD');
    await openWorldBlob(state.plyUrl,ultra?'ULTRA · SPLATFACTO BIG 30K':'PRO · SPLATFACTO 30K');
    setStep('viewer',100,'LIVE');
    status('DONE','Optimized room-scale Gaussian world',`${(blob.size/1048576).toFixed(1)} MB · ${done.splats?Number(done.splats).toLocaleString()+' splats · ':''}30K training`,100);
  }catch(err){
    console.error(err);diag(err.stack||err.message);
    modal('PRO reconstruction stopped',`<p>${escapeHtml(err.message)}</p><p><b>INSTANT</b> remains local. PRO/ULTRA now intentionally require our own private CUDA worker; the public Hugging Face Space is no longer presented as production infrastructure.</p>`);
    show('landing');refreshProStatus();
  }
}

function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

// Explain advanced engines without pretending they run in-browser when they do not.
addEventListener('keydown',(e)=>{
  if(e.key.toLowerCase()==='i' && e.shiftKey) modal('ENGINE MATRIX · V5',`<p><b>INSTANT / LIVE:</b> DA3-BASE-derived 4-view ONNX → pose-aware fusion → Gaussian PLY → SuperSplat WebGPU.</p><p><b>PRO / PRIVATE GPU:</b> video/images → COLMAP camera solve → Nerfstudio Splatfacto/gsplat → 30,000 iterative steps → Gaussian PLY → SuperSplat.</p><p><b>ULTRA / PRIVATE GPU:</b> Splatfacto Big, more source views and denser Gaussian optimization.</p><p><b>LAB:</b> public DA3 Spaces remain audit/reference only; they are not the commercial backend.</p><p><b>METRIC / PARTIAL:</b> direct PLY/SPLAT/SOG import is live; automatic SplaTAM RGB-D ingestion remains the next backend adapter.</p><p><b>SEMANTICS / LIVE:</b> Florence-2 WebGPU after geometry.</p><p><b>EXCLUDED FROM COMMERCIAL CORE:</b> non-commercial model weights / repos are not silently shipped.</p>`);
});

