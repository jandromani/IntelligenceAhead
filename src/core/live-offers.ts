export type LiveCatalogRow={
  offerId:string;
  hotelId:string;
  slug:string;
  name:string;
  city:string;
  country:string;
  lat:number|null;
  lng:number|null;
  provider:string;
  checkIn:string;
  checkOut:string;
  nights:number;
  board:string|null;
  displayPrice:number;
  currency:string;
  verifiedAt:string;
  confidence:number;
};

export type LiveCatalogOffer=LiveCatalogRow & { monthlyEquivalent:number };

export function monthlyEquivalent(displayPrice:number,nights:number){
  if(!Number.isFinite(displayPrice)||displayPrice<=0) throw new Error("displayPrice must be positive");
  if(!Number.isFinite(nights)||nights<=0) throw new Error("nights must be positive");
  return Math.round((displayPrice/nights)*30*100)/100;
}

export function normalizeLiveCatalogRow(row:LiveCatalogRow):LiveCatalogOffer{
  return{...row,monthlyEquivalent:monthlyEquivalent(row.displayPrice,row.nights)};
}

export function safeCommercialUrl(provider:string,raw:string){
  let url:URL;
  try{url=new URL(raw);}catch{return null;}
  if(url.protocol!=="https:") return null;
  const host=url.hostname.toLowerCase();
  if(provider==="booking" && !(host==="booking.com" || host.endsWith(".booking.com"))) return null;
  if(!["booking"].includes(provider)) return null;
  return url;
}
