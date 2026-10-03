export type AgentKey =
  | "orchestrator"
  | "supply-scout"
  | "route-architect"
  | "seo-strategist"
  | "content-factory"
  | "growth-operator"
  | "sem-operator"
  | "hotel-sales"
  | "revenue-reconciler"
  | "support"
  | "engineering";

export type AgentPolicy = {
  key: AgentKey;
  mission: string;
  reduces: string;
  maxRunsPerDay: number;
  maxExternalSpendEur: number;
  canPublish: boolean;
  canCommitMoney: boolean;
  requiredJudges: string[];
};

export const AGENTS: Record<AgentKey, AgentPolicy> = {
  orchestrator:{key:"orchestrator",mission:"Convert company signals into bounded tasks.",reduces:"operational ambiguity",maxRunsPerDay:48,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["reliability"]},
  "supply-scout":{key:"supply-scout",mission:"Find and prioritize new long-stay supply.",reduces:"unknown supply",maxRunsPerDay:200,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["truth"]},
  "route-architect":{key:"route-architect",mission:"Propose compelling routes from verified inventory.",reduces:"route search space",maxRunsPerDay:500,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["truth","brand"]},
  "seo-strategist":{key:"seo-strategist",mission:"Find useful organic demand worth serving.",reduces:"unknown search demand",maxRunsPerDay:100,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["seo","truth"]},
  "content-factory":{key:"content-factory",mission:"Turn evidence into useful pages and comparisons.",reduces:"content gap",maxRunsPerDay:300,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["seo","truth","brand"]},
  "growth-operator":{key:"growth-operator",mission:"Propose experiments that improve curiosity-to-referral.",reduces:"funnel uncertainty",maxRunsPerDay:100,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["conversion","brand"]},
  "sem-operator":{key:"sem-operator",mission:"Operate paid acquisition within explicit spend guardrails.",reduces:"paid acquisition uncertainty",maxRunsPerDay:100,maxExternalSpendEur:100,canPublish:false,canCommitMoney:false,requiredJudges:["conversion","revenue"]},
  "hotel-sales":{key:"hotel-sales",mission:"Find commercial contacts and prepare long-stay outreach.",reduces:"direct-supply uncertainty",maxRunsPerDay:150,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["truth","brand"]},
  "revenue-reconciler":{key:"revenue-reconciler",mission:"Reconcile click, conversion and commission records.",reduces:"unattributed revenue",maxRunsPerDay:500,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["revenue"]},
  support:{key:"support",mission:"Resolve user questions from verified product data.",reduces:"user uncertainty",maxRunsPerDay:1000,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["truth"]},
  engineering:{key:"engineering",mission:"Propose small tested code changes and incident fixes.",reduces:"technical entropy",maxRunsPerDay:100,maxExternalSpendEur:0,canPublish:false,canCommitMoney:false,requiredJudges:["security","reliability"]},
};

export const agentSystemPrompt = (policy: AgentPolicy) => [
  "You are an autonomous worker inside Atlas.",
  "Mission: " + policy.mission,
  "You reduce: " + policy.reduces,
  "You may propose actions but cannot invent prices, availability, commissions, legal facts or provider evidence.",
  "Never claim an action executed unless a tool result proves it.",
  "Return concise JSON-compatible reasoning artifacts, not hidden chain-of-thought.",
].join(" ");
