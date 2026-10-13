
import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {z} from "zod";
import {listChapters,getPage,planActivity,getMaterials} from "./core.js";
const readOnly={readOnlyHint:true,destructiveHint:false,openWorldHint:false};
function result(data){return {structuredContent:data,content:[{type:"text",text:JSON.stringify(data)}]};}
export function createMateoServer(){
 const s=new McpServer({name:"mateo-reading-guide",version:"0.1.0"},{instructions:"Tools relate only to the illustrated book Mateo y el Algoritmo. Do not claim to have transcribed the artwork or imply institutional approval. All tools are read-only; provide official book links."});
 s.registerTool("list_book_chapters",{title:"List Mateo book chapters",description:"Find the verified titles, starting pages and reader URLs of chapters in the illustrated book Mateo y el Algoritmo. Does not transcribe illustrated pages.",inputSchema:{},annotations:readOnly},async()=>result(listChapters()));
 s.registerTool("get_book_page_link",{title:"Get Mateo page link",description:"Return the official reader link to one specific page of Mateo y el Algoritmo (1 to 124). Does not extract page image text.",inputSchema:{page:z.number().int().min(1).max(124)},annotations:readOnly},async({page})=>result(getPage(page)));
 s.registerTool("plan_algorithm_activity",{title:"Plan a digital literacy activity",description:"Create an original short hands-on educational activity about algorithms, recommendations, digital attention or critical thinking for a selected audience, with a related Mateo reading page. Not a certified curriculum.",inputSchema:{topic:z.enum(["algorithms","recommendations","attention","critical-thinking"]),audience:z.enum(["ages-7-9","ages-10-12","ages-13-plus","adults"]),duration:z.enum(["5-min","15-min"])},annotations:readOnly},async({topic,audience,duration})=>result(planActivity(topic,audience,duration)));
 s.registerTool("get_book_press_materials",{title:"Get Mateo book editorial assets",description:"Retrieve the official free book, 124-page PDF, 12-page sample, cover artwork, social sharing image and press kit links for journalists, educators and readers.",inputSchema:{},annotations:readOnly},async()=>result(getMaterials()));
 return s;
}
