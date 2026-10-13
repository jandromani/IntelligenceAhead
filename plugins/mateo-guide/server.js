
import {createServer} from "node:http";
import {createMateoServer} from "./mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
const port=Number(process.env.PORT||8787);
createServer(async(req,res)=>{
 if(req.url==="/health"){res.writeHead(200,{"content-type":"application/json"}).end(JSON.stringify({ok:true}));return;}
 if(req.url!=="/mcp"){res.writeHead(404).end();return;}
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,accept,mcp-session-id,mcp-protocol-version","Access-Control-Allow-Methods":"POST,GET,DELETE,OPTIONS"}).end();return;}
 const s=createMateoServer(),t=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await s.connect(t);await t.handleRequest(req,res);}catch(e){console.error(e);if(!res.headersSent)res.writeHead(500).end();}
 finally{await t.close().catch(()=>{});await s.close().catch(()=>{});}
}).listen(port,()=>console.log("Mateo Guide MCP listening on http://localhost:"+port+"/mcp"));
