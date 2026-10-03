import { z } from "zod";
import { hotels } from "@/src/data/hotels";
import { listSellableOffers } from "@/src/db/catalog";
import { databaseConfigured } from "@/src/db/client";

export const runtime = "nodejs";

const Input = z.object({
  prompt: z.string().min(1).max(1500),
  income: z.number().nonnegative(),
  livingBudget: z.number().nonnegative(),
  party: z.enum(["solo","couple"]),
  duration: z.union([z.literal(30),z.literal(60),z.literal(90)]),
  mode: z.enum(["world","winter","value","slow"]),
});

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    return Response.json({
      answer: "The deterministic planner is live, but the concierge model is not configured on this deployment yet."
    }, { status: 200 });
  }

  let liveOffers:Awaited<ReturnType<typeof listSellableOffers>>=[];
  if(databaseConfigured()){
    try{liveOffers=await listSellableOffers({limit:18,maxMonthly:parsed.data.livingBudget});}catch{}
  }
  const context = liveOffers.length
    ? liveOffers.map(o=>({source:"live_verified",city:o.city,country:o.country,monthly:o.monthlyEquivalent,board:o.board,provider:o.provider,verifiedAt:o.verifiedAt,confidence:o.confidence}))
    : hotels.slice().sort((a,b)=>b.score-a.score).slice(0,18).map(h=>({source:"demo",city:h.city,country:h.country,monthly:h.monthly,score:h.score,board:h.board,tags:h.tags,provider:h.provider}));

  const system = [
    "You are the Atlas retirement-living concierge.",
    "You may recommend only hotels/destinations present in the supplied catalogue.",
    "Never invent availability, a live price, a visa rule, medical advice, or a referral commission.",
    "Entries with source=live_verified passed the deterministic commercial Truth Gate. Entries with source=demo are scenarios only and must be described as estimates, never as bookable offers.",
    "Be concise, practical and aspirational. The brand is about freedom, not ageing.",
    "If the user asks for a live commercial fact, say it must be verified by the deterministic provider layer."
  ].join(" ");

  try {
    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://vercel.app",
        "X-Title": "Atlas Lab"
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        messages: [
          { role:"system", content: system },
          { role:"user", content: JSON.stringify({profile: parsed.data, catalogue: context, request: parsed.data.prompt}) }
        ],
        temperature: 0.4,
        max_tokens: 550
      }),
    });

    if (!upstream.ok) {
      console.error(JSON.stringify({level:"error",event:"agent_upstream_failed",status:upstream.status}));
      return Response.json({ answer: "The concierge model is temporarily unavailable. The deterministic planner is unaffected." });
    }
    const data = await upstream.json();
    const answer = data?.choices?.[0]?.message?.content;
    return Response.json({ answer: typeof answer === "string" ? answer : "No agent response.", catalogueMode:liveOffers.length?"live_verified":"demo" });
  } catch (error) {
    console.error(JSON.stringify({level:"error",event:"agent_error",error:String(error)}));
    return Response.json({ answer: "The concierge model is temporarily unavailable. The deterministic planner is unaffected." });
  }
}
