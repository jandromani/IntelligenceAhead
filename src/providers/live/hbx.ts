import { createHash } from "node:crypto";
import { fetchJson, finiteNumber, type LiveProviderStatus, type LiveSearchBase, type LiveSearchHit } from "./common";

export type HbxPricingMode="commissionable"|"net";

export type HbxRate={
  net?:number|string;
  sellingRate?:number|string;
  hotelSellingRate?:number|string;
  hotelMandatory?:boolean;
  rateKey?:string;
  rateType?:string;
  boardCode?:string;
  boardName?:string;
  commission?:number|string;
};

type HbxSearchInput = LiveSearchBase & {
  hotelCodes:number[];
  rooms?:number;
  children?:number;
};

type HbxResponse={
  auditData?:{token?:string};
  hotels?:{
    checkIn?:string;
    checkOut?:string;
    total?:number;
    currency?:string;
    hotels?:Array<{
      code?:number;
      name?:string;
      rooms?:Array<{rates?:HbxRate[]}>;
    }>;
  };
};

type HbxCheckRateResponse={
  auditData?:{token?:string};
  hotel?:{
    code?:number;
    name?:string;
    rooms?:Array<{rates?:HbxRate[]}>;
  };
};

export function hbxSignature(apiKey:string,secret:string,epochSeconds:number){
  return createHash("sha256").update(apiKey+secret+String(epochSeconds)).digest("hex");
}

export function resolveHbxPrice(
  rate:HbxRate,
  pricingMode:HbxPricingMode,
  markupPercent?:number,
){
  const net=finiteNumber(rate.net);
  const selling=finiteNumber(rate.sellingRate);
  if(selling!==undefined){
    return{totalPrice:net ?? selling,displayPrice:selling,source:"sellingRate" as const};
  }
  if(pricingMode==="net" && net!==undefined && markupPercent!==undefined && markupPercent>=0){
    return{
      totalPrice:net,
      displayPrice:Math.round(net*(1+markupPercent/100)*100)/100,
      source:"net+markup" as const,
    };
  }
  return{totalPrice:net,displayPrice:undefined,source:"net-only" as const};
}

function pricingMode():HbxPricingMode{
  return process.env.HBX_PRICING_MODE==="net" ? "net" : "commissionable";
}

function configuredMarkup(){
  const raw=process.env.HBX_MARKUP_PERCENT;
  if(raw===undefined || raw==="") return undefined;
  const value=Number(raw);
  return Number.isFinite(value) && value>=0 ? value : undefined;
}

function bookingReady(){
  return process.env.HBX_BOOKING_ENABLED==="true" && process.env.HBX_MTLS_READY==="true";
}

function parseHotelRates(
  hotel:{code?:number;rooms?:Array<{rates?:HbxRate[]}>},
  stage:"availability"|"prebook",
  currency:string|undefined,
  requestId:string|undefined,
  verifiedAt:string,
){
  if(hotel.code===undefined) return [] as LiveSearchHit[];
  const ready=bookingReady();
  return (hotel.rooms || []).flatMap(room=>(room.rates || []).map(rate=>{
    const price=resolveHbxPrice(rate,pricingMode(),configuredMarkup());
    const needsRecheck=String(rate.rateType || "").toUpperCase()==="RECHECK";
    const fulfillment=ready && !needsRecheck && price.displayPrice!==undefined ? "api" as const : "none" as const;
    return{
      provider:"hbx",
      providerHotelId:String(hotel.code),
      providerOfferId:rate.rateKey,
      providerRequestId:requestId,
      totalPrice:price.totalPrice,
      displayPrice:price.displayPrice,
      currency,
      board:rate.boardCode || rate.boardName,
      verifiedAt,
      stage,
      commercialFulfillment:fulfillment,
      raw:{rate,pricing:{mode:pricingMode(),markupPercent:configuredMarkup(),source:price.source}},
    };
  }));
}

export function parseHbxAvailability(data:HbxResponse,verifiedAt=new Date().toISOString()){
  return (data.hotels?.hotels || []).flatMap(hotel=>
    parseHotelRates(hotel,"availability",data.hotels?.currency,data.auditData?.token,verifiedAt)
  );
}

export function parseHbxCheckRate(data:HbxCheckRateResponse,currency:string,verifiedAt=new Date().toISOString()){
  if(!data.hotel) return [] as LiveSearchHit[];
  return parseHotelRates(data.hotel,"prebook",currency,data.auditData?.token,verifiedAt);
}

export class HbxClient{
  readonly provider="hbx";

  status():LiveProviderStatus{
    const missingEnv=["HBX_API_KEY","HBX_SECRET"].filter(key=>!process.env[key]);
    const base=process.env.HBX_API_BASE || "https://api.test.hotelbeds.com";
    const blockers:string[]=[];
    if(process.env.HBX_MTLS_READY!=="true") blockers.push("mTLS not marked ready");
    if(process.env.HBX_BOOKING_ENABLED!=="true") blockers.push("booking capability disabled");
    if(pricingMode()==="net" && configuredMarkup()===undefined) blockers.push("net pricing requires explicit HBX_MARKUP_PERCENT");
    return{
      provider:this.provider,
      configured:missingEnv.length===0,
      environment:base.includes("test")?"sandbox":"production",
      missingEnv,
      commercialReady:missingEnv.length===0 && blockers.length===0,
      blockers,
      notes:[
        "Availability /hotels returns BOOKABLE or RECHECK rateKeys",
        "RECHECK rates must pass /checkrates before booking",
        "SellingRate is used for display when present; net-only rates require an explicit markup rule",
        "HBX booking operations require mutual TLS",
      ],
    };
  }

  private authHeaders(){
    const apiKey=String(process.env.HBX_API_KEY);
    const secret=String(process.env.HBX_SECRET);
    return{
      "Api-key":apiKey,
      "X-Signature":hbxSignature(apiKey,secret,Math.floor(Date.now()/1000)),
      Accept:"application/json",
      "Content-Type":"application/json",
    };
  }

  private base(){ return process.env.HBX_API_BASE || "https://api.test.hotelbeds.com"; }

  private assertConfigured(){
    const status=this.status();
    if(!status.configured) throw new Error("HBX provider disabled: "+status.missingEnv.join(", "));
  }

  async searchHotels(input:HbxSearchInput):Promise<LiveSearchHit[]>{
    this.assertConfigured();
    if(input.hotelCodes.length===0) throw new Error("HBX hotelCodes cannot be empty");
    const data=await fetchJson<HbxResponse>(this.provider,this.base()+"/hotel-api/1.0/hotels",{
      method:"POST",
      headers:this.authHeaders(),
      body:JSON.stringify({
        stay:{checkIn:input.checkIn,checkOut:input.checkOut},
        occupancies:[{rooms:input.rooms || 1,adults:input.adults,children:input.children || 0}],
        hotels:{hotel:input.hotelCodes},
      }),
    },{retries:2});
    return parseHbxAvailability(data);
  }

  async checkRate(rateKey:string,currency="EUR"):Promise<LiveSearchHit[]>{
    this.assertConfigured();
    if(!rateKey) throw new Error("HBX checkRate requires rateKey");
    const data=await fetchJson<HbxCheckRateResponse>(this.provider,this.base()+"/hotel-api/1.0/checkrates",{
      method:"POST",
      headers:this.authHeaders(),
      body:JSON.stringify({rooms:[{rateKey}]}),
    },{retries:2});
    return parseHbxCheckRate(data,currency);
  }
}
