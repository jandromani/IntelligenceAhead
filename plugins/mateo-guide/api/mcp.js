
import {createMateoServer} from "../mcp.js";
import {StreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/streamableHttp.js";
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Access-Control-Allow-Headers","content-type,accept,mcp-session-id,mcp-protocol-version");
 res.setHeader("Access-Control-Allow-Methods","POST,GET,DELETE,OPTIONS");
 res.setHeader("Cache-Control","no-store");
 if(req.method==="OPTIONS"){res.statusCode=204;res.end();return;}
 if(!["POST","GET","DELETE"].includes(req.method)){res.statusCode=405;res.end();return;}
 const server=createMateoServer();
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}
 catch(e){console.error("Mateo MCP:",e.message);if(!res.headersSent){res.statusCode=500;res.end("Internal server error");}}
 finally{await transport.close().catch(()=>{});await server.close().catch(()=>{});}
}
