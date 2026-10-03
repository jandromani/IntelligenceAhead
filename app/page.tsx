import { cookies } from "next/headers";
import Planner from "@/components/Planner";
import { hotels } from "@/src/data/hotels";
import { decodePlanToken } from "@/src/core/share";
import { chooseVariant, type HeroVariant } from "@/src/growth/experiments";

export default async function Home({searchParams}:{searchParams:Promise<{plan?:string}>}) {
  const {plan}=await searchParams;
  const initial=plan ? decodePlanToken(plan) || undefined : undefined;
  const jar=await cookies();
  const visitor=jar.get("rv_vid")?.value;
  const heroVariant=chooseVariant<HeroVariant>("hero-v1",visitor,["freedom","provocation"]);
  return <Planner hotels={hotels} initial={initial} heroVariant={heroVariant} />;
}
