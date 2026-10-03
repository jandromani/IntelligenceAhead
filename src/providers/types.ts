export type ProviderName = "booking" | "ratehawk" | "hbx" | "direct" | "mock";

export type ProviderHotel = {
  provider: ProviderName;
  providerHotelId: string;
  name: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
};

export type QuoteRequest = {
  providerHotelId: string;
  checkIn: string;
  checkOut: string;
  occupancy: 1 | 2;
  board?: string;
};

export type ProviderQuote = {
  provider: ProviderName;
  providerHotelId: string;
  providerOfferId: string;
  totalPrice: number;
  currency: string;
  board?: string;
  cancellation?: string;
  verifiedAt: string;
  deepLink?: string;
  rawEvidence: Record<string, unknown>;
};

export interface HotelProvider {
  readonly name: ProviderName;
  discover(input: { city?: string; country?: string; limit?: number }): Promise<ProviderHotel[]>;
  quote(input: QuoteRequest): Promise<ProviderQuote | null>;
  health(): Promise<{ ok: boolean; latencyMs: number; message?: string }>;
}
