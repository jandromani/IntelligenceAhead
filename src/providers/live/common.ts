export type LiveProviderStatus={
  provider:string;
  configured:boolean;
  commercialReady?:boolean;
  environment:"sandbox"|"production";
  missingEnv:string[];
  blockers?:string[];
  notes:string[];
};
export type LiveSearchHit={
  provider:string;providerHotelId:string;providerOfferId?:string;providerRequestId?:string;
  totalPrice?:number;displayPrice?:number;currency?:string;board?:string;deepLink?:string;
  verifiedAt?:string;stage?:"search"|"availability"|"prebook";commercialFulfillment?:"redirect"|"api"|"none";raw:unknown;
};
export function finiteNumber(v:unknown){if(typeof v==="number"&&Number.isFinite(v))return v;if(typeof v==="string"&&v.trim()&&Number.isFinite(Number(v)))return Number(v);return undefined;}
export function daysBetween(a:string,b:string){return Math.round((new Date(b).getTime()-new Date(a).getTime())/86400000);}
export function localizedText(v:unknown){return typeof v==="string"?v:undefined;}
