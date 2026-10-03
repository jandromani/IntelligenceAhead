export type HeroVariant = "freedom" | "provocation";

function hash(input:string){
  let h=2166136261;
  for(let i=0;i<input.length;i++){
    h^=input.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

export function chooseVariant<T extends string>(experiment:string,subject:string|undefined,variants:readonly T[]):T{
  if(!variants.length) throw new Error("variants cannot be empty");
  const key=subject || "anonymous";
  return variants[hash(experiment+":"+key)%variants.length];
}

export const HERO_VARIANTS = {
  freedom: {
    eyebrow:"A NEW CATEGORY: RETIREMENT-AS-A-SERVICE",
    line1:"You retired from work.",
    line2:"Not from the world.",
    lead:"Turn pension + home income into months of life around the world. Explore first. Dream freely. Book only when the numbers make sense.",
  },
  provocation: {
    eyebrow:"20 YEARS OF RETIREMENT. ONE ADDRESS?",
    line1:"Are you really going to spend",
    line2:"the next 20 years sitting there?",
    lead:"Your pension and your home can become a life budget. See where in the world that money could let you live.",
  },
} as const;
