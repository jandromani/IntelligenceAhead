import { getDatabase } from "@/src/db/client";
import { normalizeLiveCatalogRow, type LiveCatalogOffer, type LiveCatalogRow } from "@/src/core/live-offers";

type DbOfferRow={
  offer_id:string;
  hotel_id:string;
  slug:string;
  name:string;
  city:string;
  country:string;
  lat:number|null;
  lng:number|null;
  provider:string;
  check_in:string;
  check_out:string;
  nights:number;
  board:string|null;
  display_price:number;
  currency:string;
  verified_at:string;
  confidence:number;
  deep_link?:string|null;
};

function normalizeDbRow(row:DbOfferRow):LiveCatalogOffer{
  const base:LiveCatalogRow={
    offerId:row.offer_id,
    hotelId:row.hotel_id,
    slug:row.slug,
    name:row.name,
    city:row.city,
    country:row.country,
    lat:row.lat,
    lng:row.lng,
    provider:row.provider,
    checkIn:String(row.check_in).slice(0,10),
    checkOut:String(row.check_out).slice(0,10),
    nights:Number(row.nights),
    board:row.board,
    displayPrice:Number(row.display_price),
    currency:row.currency,
    verifiedAt:new Date(row.verified_at).toISOString(),
    confidence:Number(row.confidence),
  };
  return normalizeLiveCatalogRow(base);
}

export async function listSellableOffers(input:{limit?:number;q?:string;maxMonthly?:number}={}):Promise<LiveCatalogOffer[]>{
  const sql=getDatabase();
  if(!sql) return[];
  const limit=Math.max(1,Math.min(50,input.limit ?? 12));
  const q=input.q?.trim() ? "%"+input.q.trim()+"%" : null;
  const maxMonthly=input.maxMonthly && input.maxMonthly>0 ? input.maxMonthly : null;

  const rows=await sql<DbOfferRow[]>`
    with eligible as (
      select
        o.id::text as offer_id,
        h.id::text as hotel_id,
        h.slug,h.name,h.city,h.country,h.lat,h.lng,
        o.provider,o.check_in::text,o.check_out::text,
        (o.check_out-o.check_in)::int as nights,
        o.board,
        coalesce(o.display_price,o.total_price)::float as display_price,
        o.currency,
        o.verified_at::text,
        a.confidence::float,
        o.deep_link,
        row_number() over (
          partition by o.hotel_id
          order by coalesce(o.display_price,o.total_price) asc,o.verified_at desc
        ) as price_rank
      from offer_snapshots o
      join canonical_hotels h on h.id=o.hotel_id
      join lateral (
        select state,confidence,evaluated_at
        from sellability_audits sa
        where sa.offer_snapshot_id=o.id
        order by sa.evaluated_at desc
        limit 1
      ) a on true
      where a.state='SELLABLE'
        and o.source_mode='live'
        and o.deep_link is not null
        and coalesce(o.display_price,o.total_price)>0
        and (o.expires_at is null or o.expires_at>now())
        and (${q}::text is null or h.name ilike ${q} or h.city ilike ${q} or h.country ilike ${q})
        and (
          ${maxMonthly}::float is null or
          (coalesce(o.display_price,o.total_price)::float / greatest(1,(o.check_out-o.check_in)::int) * 30) <= ${maxMonthly}
        )
    )
    select offer_id,hotel_id,slug,name,city,country,lat,lng,provider,check_in,check_out,nights,board,display_price,currency,verified_at,confidence,deep_link
    from eligible
    where price_rank=1
    order by display_price asc,confidence desc
    limit ${limit}
  `;
  return rows.map(normalizeDbRow);
}

export async function getSellableOfferForReferral(offerId:string){
  const sql=getDatabase();
  if(!sql) return null;
  const rows=await sql<DbOfferRow[]>`
    select
      o.id::text as offer_id,
      h.id::text as hotel_id,
      h.slug,h.name,h.city,h.country,h.lat,h.lng,
      o.provider,o.check_in::text,o.check_out::text,
      (o.check_out-o.check_in)::int as nights,
      o.board,
      coalesce(o.display_price,o.total_price)::float as display_price,
      o.currency,o.verified_at::text,a.confidence::float,o.deep_link
    from offer_snapshots o
    join canonical_hotels h on h.id=o.hotel_id
    join lateral (
      select state,confidence,evaluated_at
      from sellability_audits sa
      where sa.offer_snapshot_id=o.id
      order by sa.evaluated_at desc
      limit 1
    ) a on true
    where o.id=${offerId}::uuid
      and a.state='SELLABLE'
      and o.source_mode='live'
      and o.deep_link is not null
      and (o.expires_at is null or o.expires_at>now())
    limit 1
  `;
  const row=rows[0];
  if(!row || !row.deep_link) return null;
  return{...normalizeDbRow(row),deepLink:row.deep_link};
}
