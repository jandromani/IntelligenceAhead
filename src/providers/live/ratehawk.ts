import type { LiveProviderStatus,LiveSearchHit } from "./common";
export class RateHawkClient{
  readonly provider="ratehawk";
  status():LiveProviderStatus{return{provider:this.provider,configured:false,commercialReady:false,environment:"sandbox",missingEnv:["RATEHAWK_KEY_ID","RATEHAWK_API_KEY"],blockers:["preview host uses safe provider stubs"],notes:["Real staged SERP → hotelpage → prebook adapter is present in Petshop master."]};}
  async searchHotels(_input:unknown):Promise<LiveSearchHit[]>{return[];}
  async searchGeo(_input:unknown):Promise<LiveSearchHit[]>{return[];}
  async hotelPage(_input:unknown):Promise<LiveSearchHit[]>{return[];}
  async prebookHotelRate(_hash:string,_pct=0):Promise<LiveSearchHit[]>{return[];}
}
