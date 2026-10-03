export type LiveProviderStatus = {
  provider: string;
  configured: boolean;
  environment: "sandbox" | "production";
  missingEnv: string[];
  notes: string[];
  commercialReady?: boolean;
  blockers?: string[];
};

export type LiveSearchHit = {
  provider: string;
  providerHotelId: string;
  providerOfferId?: string;
  providerRequestId?: string;
  totalPrice?: number;
  displayPrice?: number;
  currency?: string;
  board?: string;
  deepLink?: string;
  verifiedAt?: string;
  stage?: "search" | "availability" | "prebook";
  commercialFulfillment?: "redirect" | "api" | "none";
  raw: unknown;
};

export type LiveSearchBase = {
  checkIn: string;
  checkOut: string;
  adults: number;
  currency?: string;
};

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly provider: string,
    public readonly responseText?: string,
  ) {
    super(message);
  }
}

export function daysBetween(checkIn: string, checkOut: string) {
  return Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000);
}

export async function fetchJson<T>(
  provider: string,
  url: string,
  init: RequestInit,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  const retries = options.retries ?? 1;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      const text = await res.text();
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          await new Promise(r => setTimeout(r, 250 * 2 ** attempt));
          continue;
        }
        throw new ProviderHttpError(
          provider + " HTTP " + res.status,
          res.status,
          provider,
          text.slice(0, 1200),
        );
      }
      return (text ? JSON.parse(text) : {}) as T;
    } catch (error) {
      lastError = error;
      if (attempt >= retries || error instanceof ProviderHttpError) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function localizedText(value: unknown, preferred = "en-gb"): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const preferredValue = record[preferred];
  if (typeof preferredValue === "string" && preferredValue.trim()) return preferredValue.trim();
  for (const candidate of Object.values(record)) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return undefined;
}
