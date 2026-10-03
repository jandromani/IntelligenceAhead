import { z } from "zod";
import { AGENTS, agentSystemPrompt } from "@/src/agents/registry";
import { deterministicBrandJudge, deterministicTruthJudge } from "@/src/judges/rules";
import { finishPersistedAgentRun, persistExternalJudge, persistJudgeReview, startPersistedAgentRun } from "@/src/db/agents";

export const runtime = "nodejs";

const Input = z.object({
  agent: z.enum(["orchestrator","supply-scout","route-architect","seo-strategist","content-factory","growth-operator","sem-operator","hotel-sales","revenue-reconciler","support","engineering"]),
  objective: z.string().min(3).max(3000),
  context: z.record(z.string(), z.unknown()).optional(),
});

async function openRouter(messages: {role:"system"|"user";content:string}[]) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method:"POST",
    headers:{
      Authorization:"Bearer " + key,
      "Content-Type":"application/json",
      "HTTP-Referer":process.env.NEXT_PUBLIC_SITE_URL || "https://vercel.app",
      "X-Title":"Atlas Lab"
    },
    body:JSON.stringify({ model, messages, temperature:0.25, max_tokens:900 })
  });
  if (!res.ok) throw new Error("OpenRouter status " + res.status);
  const data = await res.json();
  return { text:String(data?.choices?.[0]?.message?.content || ""), usage:data?.usage, model };
}

function authorized(req:Request){
  const secret=process.env.OPS_ACCESS_KEY;
  return Boolean(secret&&req.headers.get("authorization")==="Bearer "+secret);
}

export async function POST(req: Request) {
  if(!authorized(req)) return new Response("Unauthorized",{status:401});
  const parsed = Input.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return Response.json({error:"Invalid request"},{status:400});
  const policy = AGENTS[parsed.data.agent];
  const runId = crypto.randomUUID();
  await Promise.allSettled([startPersistedAgentRun({id:runId,agentKey:policy.key,objective:parsed.data.objective,payload:parsed.data.context || {}})]);

  try {
    const actor = await openRouter([
      {role:"system",content:agentSystemPrompt(policy)},
      {role:"user",content:JSON.stringify({objective:parsed.data.objective,context:parsed.data.context || {}})}
    ]);

    const deterministic = [
      deterministicTruthJudge(actor.text),
      deterministicBrandJudge(actor.text),
    ];

    const judge = await openRouter([
      {role:"system",content:[
        "You are an independent external judge. You did not create the artifact.",
        "Evaluate only the artifact and supplied policy. Do not repair it.",
        "Return one line beginning PASS, REVISION or REJECT, then concise reasons.",
        "Reject invented commercial facts, unverified prices, fabricated execution claims, or actions exceeding authority."
      ].join(" ")},
      {role:"user",content:JSON.stringify({artifact:actor.text,policy,deterministicChecks:deterministic})}
    ]);

    await Promise.allSettled([
      ...deterministic.map(result=>persistJudgeReview({runId,result})),
      persistExternalJudge({runId,text:judge.text}),
      finishPersistedAgentRun({
        id:runId,
        status:"COMPLETE",
        output:{artifact:actor.text,externalJudge:judge.text,deterministic},
        usage:{actor:actor.usage,judge:judge.usage},
        costCents:0,
      }),
    ]);

    console.log(JSON.stringify({
      level:"info",event:"agent_run",runId,agent:policy.key,model:actor.model,
      actorUsage:actor.usage,judgeUsage:judge.usage,deterministic
    }));

    return Response.json({
      runId,
      agent:policy.key,
      authority:{maxRunsPerDay:policy.maxRunsPerDay,maxExternalSpendEur:policy.maxExternalSpendEur,canPublish:policy.canPublish,canCommitMoney:policy.canCommitMoney},
      artifact:actor.text,
      deterministicJudges:deterministic,
      externalJudge:judge.text,
      model:actor.model,
    });
  } catch (error) {
    await Promise.allSettled([finishPersistedAgentRun({id:runId,status:"FAILED",output:{error:String(error)}})]);
    console.error(JSON.stringify({level:"error",event:"agent_run_failed",runId,agent:policy.key,error:String(error)}));
    return Response.json({runId,error:"Agent runtime unavailable",detail:String(error)},{status:503});
  }
}
