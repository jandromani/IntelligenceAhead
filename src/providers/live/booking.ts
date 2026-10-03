import {
  fetchJson,
  finiteNumber,
  localizedText,
  type LiveProviderStatus,
  type LiveSearchBase,
  type LiveSearchHit,
} from "./common";

export type BookingCoordinates = { latitude: number; longitude: number; radius: number };

export type BookingSearchInput = LiveSearchBase & {
  cityId?: number;
  coordinates?: BookingCoordinates;
  bookerCountry?: string;
  platform?: "desktop" | "mobile" | "tablet";
  rooms?: number;
  rows?: number;
};

type BookingCurrency = string | { accommodation?: string; booker?: string };
type BookingUrl = string | { web?: string; app?: string };
type BookingProduct = {
  id?: string;
  price?: { display?: number | string; total?: number | string };
  policies?: { meal_plan?: unknown };
};

export type BookingSearchResponse = {
  request_id?: string;
  data?: Array<{
    id?: number | string;
    currency?: BookingCurrency;
    price?: { display?: number | string; total?: number | string; book?: number | string };
    url?: BookingUrl;
    deep_link_url?: string;
    products?: BookingProduct[];
  }>;
  metadata?: { next_page?: string; total_results?: number };
};

type BookingDetailsResponse = {
  request_id?: string;
  data?: Array<{
    id?: number | string;
    name?: unknown;
    location?: {
      address?: unknown;
      city?: number;
      coordinates?: { latitude?: number; longitude?: number };
    };
    url?: BookingUrl;
    currency?: string;
    long_stay_friendly?: boolean;
  }>;
};

export type BookingAccommodationDetails = {
  providerHotelId: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  webUrl?: string;
  raw: unknown;
};

function currencyCode(value: BookingCurrency | undefined) {
  if (typeof value === "string") return value;
  return value?.booker || value?.accommodation;
}

function webUrl(value: BookingUrl | undefined, legacy?: string) {
  if (typeof value === "string") return value;
  return value?.web || legacy || value?.app;
}

export function parseBookingSearchResponse(
  data: BookingSearchResponse,
  verifiedAt = new Date().toISOString(),
): LiveSearchHit[] {
  return (data.data || []).flatMap(row => {
    if (row.id === undefined) return [];
    const product = row.products?.[0];
    const displayPrice = finiteNumber(
      row.price?.display ?? product?.price?.display ?? row.price?.total ?? product?.price?.total ?? row.price?.book,
    );
    const totalPrice = finiteNumber(
      row.price?.total ?? product?.price?.total ?? row.price?.display ?? product?.price?.display ?? row.price?.book,
    );
    const link = webUrl(row.url, row.deep_link_url);

    return [{
      provider: "booking",
      providerHotelId: String(row.id),
      providerOfferId: product?.id,
      providerRequestId: data.request_id,
      totalPrice,
      displayPrice,
      currency: currencyCode(row.currency),
      deepLink: link,
      verifiedAt,
      stage: "search" as const,
      commercialFulfillment: link ? "redirect" as const : "none" as const,
      raw: row,
    }];
  });
}

export class BookingDemandClient {
  readonly provider = "booking";

  status(): LiveProviderStatus {
    const missingEnv = ["BOOKING_API_KEY","BOOKING_AFFILIATE_ID"].filter(key => !process.env[key]);
    const base = process.env.BOOKING_API_BASE || "https://demandapi-sandbox.booking.com/3.2";
    return {
      provider:this.provider,
      configured:missingEnv.length===0,
      environment:base.includes("sandbox") ? "sandbox" : "production",
      missingEnv,
      notes:[
        "Demand API v3.2 accommodations search/details",
        "Bearer token + X-Affiliate-Id",
        "Uses price.display for customer-facing price where supplied",
        "Supports city or latitude/longitude/radius discovery",
      ],
    };
  }

  private headers() {
    return {
      Authorization:"Bearer "+process.env.BOOKING_API_KEY,
      "X-Affiliate-Id":String(process.env.BOOKING_AFFILIATE_ID),
      "Content-Type":"application/json",
    };
  }

  async search(input: BookingSearchInput): Promise<LiveSearchHit[]> {
    const status=this.status();
    if(!status.configured) throw new Error("Booking provider disabled: "+status.missingEnv.join(", "));
    if(input.cityId === undefined && !input.coordinates) throw new Error("Booking search requires cityId or coordinates");
    if(input.cityId !== undefined && input.coordinates) throw new Error("Booking search accepts one location strategy at a time");

    const base=process.env.BOOKING_API_BASE || "https://demandapi-sandbox.booking.com/3.2";
    const body:Record<string,unknown>={
      booker:{country:input.bookerCountry || "es",platform:input.platform || "desktop"},
      checkin:input.checkIn,
      checkout:input.checkOut,
      currency:input.currency || "EUR",
      guests:{number_of_adults:input.adults,number_of_rooms:input.rooms || 1},
      extras:["products"],
      rows:Math.max(10,Math.min(100,Math.ceil((input.rows || 20)/10)*10)),
      sort:{by:"price",direction:"ascending"},
    };
    if(input.cityId !== undefined) body.city=input.cityId;
    if(input.coordinates) body.coordinates=input.coordinates;

    const data=await fetchJson<BookingSearchResponse>(this.provider,base+"/accommodations/search",{
      method:"POST",
      headers:this.headers(),
      body:JSON.stringify(body),
    },{retries:2});
    return parseBookingSearchResponse(data);
  }

  async details(accommodationIds: Array<number | string>): Promise<BookingAccommodationDetails[]> {
    const status=this.status();
    if(!status.configured) throw new Error("Booking provider disabled: "+status.missingEnv.join(", "));
    if(!accommodationIds.length) return [];
    const base=process.env.BOOKING_API_BASE || "https://demandapi-sandbox.booking.com/3.2";
    const ids=accommodationIds.slice(0,100).map(id=>Number(id)).filter(Number.isFinite);
    const data=await fetchJson<BookingDetailsResponse>(this.provider,base+"/accommodations/details",{
      method:"POST",
      headers:this.headers(),
      body:JSON.stringify({ accommodations:ids, languages:["en-gb"] }),
    },{retries:2});

    return (data.data || []).flatMap(row=>{
      if(row.id===undefined) return [];
      return [{
        providerHotelId:String(row.id),
        name:localizedText(row.name),
        latitude:finiteNumber(row.location?.coordinates?.latitude),
        longitude:finiteNumber(row.location?.coordinates?.longitude),
        webUrl:webUrl(row.url),
        raw:row,
      }];
    });
  }
}
