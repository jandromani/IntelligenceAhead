import type { LiveProviderStatus,LiveSearchHit } from "./common";
export type BookingAccommodationDetails={providerHotelId:string;name?:string;latitude?:number;longitude?:number;webUrl?:string;raw:unknown};
export class BookingDemandClient{
  readonly provider="booking";
  status():LiveProviderStatus{return{provider:this.provider,configured:false,commercialReady:false,environment:"sandbox",missingEnv:["BOOKING_API_KEY","BOOKING_AFFILIATE_ID"],blockers:["preview host uses safe provider stubs"],notes:["Real Booking Demand API v3.2 adapter is present in Petshop master."]};}
  async search(_input:unknown):Promise<LiveSearchHit[]>{return[];}
  async details(_ids:Array<number|string>):Promise<BookingAccommodationDetails[]>{return[];}
}
