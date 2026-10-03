"use client";
import type { Hotel } from "@/src/data/hotels";
import type { Party } from "@/src/core/planner";
import { adjustedMonthly } from "@/src/core/planner";

const euro=(n:number)=>"€"+Math.round(n).toLocaleString("en-US");

export default function SilverHotelCard({hotel,party,duration}:{hotel:Hotel;party:Party;duration:30|60|90}){
  const price=adjustedMonthly(hotel,party);
  return <article className="hotel silverHotel">
    <div className={"hotelVisual region-"+hotel.region.toLowerCase()}>
      <div><span className="flag">{hotel.flag}</span><span className="visualCity">{hotel.city}</span></div>
      <span className="score">SILVER {hotel.score}</span>
    </div>
    <div className="hotelBody">
      <div className="hotelTopline"><span>LONG STAY</span><span>{hotel.climate}</span></div>
      <h3>{hotel.name}</h3>
      <div className="loc">{hotel.city}, {hotel.country} · {duration} days · demo price</div>
      <div className="chips">{hotel.tags.slice(0,4).map(t=><span className="chip" key={t}>{t}</span>)}</div>
      <div className="hotelMeta">
        <span>✓ {hotel.board}</span>
        <span>✓ {hotel.tags.includes("clinic")?"Healthcare nearby":"Independent living"}</span>
        <span>✓ {hotel.tags.includes("walkable")?"Walkable":"Long-stay friendly"}</span>
      </div>
      <div className="priceRow">
        <div><b>{euro(price)}</b><small>/month · {hotel.board}</small></div>
        <a className="linkbtn" href={"/live/"+hotel.slug}>View stay →</a>
      </div>
    </div>
  </article>;
}
