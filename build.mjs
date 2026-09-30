import fs from 'node:fs';
import zlib from 'node:zlib';

fs.mkdirSync('src',{recursive:true});

function inflate(parts,out){
  const b64=parts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(out,zlib.gunzipSync(Buffer.from(b64,'base64')));
}

// Keep the stable V3 HTML shell, but use editable V6 JS/CSS sources.
inflate(['reality-v3-payload/html.b64'],'reality-compiler.html');
let html=fs.readFileSync('reality-compiler.html','utf8');
html=html
  .replace('Reality Compiler V3 — Multiview Gaussian World Engine','Reality Compiler V7 — Local Streaming Sim3')
  .replace('V3 · MULTIVIEW GAUSSIAN WORLD ENGINE','V7 · STREAMING SIM3 FUSION')
  .replace('VIDEO → 4-VIEW GEOMETRY → GAUSSIAN WORLD','VIDEO → OVERLAP WINDOWS → SIM3 → GAUSSIAN WORLD')
  .replace(
    'Move slowly around a room. V3 picks four sharp, separated views, runs Depth Anything 3 multi-view ONNX locally, recovers camera poses and fuses the scene into a splat-ready 3D world.',
    'Instant now uses 12–16 local views in overlapping DA3 windows with dense Sim(3) alignment. PRO/ULTRA remain private-GPU paths.'
  )
  .replace('Record 6–12 seconds while moving sideways or around the subject. Avoid fast turns and motion blur.','For rooms, record 20–40 seconds. Walk slowly with real translation, revisit corners and doorways, and avoid fast turns or motion blur.');
fs.writeFileSync('reality-compiler.html',html);

if(fs.existsSync('reality-v4-src/style.css')){
  fs.copyFileSync('reality-v4-src/style.css','src/style.css');
}else{
  inflate(['reality-v3-payload/style.b64'],'src/style.css');
}

if(fs.existsSync('reality-v4-src/app.js')){
  fs.copyFileSync('reality-v4-src/app.js','src/app.js');
}else{
  inflate(['reality-v3-payload/app-0.b64','reality-v3-payload/app-1.b64'],'src/app.js');
}

fs.mkdirSync('public',{recursive:true});
fs.copyFileSync('src/app.js','public/reality-v6-source.js');
fs.copyFileSync('src/style.css','public/reality-v6-style.css');

console.log('Reality Compiler V6 sources materialized');
