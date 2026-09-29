import fs from 'node:fs';
import zlib from 'node:zlib';

fs.mkdirSync('src',{recursive:true});

function inflate(parts,out){
  const b64=parts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(out,zlib.gunzipSync(Buffer.from(b64,'base64')));
}

// Keep the stable V3 HTML shell, but use editable V4 JS/CSS sources.
inflate(['reality-v3-payload/html.b64'],'reality-compiler.html');

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

// Expose source only on the preview branch while V4 is under active integration.
fs.mkdirSync('public',{recursive:true});
fs.copyFileSync('src/app.js','public/reality-v4-source.js');
fs.copyFileSync('src/style.css','public/reality-v4-style.css');

console.log('Reality Compiler V4 sources materialized');
