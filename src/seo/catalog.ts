import type { Hotel } from "@/src/data/hotels";

export type DiscoveryPage={
  slug:string;
  title:string;
  headline:string;
  description:string;
  intent:string;
  filter:(hotel:Hotel)=>boolean;
};

export const DISCOVERY_PAGES:DiscoveryPage[]=[
  {slug:"under-1500-month",title:"Long stays under €1,500/month",headline:"How far can €1,500 a month take you?",description:"Explore prototype long-stay scenarios below €1,500/month.",intent:"budget-under-1500",filter:h=>h.monthly<=1500},
  {slug:"winter-sun",title:"Winter sun long stays",headline:"Follow the sun, not the calendar.",description:"Warm-climate long-stay ideas for the European winter.",intent:"winter-sun",filter:h=>/2[0-9]°C|19°C|18°C/.test(h.climate)},
  {slug:"all-inclusive",title:"All-inclusive long stays",headline:"What if the monthly budget included dinner too?",description:"Long-stay concepts where an all-inclusive board basis is part of the prototype.",intent:"all-inclusive",filter:h=>h.board==="All inclusive"},
  {slug:"sea-and-walkable",title:"Walkable seaside long stays",headline:"Sea outside. Daily life on foot.",description:"Prototype destinations tagged for both sea access and walkability.",intent:"sea-walkable",filter:h=>h.tags.includes("sea")&&h.tags.includes("walkable")},
  {slug:"healthcare-first",title:"Long stays with healthcare nearby",headline:"Freedom without pretending healthcare does not matter.",description:"Prototype destinations tagged for nearby clinical access.",intent:"healthcare-first",filter:h=>h.tags.includes("clinic")},
  {slug:"best-value-asia",title:"Best-value Asia long stays",headline:"More world per euro.",description:"Prototype Asian long stays ranked around monthly price and Silver Score.",intent:"asia-value",filter:h=>h.region==="Asia"},
];

export function discoveryBySlug(slug:string){
  return DISCOVERY_PAGES.find(x=>x.slug===slug);
}
