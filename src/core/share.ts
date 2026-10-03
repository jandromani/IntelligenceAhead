import type { Party, PlanMode } from "@/src/core/planner";

export type SharedPlanInput = {
  pension: number;
  rent: number;
  other: number;
  share: number;
  party: Party;
  duration: 30 | 60 | 90;
  mode: PlanMode;
};

function base64UrlEncode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(token: string) {
  const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - token.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodePlanToken(input: SharedPlanInput) {
  return base64UrlEncode(JSON.stringify(input));
}

export function decodePlanToken(token: string): SharedPlanInput | null {
  try {
    const raw = JSON.parse(base64UrlDecode(token)) as Partial<SharedPlanInput>;
    const duration = Number(raw.duration);
    if (
      !Number.isFinite(raw.pension) ||
      !Number.isFinite(raw.rent) ||
      !Number.isFinite(raw.other) ||
      !Number.isFinite(raw.share) ||
      !["solo","couple"].includes(String(raw.party)) ||
      ![30,60,90].includes(duration) ||
      !["world","winter","value","slow"].includes(String(raw.mode))
    ) return null;

    return {
      pension: Math.max(0, Math.min(10000, Number(raw.pension))),
      rent: Math.max(0, Math.min(10000, Number(raw.rent))),
      other: Math.max(0, Math.min(10000, Number(raw.other))),
      share: Math.max(20, Math.min(95, Number(raw.share))),
      party: raw.party as Party,
      duration: duration as 30|60|90,
      mode: raw.mode as PlanMode,
    };
  } catch {
    return null;
  }
}
