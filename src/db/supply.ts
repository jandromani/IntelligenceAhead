import { getDatabase } from "@/src/db/client";
import type { Sellability } from "@/src/core/truth";

export type CanonicalHotelInput={
  slug:string;
  name:string;
  city:string;
  country:string;
  lat?:number;
  lng?:number;
  silverScore?:number;
};

export async function upsertCanonicalHotel(input:CanonicalHotelInput){
  const sql=getDatabase();
  if(!sql) return null;
  const rows=await sql<{id:string}[]>`
    insert into canonical_hotels (slug,name,city,country,lat,lng,silver_score,updated_at)
    values (
      ${input.slug},
      ${input.name},
      ${input.city},
      ${input.country},
      ${input.lat ?? null},
      ${input.lng ?? null},
      ${input.silverScore ?? null},
      now()
    )
    on conflict (slug) do update set
      name=excluded.name,
      city=excluded.city,
      country=excluded.country,
      lat=coalesce(excluded.lat,canonical_hotels.lat),
      lng=coalesce(excluded.lng,canonical_hotels.lng),
      updated_at=now()
    returning id::text
  `;
  return rows[0]?.id ?? null;
}

export async function upsertProviderHotel(input:{
  hotelId:string;
  provider:string;
  providerHotelId:string;
  rawHash?:string;
  verifiedAt?:string;
}){
  const sql=getDatabase();
  if(!sql) return false;
  await sql`
    insert into provider_hotels (hotel_id,provider,provider_hotel_id,raw_hash,last_seen_at,last_verified_at,status)
    values (
      ${input.hotelId}::uuid,
      ${input.provider},
      ${input.providerHotelId},
      ${input.rawHash ?? null},
      now(),
      ${input.verifiedAt ?? null},
      'ACTIVE'
    )
    on conflict (provider,provider_hotel_id) do update set
      hotel_id=excluded.hotel_id,
      raw_hash=excluded.raw_hash,
      last_seen_at=now(),
      last_verified_at=excluded.last_verified_at,
      status='ACTIVE'
  `;
  return true;
}

export async function persistRawProviderEvidence(input:{
  provider:string;
  providerHotelId?:string;
  providerOfferId?:string;
  evidenceHash:string;
  payload:unknown;
}){
  const sql=getDatabase();
  if(!sql) return null;
  const rows=await sql<{id:string}[]>`
    insert into raw_provider_evidence (
      provider,provider_hotel_id,provider_offer_id,evidence_hash,payload
    ) values (
      ${input.provider},
      ${input.providerHotelId ?? null},
      ${input.providerOfferId ?? null},
      ${input.evidenceHash},
      ${sql.json(input.payload as never)}
    )
    on conflict (provider,evidence_hash) do update set
      provider_hotel_id=coalesce(excluded.provider_hotel_id,raw_provider_evidence.provider_hotel_id),
      provider_offer_id=coalesce(excluded.provider_offer_id,raw_provider_evidence.provider_offer_id)
    returning id::text
  `;
  return rows[0]?.id ?? null;
}

export async function persistOfferSnapshot(input:{
  hotelId:string;
  provider:string;
  providerOfferId?:string;
  providerRequestId?:string;
  checkIn:string;
  checkOut:string;
  occupancy:number;
  board?:string;
  totalPrice:number;
  displayPrice?:number;
  currency:string;
  evidenceHash:string;
  deepLink?:string;
  evidence:unknown;
  verifiedAt:string;
  expiresAt?:string;
}){
  const sql=getDatabase();
  if(!sql) return null;
  const rows=await sql<{id:string}[]>`
    insert into offer_snapshots (
      hotel_id,provider,provider_offer_id,provider_request_id,
      check_in,check_out,occupancy,board,total_price,display_price,currency,
      evidence,evidence_hash,deep_link,verified_at,expires_at,source_mode
    ) values (
      ${input.hotelId}::uuid,
      ${input.provider},
      ${input.providerOfferId ?? null},
      ${input.providerRequestId ?? null},
      ${input.checkIn},
      ${input.checkOut},
      ${input.occupancy},
      ${input.board ?? null},
      ${input.totalPrice},
      ${input.displayPrice ?? null},
      ${input.currency},
      ${sql.json(input.evidence as never)},
      ${input.evidenceHash},
      ${input.deepLink ?? null},
      ${input.verifiedAt},
      ${input.expiresAt ?? null},
      'live'
    )
    returning id::text
  `;
  return rows[0]?.id ?? null;
}

export async function persistSellabilityAudit(input:{
  hotelId:string;
  offerSnapshotId?:string | null;
  result:Sellability;
  evidenceHash?:string;
}){
  const sql=getDatabase();
  if(!sql) return false;
  await sql`
    insert into sellability_audits (
      hotel_id,offer_snapshot_id,state,confidence,reasons,evidence_hash,evaluated_at
    ) values (
      ${input.hotelId}::uuid,
      ${input.offerSnapshotId ?? null}::uuid,
      ${input.result.state},
      ${input.result.confidence},
      ${sql.json(input.result.reasons)},
      ${input.evidenceHash ?? null},
      now()
    )
  `;
  await sql`
    update canonical_hotels
    set sellability_state=${input.result.state},confidence=${input.result.confidence},updated_at=now()
    where id=${input.hotelId}::uuid
  `;
  return true;
}

export async function startAcquisitionRun(input:{
  waveKey:string;
  mode:"seed"|"live";
  provider?:string;
  region?:string;
  checkIn?:string;
  durationDays?:number;
  payload?:unknown;
}){
  const sql=getDatabase();
  if(!sql) return null;
  const rows=await sql<{id:string}[]>`
    insert into acquisition_runs (
      wave_key,mode,provider,region,check_in,duration_days,input,status
    ) values (
      ${input.waveKey},
      ${input.mode},
      ${input.provider ?? null},
      ${input.region ?? null},
      ${input.checkIn ?? null},
      ${input.durationDays ?? null},
      ${sql.json((input.payload || {}) as never)},
      'RUNNING'
    )
    returning id::text
  `;
  return rows[0]?.id ?? null;
}

export async function finishAcquisitionRun(input:{
  runId:string;
  rawCount:number;
  canonicalCount:number;
  quoteTested:number;
  sellableCount:number;
  staleCount:number;
  quarantinedCount:number;
  errorCount:number;
  status:"COMPLETE"|"PARTIAL"|"FAILED";
}){
  const sql=getDatabase();
  if(!sql) return false;
  await sql`
    update acquisition_runs set
      raw_count=${input.rawCount},
      canonical_count=${input.canonicalCount},
      quote_tested=${input.quoteTested},
      sellable_count=${input.sellableCount},
      stale_count=${input.staleCount},
      quarantined_count=${input.quarantinedCount},
      error_count=${input.errorCount},
      status=${input.status},
      completed_at=now()
    where id=${input.runId}::uuid
  `;
  return true;
}
