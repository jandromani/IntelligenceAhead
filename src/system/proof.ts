import { evaluateCommercialOffer } from "@/src/core/truth";
import { safeCommercialUrl } from "@/src/core/live-offers";
import { createReferralClick } from "@/src/services/referral";
import { deterministicBrandJudge, deterministicTruthJudge } from "@/src/judges/rules";
import { stableEvidenceHash } from "@/src/services/evidence";

export type ProofCheck={name:string;pass:boolean;detail:string};

export function runSoftwareProof(now=new Date()){
  const raw={provider:"booking",id:"proof-hotel",product:"proof-rate",price:1200,currency:"EUR"};
  const rawHash=stableEvidenceHash(raw);
  const verifiedAt=new Date(now.getTime()-60_000).toISOString();
  const deepLink="https://www.booking.com/searchresults.html?ss=proof";
  const truth=evaluateCommercialOffer({
    hotelId:"proof-hotel",sourceMode:"live",provider:"booking",providerOfferId:"proof-rate",
    totalPrice:1200,currency:"EUR",checkIn:"2027-01-01",checkOut:"2027-02-01",
    verifiedAt,deepLink,rawHash,
  },now);
  const target=safeCommercialUrl("booking",deepLink);
  const click=createReferralClick({visitorId:"proof-visitor",sessionId:"proof-session",hotelSlug:"proof-hotel",provider:"booking",source:"system-proof"});
  const truthJudge=deterministicTruthJudge("Verified provider offer. Evidence attached. Price €1200.");
  const brandJudge=deterministicBrandJudge("Freedom to live a season by the sea.");
  const checks:ProofCheck[]=[
    {name:"truth-gate",pass:truth.state==="SELLABLE",detail:truth.state},
    {name:"safe-commercial-url",pass:Boolean(target),detail:target?.hostname||"blocked"},
    {name:"referral-id",pass:click.clickId.length>20,detail:click.clickId},
    {name:"truth-judge",pass:truthJudge.verdict==="PASS",detail:truthJudge.verdict},
    {name:"brand-judge",pass:brandJudge.verdict==="PASS",detail:brandJudge.verdict},
  ];
  return{pass:checks.every(c=>c.pass),checks};
}
