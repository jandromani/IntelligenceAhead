import type { Hotel } from "@/src/data/hotels";

export type SellabilityState = "DEMO" | "SELLABLE" | "STALE" | "QUARANTINED";

export type Sellability = {
  hotelId: string;
  state: SellabilityState;
  confidence: number;
  reasons: string[];
};

export type CommercialOfferEvidence = {
  hotelId: string;
  sourceMode: "live" | "seed";
  provider: string;
  providerOfferId?: string;
  totalPrice: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  verifiedAt: string;
  expiresAt?: string;
  deepLink?: string;
  apiBookingCapable?: boolean;
  rawHash?: string;
};

export function evaluateSellability(hotel: Hotel): Sellability {
  const reasons: string[] = ["prototype_not_commercial"];

  if (hotel.monthly <= 0) reasons.push("invalid_seed_price");
  if (!hotel.provider) reasons.push("missing_provider_label");
  if (!Number.isFinite(hotel.lat) || !Number.isFinite(hotel.lng)) reasons.push("missing_geo");

  const structuralFailure = reasons.some(r => r !== "prototype_not_commercial");
  return {
    hotelId: hotel.id,
    state: structuralFailure ? "QUARANTINED" : "DEMO",
    confidence: 0,
    reasons,
  };
}

export function evaluateCommercialOffer(
  evidence: CommercialOfferEvidence,
  now = new Date(),
): Sellability {
  const reasons: string[] = [];

  if (evidence.sourceMode !== "live") reasons.push("prototype_not_commercial");
  if (!evidence.provider) reasons.push("missing_provider");
  if (!evidence.providerOfferId) reasons.push("missing_provider_offer_id");
  if (!Number.isFinite(evidence.totalPrice) || evidence.totalPrice <= 0) reasons.push("invalid_price");
  if (!/^[A-Z]{3}$/.test(evidence.currency)) reasons.push("invalid_currency");
  if (!evidence.rawHash) reasons.push("missing_raw_evidence_hash");
  if (!evidence.deepLink && !evidence.apiBookingCapable) reasons.push("missing_commercial_fulfillment_path");

  const verified = new Date(evidence.verifiedAt);
  if (Number.isNaN(verified.getTime())) reasons.push("invalid_verified_at");

  const expires = evidence.expiresAt ? new Date(evidence.expiresAt) : null;
  if (evidence.expiresAt && (!expires || Number.isNaN(expires.getTime()))) reasons.push("invalid_expires_at");

  if (evidence.sourceMode === "live" && reasons.length === 0) {
    if (expires && expires.getTime() <= now.getTime()) {
      return {
        hotelId: evidence.hotelId,
        state: "STALE",
        confidence: 0.35,
        reasons: ["quote_expired"],
      };
    }

    const ageHours = Math.max(0, (now.getTime() - verified.getTime()) / 3_600_000);
    const confidence = Math.max(0.8, Math.min(0.999, 0.999 - ageHours * 0.01));
    return {
      hotelId: evidence.hotelId,
      state: "SELLABLE",
      confidence: Number(confidence.toFixed(3)),
      reasons: [],
    };
  }

  if (evidence.sourceMode !== "live" && reasons.every(r => r === "prototype_not_commercial")) {
    return {
      hotelId: evidence.hotelId,
      state: "DEMO",
      confidence: 0,
      reasons,
    };
  }

  return {
    hotelId: evidence.hotelId,
    state: "QUARANTINED",
    confidence: 0,
    reasons: [...new Set(reasons)],
  };
}
