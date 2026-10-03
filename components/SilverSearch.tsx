"use client";
import type { Party } from "@/src/core/planner";

export default function SilverSearch(props:{
  query:string;setQuery:(v:string)=>void;region:string;setRegion:(v:string)=>void;
  duration:30|60|90;setDuration:(v:30|60|90)=>void;party:Party;setParty:(v:Party)=>void;
  count:number;onSearch:()=>void;
}){
  return <div className="silverSearch">
    <label><span>Where?</span><input value={props.query} onChange={e=>props.setQuery(e.target.value)} placeholder="Tenerife, sea, Thailand…"/></label>
    <label><span>Region</span><select value={props.region} onChange={e=>props.setRegion(e.target.value)}><option>All</option><option>Europe</option><option>Asia</option><option>Africa</option><option>Americas</option></select></label>
    <label><span>Stay</span><select value={props.duration} onChange={e=>props.setDuration(Number(e.target.value) as 30|60|90)}><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></label>
    <label><span>Travelling</span><select value={props.party} onChange={e=>props.setParty(e.target.value as Party)}><option value="solo">Solo</option><option value="couple">Couple</option></select></label>
    <button className="searchCta" onClick={props.onSearch}>Show {props.count||"matching"} stays</button>
  </div>;
}
