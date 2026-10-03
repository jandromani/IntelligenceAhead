export type StaySegment={
  index:number;
  checkIn:string;
  checkOut:string;
  nights:number;
};

function addDays(date:string,days:number){
  const d=new Date(date+"T00:00:00Z");
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}

export function splitStay(checkIn:string,totalNights:number,maxSegmentNights:number):StaySegment[]{
  if(totalNights<=0) throw new Error("totalNights must be positive");
  if(maxSegmentNights<=0) throw new Error("maxSegmentNights must be positive");

  const out:StaySegment[]=[];
  let cursor=checkIn;
  let remaining=totalNights;
  let index=0;

  while(remaining>0){
    const nights=Math.min(maxSegmentNights,remaining);
    const checkOut=addDays(cursor,nights);
    out.push({index,checkIn:cursor,checkOut,nights});
    cursor=checkOut;
    remaining-=nights;
    index++;
  }
  return out;
}

export type SegmentQuote={
  segment:StaySegment;
  totalPrice:number;
  currency:string;
  providerOfferId?:string;
};

export function aggregateContinuousStay(quotes:SegmentQuote[]){
  if(!quotes.length) return{continuous:false,totalPrice:0,currency:undefined as string|undefined,reasons:["no segments"]};
  const reasons:string[]=[];
  const currency=quotes[0].currency;

  for(let i=0;i<quotes.length;i++){
    if(quotes[i].currency!==currency) reasons.push("currency mismatch");
    if(!Number.isFinite(quotes[i].totalPrice)||quotes[i].totalPrice<=0) reasons.push("invalid segment price");
    if(i>0&&quotes[i-1].segment.checkOut!==quotes[i].segment.checkIn) reasons.push("date discontinuity");
  }

  return{
    continuous:reasons.length===0,
    totalPrice:Math.round(quotes.reduce((s,q)=>s+q.totalPrice,0)*100)/100,
    currency,
    reasons:[...new Set(reasons)],
  };
}
