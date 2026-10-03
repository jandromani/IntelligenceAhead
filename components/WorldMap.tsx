"use client";

import type { Hotel } from "@/src/data/hotels";

type Props={
  hotels:Hotel[];
  route:Hotel[];
};

const point=(h:Hotel)=>({
  x:((h.lng+180)/360)*1000,
  y:((90-h.lat)/180)*500,
});

export default function WorldMap({hotels,route}:Props){
  const selected=new Set(route.map(h=>h.id));
  const routePoints=route.map(point).map(p=>`${p.x},${p.y}`).join(" ");

  return <div className="worldMap" role="img" aria-label="World map showing catalogue locations and generated route">
    <div className="mapHeader">
      <div><b>YOUR YEAR ON EARTH</b><span>{route.length} stops · {hotels.length} places in the current catalogue</span></div>
      <div className="mapLegend"><span><i className="mapDot all"/> catalogue</span><span><i className="mapDot routeDot"/> your route</span></div>
    </div>
    <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0b1b39"/>
          <stop offset="100%" stopColor="#112a52"/>
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="1000" height="500" rx="22" fill="url(#ocean)"/>
      {[100,200,300,400,500,600,700,800,900].map(x=><line key={"v"+x} x1={x} y1="0" x2={x} y2="500" stroke="rgba(255,255,255,.055)" strokeWidth="1"/>)}
      {[100,200,300,400].map(y=><line key={"h"+y} x1="0" y1={y} x2="1000" y2={y} stroke="rgba(255,255,255,.055)" strokeWidth="1"/>)}
      <text x="110" y="225" fill="rgba(255,255,255,.12)" fontSize="34" fontWeight="800">AMERICAS</text>
      <text x="495" y="170" fill="rgba(255,255,255,.12)" fontSize="28" fontWeight="800">EUROPE</text>
      <text x="500" y="300" fill="rgba(255,255,255,.12)" fontSize="30" fontWeight="800">AFRICA</text>
      <text x="690" y="220" fill="rgba(255,255,255,.12)" fontSize="38" fontWeight="800">ASIA</text>
      {routePoints && <polyline points={routePoints} fill="none" stroke="#c8ff6a" strokeWidth="4" strokeDasharray="8 9" strokeLinecap="round" strokeLinejoin="round" opacity=".82" filter="url(#glow)"/>}
      {hotels.map(h=>{
        const p=point(h);
        const active=selected.has(h.id);
        return <g key={h.id}>
          <circle cx={p.x} cy={p.y} r={active?9:4.5} fill={active?"#c8ff6a":"#8ba5d5"} stroke={active?"white":"none"} strokeWidth={active?2:0} opacity={active?1:.72}>
            <title>{h.city}, {h.country} · €{h.monthly}/month prototype</title>
          </circle>
        </g>
      })}
      {route.map((h,i)=>{
        const p=point(h);
        return <g key={"label-"+h.id}>
          <circle cx={p.x+12} cy={p.y-13} r="10" fill="#ffffff"/>
          <text x={p.x+12} y={p.y-9} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0a1630">{i+1}</text>
        </g>
      })}
    </svg>
    <div className="mapStops">
      {route.map((h,i)=><span key={h.id}><b>{i+1}</b>{h.flag} {h.city}</span>)}
    </div>
  </div>;
}
