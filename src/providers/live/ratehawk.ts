import { Buffer } from "node:buffer";
import { daysBetween, fetchJson, finiteNumber, type LiveProviderStatus, type LiveSearchBase, type LiveSearchHit } from "./common";

export type RateHawkHotelIdsInput = LiveSearchBase & {
  hotelIds:number[];
  residency?:string;
  children?:number[];
};

export type RateHawkGeoInput = LiveSearchBase & {
  latitude:number;
  longitude:number;
  radiusMeters?:number;
  residency?:string;
  children?:number[];
  hotelsLimit?:number;
};

export type RateHawkHotelPageInput = LiveSearchBase & {
  hid:number;
  residency?:string;
  children?:number[];
};

type RateHawkPaymentType={
  show_amount?:string|number;
  show_currency_code?:string;
  amount?:string|number;
  currency_code?:string;
};

type RateHawkRate={
  search_hash?:string;
  book_hash?:string;
  match_hash?:string;
  meal?:string;
  payment_options?:{payment_types?:RateHawkPaymentType[]};
};

export type RateHawkResponse={
  data?:{
    hotels?:Array<{id?:string;hid?:number;rates?:RateHawkRate[]}>;
  };
  debug?:{request_id?:string};
  status?:string;
  error?:unknown;
};

function pickPrice(rate:RateHawkRate){
  const payment=rate.payment_options?.payment_types?.[0];
  return {
    amount:finiteNumber(payment?.show_amount ?? payment?.amount),
    currency:payment?.show_currency_code || payment?.currency_code,
  };
}

export function parseRateHawkResponse(
  data:RateHawkResponse,
  stage:"search"|"availability"|"prebook",
  apiBookingCapable=false,
  verifiedAt=new Date().toISOString(),
):LiveSearchHit[]{
  return (data.data?.hotels || []).flatMap(hotel=>{
    const hotelId=hotel.hid ?? hotel.id;
    if(hotelId===undefined) return [];
    return (hotel.rates || []).map(rate=>{
      const price=pickPrice(rate);
      const offerId=stage==="search" ? rate.search_hash : rate.book_hash;
      return {
        provider:"ratehawk",
        providerHotelId:String(hotelId),
        providerOfferId:offerId,
        providerRequestId:data.debug?.request_id,
        totalPrice:price.amount,
        displayPrice:price.amount,
        currency:price.currency,
        board:rate.meal,
        verifiedAt,
        stage,
        commercialFulfillment:stage==="prebook" && apiBookingCapable ? "api" as const : "none" as const,
        raw:{hotelId,rate},
      };
    });
  });
}

export class RateHawkClient {
  readonly provider="ratehawk";

  status():LiveProviderStatus{
    const missingEnv=["RATEHAWK_KEY_ID","RATEHAWK_API_KEY"].filter(key=>!process.env[key]);
    const base=process.env.RATEHAWK_API_BASE || "https://api-sandbox.ratehawk.com";
    return{
      provider:this.provider,
      configured:missingEnv.length===0,
      environment:base.includes("sandbox")?"sandbox":"production",
      missingEnv,
      notes:[
        "SERP is discovery only and is never a customer-selectable commercial rate",
        "Recommended flow: SERP → hotelpage → hotel/prebook",
        "Search and hotelpage checkout are limited to 30 days after check-in",
        "API fulfillment is disabled unless RATEHAWK_BOOKING_ENABLED=true",
      ],
    };
  }

  private auth(){
    return "Basic "+Buffer.from(String(process.env.RATEHAWK_KEY_ID)+":"+String(process.env.RATEHAWK_API_KEY)).toString("base64");
  }

  private base(){ return process.env.RATEHAWK_API_BASE || "https://api-sandbox.ratehawk.com"; }

  private assertConfigured(){
    const status=this.status();
    if(!status.configured) throw new Error("RateHawk provider disabled: "+status.missingEnv.join(", "));
  }

  private assertShortStay(input:LiveSearchBase){
    if(daysBetween(input.checkIn,input.checkOut)>30) throw new Error("RateHawk search segment exceeds documented 30-day limit");
  }

  async searchHotels(input:RateHawkHotelIdsInput):Promise<LiveSearchHit[]>{
    this.assertConfigured();
    this.assertShortStay(input);
    if(input.hotelIds.length===0 || input.hotelIds.length>300) throw new Error("RateHawk hotelIds must contain 1..300 IDs");
    const data=await fetchJson<RateHawkResponse>(this.provider,this.base()+"/api/b2b/v3/search/serp/hotels/",{
      method:"POST",
      headers:{Authorization:this.auth(),"Content-Type":"application/json"},
      body:JSON.stringify({
        checkin:input.checkIn,
        checkout:input.checkOut,
        residency:input.residency || "es",
        language:"en",
        guests:[{adults:input.adults,children:input.children || []}],
        hids:input.hotelIds,
        currency:input.currency || "EUR",
      }),
    },{retries:2});
    return parseRateHawkResponse(data,"search",false);
  }
  async searchGeo(input:RateHawkGeoInput):Promise<LiveSearchHit[]>{
    this.assertConfigured();
    this.assertShortStay(input);
    const data=await fetchJson<RateHawkResponse>(this.provider,this.base()+"/api/b2b/v3/search/serp/geo/",{
      method:"POST",
      headers:{Authorization:this.auth(),"Content-Type":"application/json"},
      body:JSON.stringify({
        checkin:input.checkIn,
        checkout:input.checkOut,
        residency:input.residency || "es",
        language:"en",
        guests:[{adults:input.adults,children:input.children || []}],
        latitude:input.latitude,
        longitude:input.longitude,
        radius:input.radiusMeters ?? 5000,
        hotels_limit:input.hotelsLimit ?? 20,
        currency:input.currency || "EUR",
      }),
    },{retries:2});
    return parseRateHawkResponse(data,"search",false);
  }

  async hotelPage(input:RateHawkHotelPageInput):Promise<LiveSearchHit[]>{
    this.assertConfigured();
    this.assertShortStay(input);
    const data=await fetchJson<RateHawkResponse>(this.provider,this.base()+"/api/b2b/v3/search/hp/",{
      method:"POST",
      headers:{Authorization:this.auth(),"Content-Type":"application/json"},
      body:JSON.stringify({
        checkin:input.checkIn,
        checkout:input.checkOut,
        residency:input.residency || "es",
        language:"en",
        guests:[{adults:input.adults,children:input.children || []}],
        hid:input.hid,
        currency:input.currency || "EUR",
      }),
    },{retries:2});
    return parseRateHawkResponse(data,"availability",false);
  }

  async prebookHotelRate(hash:string,priceIncreasePercent=0):Promise<LiveSearchHit[]>{
    this.assertConfigured();
    if(!hash.startsWith("h-")) throw new Error("RateHawk hotelpage prebook requires an h- book hash");
    const data=await fetchJson<RateHawkResponse>(this.provider,this.base()+"/api/b2b/v3/hotel/prebook/",{
      method:"POST",
      headers:{Authorization:this.auth(),"Content-Type":"application/json"},
      body:JSON.stringify({hash,price_increase_percent:priceIncreasePercent}),
    },{timeoutMs:60_000,retries:1});
    const bookingEnabled=process.env.RATEHAWK_BOOKING_ENABLED==="true";
    return parseRateHawkResponse(data,"prebook",bookingEnabled);
  }
}
