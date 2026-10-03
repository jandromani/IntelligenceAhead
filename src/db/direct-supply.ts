import { getDatabase } from "@/src/db/client";

export type HotelLeadInput={
  hotelName:string;city:string;country:string;website?:string;contactName?:string;contactRole?:string;contactEmail?:string;source?:string;notes?:Record<string,unknown>;
};

export async function createHotelLead(input:HotelLeadInput){
  const sql=getDatabase(); if(!sql) return null;
  const rows=await sql<{id:string}[]>`insert into hotel_leads (hotel_name,city,country,website,contact_name,contact_role,contact_email,source,notes) values (${input.hotelName},${input.city},${input.country},${input.website ?? null},${input.contactName ?? null},${input.contactRole ?? null},${input.contactEmail ?? null},${input.source ?? null},${sql.json((input.notes||{}) as never)}) returning id::text`;
  return rows[0]?.id ?? null;
}

export async function createDirectRate(input:{hotelLeadId:string;rateCode:string;minNights:number;maxNights?:number;board?:string;monthlyPrice:number;currency:string;validFrom?:string;validTo?:string;cancellation?:string;bookingUrl?:string;contractReference?:string;contractVerified?:boolean}){
  const sql=getDatabase(); if(!sql) return null;
  const state=input.contractVerified&&input.bookingUrl?"READY_FOR_REVIEW":"DRAFT";
  const rows=await sql<{id:string}[]>`insert into direct_rate_offers (hotel_lead_id,rate_code,min_nights,max_nights,board,monthly_price,currency,valid_from,valid_to,cancellation,booking_url,contract_reference,contract_verified,publication_state) values (${input.hotelLeadId}::uuid,${input.rateCode},${input.minNights},${input.maxNights ?? null},${input.board ?? null},${input.monthlyPrice},${input.currency},${input.validFrom ?? null},${input.validTo ?? null},${input.cancellation ?? null},${input.bookingUrl ?? null},${input.contractReference ?? null},${Boolean(input.contractVerified)},${state}) on conflict (hotel_lead_id,rate_code) do update set min_nights=excluded.min_nights,max_nights=excluded.max_nights,board=excluded.board,monthly_price=excluded.monthly_price,currency=excluded.currency,valid_from=excluded.valid_from,valid_to=excluded.valid_to,cancellation=excluded.cancellation,booking_url=excluded.booking_url,contract_reference=excluded.contract_reference,contract_verified=excluded.contract_verified,publication_state=excluded.publication_state,updated_at=now() returning id::text`;
  return rows[0]?.id ?? null;
}

export async function listHotelDesk(){
  const sql=getDatabase();
  if(!sql) return{configured:false,leads:[],rates:[]};
  const leads=await sql`select id::text,hotel_name,city,country,contact_name,contact_role,contact_email,status,source,updated_at::text from hotel_leads order by updated_at desc limit 50`;
  const rates=await sql`select r.id::text,r.hotel_lead_id::text,l.hotel_name,r.rate_code,r.min_nights,r.max_nights,r.board,r.monthly_price::float,r.currency,r.contract_verified,r.publication_state,r.updated_at::text from direct_rate_offers r join hotel_leads l on l.id=r.hotel_lead_id order by r.updated_at desc limit 50`;
  return{configured:true,leads,rates};
}
