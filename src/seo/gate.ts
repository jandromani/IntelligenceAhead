export type SeoEvidence={
  liveIndexingEnabled:boolean;
  sellableHotels:number;
  uniqueCountries:number;
  hasFreshProviderEvidence:boolean;
  uniqueNarrative:boolean;
};

export type SeoGate={index:boolean;reasons:string[]};

export function seoGate(e:SeoEvidence):SeoGate{
  const reasons:string[]=[];
  if(!e.liveIndexingEnabled) reasons.push("live indexing feature flag disabled");
  if(e.sellableHotels<3) reasons.push("fewer than 3 sellable hotels");
  if(e.uniqueCountries<1) reasons.push("no geographic evidence");
  if(!e.hasFreshProviderEvidence) reasons.push("no fresh provider evidence");
  if(!e.uniqueNarrative) reasons.push("page lacks unique user value");
  return{index:reasons.length===0,reasons};
}
