import { hotels } from "@/src/data/hotels";
import type { HotelProvider, ProviderHotel, ProviderQuote, QuoteRequest } from "./types";

function nightsBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000));
}

export class MockProvider implements HotelProvider {
  readonly name = "mock" as const;

  async discover(input: { city?: string; country?: string; limit?: number }): Promise<ProviderHotel[]> {
    const rows = hotels.filter(h =>
      (!input.city || h.city.toLowerCase().includes(input.city.toLowerCase())) &&
      (!input.country || h.country.toLowerCase().includes(input.country.toLowerCase()))
    );
    return rows.slice(0, input.limit ?? 50).map(h => ({
      provider: this.name,
      providerHotelId: "mock_" + h.id,
      name: h.name,
      city: h.city,
      country: h.country,
      lat: h.lat,
      lng: h.lng,
    }));
  }

  async quote(input: QuoteRequest): Promise<ProviderQuote | null> {
    const hotel = hotels.find(h => "mock_" + h.id === input.providerHotelId);
    if (!hotel) return null;
    const nights = nightsBetween(input.checkIn, input.checkOut);
    const occupancyFactor = input.occupancy === 2 ? hotel.coupleFactor : 1;
    const totalPrice = Math.round(hotel.monthly * (nights / 30) * occupancyFactor);
    return {
      provider: this.name,
      providerHotelId: input.providerHotelId,
      providerOfferId: "offer_" + hotel.id + "_" + input.checkIn + "_" + nights,
      totalPrice,
      currency: "EUR",
      board: hotel.board,
      cancellation: "prototype-only",
      verifiedAt: new Date().toISOString(),
      deepLink: "/api/referral?hotel=" + encodeURIComponent(hotel.slug) + "&provider=" + hotel.provider,
      rawEvidence: { seed: true, nights, monthlySeed: hotel.monthly },
    };
  }

  async health() {
    return { ok: true, latencyMs: 1, message: "deterministic seed provider" };
  }
}
