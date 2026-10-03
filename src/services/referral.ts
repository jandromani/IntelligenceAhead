export type ReferralClick = {
  clickId: string;
  visitorId?: string;
  sessionId?: string;
  hotelSlug: string;
  canonicalHotelId?: string;
  offerSnapshotId?: string;
  expectedCommission?: number;
  provider: string;
  source?: string;
  campaign?: string;
  pagePath?: string;
  position?: number;
  createdAt: string;
};

export function createReferralClick(input: Omit<ReferralClick, "clickId" | "createdAt">): ReferralClick {
  return {
    ...input,
    clickId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
}

export function referralLog(click: ReferralClick) {
  return JSON.stringify({ level: "info", event: "referral_click", ...click });
}
