import fs from 'node:fs';
import zlib from 'node:zlib';

fs.mkdirSync('src',{recursive:true});

function inflate(parts,out){
  const b64=parts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(out,zlib.gunzipSync(Buffer.from(b64,'base64')));
}

inflate(['reality-v3-payload/html.b64'],'reality-compiler.html');
inflate(['reality-v3-payload/style.b64'],'src/style.css');
inflate(['reality-v3-payload/app-0.b64','reality-v3-payload/app-1.b64'],'src/app.js');

// Harden the verified V3 source without re-encoding the large payload.
const appPath='src/app.js';
let app=fs.readFileSync(appPath,'utf8');

const importNeedle="import { createViewer } from '@playcanvas/supersplat-viewer/viewer';";
if(!app.includes(importNeedle)) throw new Error('V3 patch: createViewer import not found');
app=app.replace(
  importNeedle,
  importNeedle+"\nimport { defaultSettings } from '@playcanvas/supersplat-viewer/settings';"
);

const oldViewer=`  state.viewer=await createViewer({
    container,
    contentUrl:url,
    contentFilename: label.includes('IMPORT') ? (state.plyBlob?.name || 'scene.ply') : 'scene.ply',
    renderer: navigator.gpu ? 'webgpu' : 'webgl',
    ui:true,
    backgroundColor:[0.01,0.01,0.01]
  });`;

const newViewer=`  const baseOptions={
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
  }`;

if(!app.includes(oldViewer)) throw new Error('V3 patch: viewer block not found');
app=app.replace(oldViewer,newViewer);
fs.writeFileSync(appPath,app);

// Temporary preview source export for V4 integration work.
fs.mkdirSync('public',{recursive:true});
fs.copyFileSync(appPath,'public/reality-v4-source.js');
fs.copyFileSync('src/style.css','public/reality-v4-style.css');

console.log('Reality Compiler V3 multiview sources materialized + viewer hardening applied');
