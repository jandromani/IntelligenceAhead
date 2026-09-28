import fs from 'node:fs';
import zlib from 'node:zlib';
fs.mkdirSync('src',{recursive:true});
function inflate(parts,out){
  const b64=parts.map(p=>fs.readFileSync(p,'utf8').trim()).join('');
  fs.writeFileSync(out,zlib.gunzipSync(Buffer.from(b64,'base64')));
}
inflate(['reality-v2-payload/html.b64'],'reality-compiler.html');
inflate(['reality-v2-payload/style.b64'],'src/style.css');
inflate(['reality-v2-payload/app-0.b64','reality-v2-payload/app-1.b64'],'src/app.js');
console.log('Reality Compiler v2 sources materialized');
