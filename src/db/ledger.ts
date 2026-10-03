import { getDatabase } from "@/src/db/client";
import type { ReferralClick } from "@/src/services/referral";

export type PersistResult={persisted:boolean;reason?:string};

export async function persistGrowthEvent(input:{
  visitorId?:string;
  sessionId?:string;
  name:string;
  properties:Record<string,string|number|boolean>;
  pagePath?:string;
}):Promise<PersistResult>{
  const sql=getDatabase();
  if(!sql) return{persisted:false,reason:"database-not-configured"};

  try{
    await sql`
      insert into growth_events (visitor_id,session_id,event_name,properties,page_path)
      values (
        ${input.visitorId ?? null},
        ${input.sessionId ?? null},
        ${input.name},
        ${sql.json(input.properties)},
        ${input.pagePath ?? null}
      )
    `;
    return{persisted:true};
  }catch(error){
    console.error(JSON.stringify({level:"error",event:"db_growth_event_failed",error:String(error)}));
    return{persisted:false,reason:"database-write-failed"};
  }
}

export async function persistReferralClick(click:ReferralClick):Promise<PersistResult>{
  const sql=getDatabase();
  if(!sql) return{persisted:false,reason:"database-not-configured"};

  try{
    await sql`
      insert into referral_clicks (
        click_id,visitor_id,session_id,hotel_id,provider,offer_snapshot_id,
        source,campaign,page_path,position,expected_commission,created_at
      ) values (
        ${click.clickId},
        ${click.visitorId ?? null},
        ${click.sessionId ?? null},
        ${click.canonicalHotelId ?? null}::uuid,
        ${click.provider},
        ${click.offerSnapshotId ?? null}::uuid,
        ${click.source ?? null},
        ${click.campaign ?? null},
        ${click.pagePath ?? null},
        ${click.position ?? null},
        ${click.expectedCommission ?? null},
        ${click.createdAt}
      )
      on conflict (click_id) do nothing
    `;
    return{persisted:true};
  }catch(error){
    console.error(JSON.stringify({level:"error",event:"db_referral_click_failed",clickId:click.clickId,error:String(error)}));
    return{persisted:false,reason:"database-write-failed"};
  }
}

export async function persistConversion(input:{
  clickId:string;
  provider:string;
  providerConversionId:string;
  bookingValue?:number;
  commission?:number;
  currency?:string;
  status?:string;
  occurredAt?:string;
}):Promise<PersistResult>{
  const sql=getDatabase();
  if(!sql) return{persisted:false,reason:"database-not-configured"};

  try{
    await sql`
      insert into conversions (
        click_id,provider,provider_conversion_id,booking_value,commission,currency,status,occurred_at
      ) values (
        ${input.clickId},
        ${input.provider},
        ${input.providerConversionId},
        ${input.bookingValue ?? null},
        ${input.commission ?? null},
        ${input.currency ?? null},
        ${input.status ?? "REPORTED"},
        ${input.occurredAt ?? null}
      )
      on conflict (provider,provider_conversion_id)
      do update set
        booking_value=excluded.booking_value,
        commission=excluded.commission,
        currency=excluded.currency,
        status=excluded.status,
        occurred_at=excluded.occurred_at
    `;
    return{persisted:true};
  }catch(error){
    console.error(JSON.stringify({level:"error",event:"db_conversion_failed",clickId:input.clickId,provider:input.provider,error:String(error)}));
    return{persisted:false,reason:"database-write-failed"};
  }
}
