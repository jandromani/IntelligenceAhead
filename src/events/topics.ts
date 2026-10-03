export const TOPICS = [
  "hotel.discovered",
  "hotel.normalized",
  "hotel.identity.resolved",
  "quote.requested",
  "quote.verified",
  "hotel.sellable",
  "offer.viewed",
  "referral.clicked",
  "conversion.received",
  "commission.confirmed",
  "seo.opportunity",
  "experiment.completed",
  "agent.alert",
] as const;

export type Topic = typeof TOPICS[number];

export type DomainEvent<T = unknown> = {
  id: string;
  topic: Topic;
  occurredAt: string;
  correlationId: string;
  payload: T;
};

export function event<T>(topic: Topic, correlationId: string, payload: T): DomainEvent<T> {
  return { id: crypto.randomUUID(), topic, correlationId, occurredAt: new Date().toISOString(), payload };
}
