export type EventProperty = string | number | boolean;

export function growthEvent(
  name: string,
  properties: Record<string, EventProperty> = {},
) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    name,
    path: window.location.pathname,
    properties,
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
  } catch {}

  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  });
}
