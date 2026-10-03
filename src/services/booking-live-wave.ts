import { hotels, type Hotel } from "@/src/data/hotels";
import { BookingDemandClient } from "@/src/providers/live/booking";
import { evaluateCommercialOffer } from "@/src/core/truth";
import { stableEvidenceHash } from "@/src/services/evidence";
import { databaseConfigured } from "@/src/db/client";
import {
  finishAcquisitionRun,
  persistOfferSnapshot,
  persistRawProviderEvidence,
  persistSellabilityAudit,
  startAcquisitionRun,
  upsertCanonicalHotel,
  upsertProviderHotel,
} from "@/src/db/supply";

export type BookingLiveWaveInput={
  waveKey:string;
  checkIn:string;
  nights:number;
  adults:1|2;
  regions?:Hotel["region"][];
  maxDestinations?:number;
  radiusKm?:number;
  rowsPerDestination?:number;
  persist?:boolean;
};

export type BookingLiveWaveResult={
  waveKey:string;
  mode:"live";
  provider:"booking";
  destinationsScanned:number;
  rawRecords:number;
  canonicalHotels:number;
  quoteTested:number;
  sellable:number;
  stale:number;
  quarantined:number;
  persisted:number;
  errors:Array<{destination:string;message:string}>;
};

function addDays(date:string,days:number){
  const d=new Date(date+"T00:00:00Z");
  if(Number.isNaN(d.getTime())) throw new Error("Invalid checkIn");
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}

export function bookingWaveAnchors(input:Pick<BookingLiveWaveInput,"regions"|"maxDestinations">){
  const seen=new Set<string>();
  const selected:Hotel[]=[];
  for(const hotel of hotels.slice().sort((a,b)=>b.score-a.score)){
    if(input.regions?.length && !input.regions.includes(hotel.region)) continue;
    const key=hotel.city.toLowerCase()+"|"+hotel.country.toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    selected.push(hotel);
    if(selected.length >= (input.maxDestinations ?? 8)) break;
  }
  return selected;
}

export async function runBookingLiveWave(input:BookingLiveWaveInput):Promise<BookingLiveWaveResult>{
  if(input.nights<1 || input.nights>90) throw new Error("Booking live wave supports 1..90 nights");
  if(input.maxDestinations!==undefined && (input.maxDestinations<1 || input.maxDestinations>30)) throw new Error("maxDestinations out of range");

  const client=new BookingDemandClient();
  const status=client.status();
  if(!status.configured) throw new Error("Booking provider disabled: "+status.missingEnv.join(", "));

  const shouldPersist=input.persist!==false && databaseConfigured();
  const checkOut=addDays(input.checkIn,input.nights);
  const anchors=bookingWaveAnchors(input);
  const result:BookingLiveWaveResult={
    waveKey:input.waveKey,
    mode:"live",
    provider:"booking",
    destinationsScanned:0,
    rawRecords:0,
    canonicalHotels:0,
    quoteTested:0,
    sellable:0,
    stale:0,
    quarantined:0,
    persisted:0,
    errors:[],
  };

  const runId=shouldPersist ? await startAcquisitionRun({
    waveKey:input.waveKey,
    mode:"live",
    provider:"booking",
    checkIn:input.checkIn,
    durationDays:input.nights,
    payload:input,
  }) : null;

  for(const anchor of anchors){
    const destination=anchor.city+", "+anchor.country;
    try{
      const hits=await client.search({
        checkIn:input.checkIn,
        checkOut,
        adults:input.adults,
        currency:"EUR",
        bookerCountry:"es",
        coordinates:{
          latitude:anchor.lat,
          longitude:anchor.lng,
          radius:input.radiusKm ?? 12,
        },
        rows:input.rowsPerDestination ?? 20,
      });
      result.destinationsScanned++;
      result.rawRecords+=hits.length;

      for(const hit of hits){
        if(shouldPersist){
          const rawHash=stableEvidenceHash(hit.raw);
          await persistRawProviderEvidence({
            provider:"booking",
            providerHotelId:hit.providerHotelId,
            providerOfferId:hit.providerOfferId,
            evidenceHash:rawHash,
            payload:hit.raw,
          });
        }
      }

      let details=new Map<string,Awaited<ReturnType<typeof client.details>>[number]>();
      try{
        const rows=await client.details(hits.map(hit=>hit.providerHotelId));
        details=new Map(rows.map(row=>[row.providerHotelId,row]));
      }catch(error){
        result.errors.push({destination,message:"details: "+String(error)});
      }

      for(const hit of hits){
        result.quoteTested++;
        const detail=details.get(hit.providerHotelId);
        const evidencePayload={search:hit.raw,details:detail?.raw};
        const evidenceHash=stableEvidenceHash(evidencePayload);
        const price=hit.displayPrice ?? hit.totalPrice ?? 0;
        const canonicalSlug="booking-"+hit.providerHotelId;
        const verifiedAt=hit.verifiedAt || new Date().toISOString();
        const displayName=detail?.name;

        if(!displayName){
          result.quarantined++;
          continue;
        }

        result.canonicalHotels++;
        const canonicalId=shouldPersist ? await upsertCanonicalHotel({
          slug:canonicalSlug,
          name:displayName,
          city:anchor.city,
          country:anchor.country,
          lat:detail?.latitude,
          lng:detail?.longitude,
        }) : null;

        if(shouldPersist){
          await persistRawProviderEvidence({
            provider:"booking",
            providerHotelId:hit.providerHotelId,
            providerOfferId:hit.providerOfferId,
            evidenceHash,
            payload:evidencePayload,
          });
        }

        const truth=evaluateCommercialOffer({
          hotelId:canonicalId || canonicalSlug,
          sourceMode:"live",
          provider:"booking",
          providerOfferId:hit.providerOfferId,
          totalPrice:price,
          currency:hit.currency || "",
          checkIn:input.checkIn,
          checkOut,
          verifiedAt,
          deepLink:hit.deepLink,
          rawHash:evidenceHash,
        });

        if(truth.state==="SELLABLE") result.sellable++;
        else if(truth.state==="STALE") result.stale++;
        else result.quarantined++;

        if(canonicalId && shouldPersist){
          await upsertProviderHotel({
            hotelId:canonicalId,
            provider:"booking",
            providerHotelId:hit.providerHotelId,
            rawHash:evidenceHash,
            verifiedAt,
          });

          let snapshotId:string|null=null;
          if(price>0 && hit.currency){
            snapshotId=await persistOfferSnapshot({
              hotelId:canonicalId,
              provider:"booking",
              providerOfferId:hit.providerOfferId,
              providerRequestId:hit.providerRequestId,
              checkIn:input.checkIn,
              checkOut,
              occupancy:input.adults,
              totalPrice:hit.totalPrice ?? price,
              displayPrice:hit.displayPrice ?? price,
              currency:hit.currency,
              evidenceHash,
              deepLink:hit.deepLink,
              evidence:evidencePayload,
              verifiedAt,
            });
          }

          await persistSellabilityAudit({
            hotelId:canonicalId,
            offerSnapshotId:snapshotId,
            result:truth,
            evidenceHash,
          });
          result.persisted++;
        }
      }
    }catch(error){
      result.errors.push({destination,message:String(error)});
    }
  }

  if(runId){
    await finishAcquisitionRun({
      runId,
      rawCount:result.rawRecords,
      canonicalCount:result.canonicalHotels,
      quoteTested:result.quoteTested,
      sellableCount:result.sellable,
      staleCount:result.stale,
      quarantinedCount:result.quarantined,
      errorCount:result.errors.length,
      status:result.errors.length ? "PARTIAL" : "COMPLETE",
    });
  }

  return result;
}
