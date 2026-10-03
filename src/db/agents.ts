import { getDatabase } from "@/src/db/client";
import type { JudgeResult } from "@/src/judges/rules";

export async function startPersistedAgentRun(input:{id:string;agentKey:string;objective:string;model?:string;payload?:unknown}){
  const sql=getDatabase();
  if(!sql) return false;
  await sql`insert into agent_runs (id,agent_key,objective,model,input,status,started_at) values (${input.id}::uuid,${input.agentKey},${input.objective},${input.model ?? null},${sql.json((input.payload||{}) as never)},'RUNNING',now()) on conflict (id) do nothing`;
  return true;
}

export async function finishPersistedAgentRun(input:{id:string;status:"COMPLETE"|"FAILED";output?:unknown;usage?:unknown;costCents?:number}){
  const sql=getDatabase();
  if(!sql) return false;
  await sql`update agent_runs set output=${sql.json((input.output||{}) as never)},token_usage=${sql.json((input.usage||{}) as never)},estimated_cost_cents=${input.costCents ?? null},status=${input.status},completed_at=now() where id=${input.id}::uuid`;
  return true;
}

export async function persistJudgeReview(input:{runId:string;result:JudgeResult}){
  const sql=getDatabase();
  if(!sql) return false;
  await sql`insert into judge_reviews (agent_run_id,judge_key,verdict,score,reasons) values (${input.runId}::uuid,${input.result.judge},${input.result.verdict},${input.result.score},${sql.json(input.result.reasons)})`;
  return true;
}

export async function persistExternalJudge(input:{runId:string;text:string}){
  const sql=getDatabase();
  if(!sql) return false;
  const upper=input.text.trim().toUpperCase();
  const verdict=upper.startsWith("PASS")?"PASS":upper.startsWith("REJECT")?"REJECT":"REVISION";
  await sql`insert into judge_reviews (agent_run_id,judge_key,verdict,score,reasons) values (${input.runId}::uuid,'external-llm',${verdict},null,${sql.json([input.text.slice(0,2000)])})`;
  return true;
}
