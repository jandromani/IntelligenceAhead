import type { Hotel } from "@/src/data/hotels";

export type PlanMode = "world" | "winter" | "value" | "slow";
export type Party = "solo" | "couple";

export type PlanStop = {
  hotel: Hotel;
  days: number;
  monthlyCost: number;
  transport: number;
  transportDistanceKm: number;
  transportMode: "start" | "ground" | "flight";
};

const mobility = (a: Hotel, b: Hotel) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return {
    km: Math.round(km),
    mode: (km > 700 ? "flight" : "ground") as "flight" | "ground",
    cost: Math.round(Math.max(45, Math.min(520, 35 + km * 0.055))),
  };
};

export function adjustedMonthly(hotel: Hotel, party: Party) {
  return Math.round(hotel.monthly * (party === "couple" ? hotel.coupleFactor : 1));
}

export function buildPlan(
  hotels: Hotel[],
  budget: number,
  party: Party,
  duration: 30 | 60 | 90,
  mode: PlanMode
): PlanStop[] {
  const monthlyBudget = Math.max(700, budget);
  let candidates = [...hotels].filter((h) => adjustedMonthly(h, party) <= monthlyBudget * 1.08);

  if (mode === "value") candidates.sort((a, b) => adjustedMonthly(a, party) - adjustedMonthly(b, party) || b.score - a.score);
  if (mode === "winter") candidates = candidates.filter((h) => /2[0-9]°C|19°C|18°C/.test(h.climate)).sort((a,b)=>b.score-a.score);
  if (mode === "slow") candidates = candidates.filter((h) => h.region === "Europe").sort((a,b)=>b.score-a.score);
  if (mode === "world") candidates.sort((a,b)=>b.score-a.score);

  if (!candidates.length) candidates = [...hotels].sort((a,b)=>adjustedMonthly(a,party)-adjustedMonthly(b,party));

  const stopsNeeded = Math.ceil(360 / duration);
  const picked: Hotel[] = [];
  const regions = new Set<string>();

  for (const h of candidates) {
    if (picked.length >= stopsNeeded) break;
    if (mode === "world" && regions.has(h.region) && candidates.some(x => !regions.has(x.region) && !picked.includes(x))) continue;
    picked.push(h);
    regions.add(h.region);
  }
  for (const h of candidates) {
    if (picked.length >= stopsNeeded) break;
    if (!picked.includes(h)) picked.push(h);
  }

  return picked.slice(0, stopsNeeded).map((hotel, i, arr) => {
    const move = i === 0 ? null : mobility(arr[i - 1], hotel);
    return {
      hotel,
      days: duration,
      monthlyCost: adjustedMonthly(hotel, party),
      transport: move?.cost ?? 0,
      transportDistanceKm: move?.km ?? 0,
      transportMode: move?.mode ?? "start",
    };
  });
}

export function planTotals(stops: PlanStop[]) {
  const hotelTotal = stops.reduce((s, x) => s + x.monthlyCost * (x.days / 30), 0);
  const transportTotal = stops.reduce((s, x) => s + x.transport, 0);
  const days = stops.reduce((s, x) => s + x.days, 0);
  return {
    hotelTotal: Math.round(hotelTotal),
    transportTotal,
    total: Math.round(hotelTotal + transportTotal),
    days,
  };
}
