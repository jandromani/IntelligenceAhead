import { hotels } from "@/src/data/hotels";
import { evaluateSellability } from "@/src/core/truth";

export type AcquisitionWaveInput = {
  waveKey: string;
  regions?: string[];
  providers?: string[];
  durations?: number[];
};

export type AcquisitionWaveResult = {
  waveKey: string;
  mode: "seed" | "live";
  rawRecords: number;
  canonicalHotels: number;
  quoteTested: number;
  sellable: number;
  demo: number;
  stale: number;
  quarantined: number;
  byRegion: Record<string, number>;
};

export function runSeedAcquisitionWave(input: AcquisitionWaveInput): AcquisitionWaveResult {
  const selected = hotels.filter(h => !input.regions?.length || input.regions.includes(h.region));
  const truth = selected.map(evaluateSellability);
  const byRegion = selected.reduce<Record<string, number>>((acc, h) => {
    acc[h.region] = (acc[h.region] || 0) + 1;
    return acc;
  }, {});

  return {
    waveKey: input.waveKey,
    mode: "seed",
    rawRecords: selected.length * Math.max(1, input.providers?.length || 3),
    canonicalHotels: selected.length,
    quoteTested: selected.length * Math.max(1, input.durations?.length || 1),
    sellable: 0,
    demo: truth.filter(x => x.state === "DEMO").length,
    stale: 0,
    quarantined: truth.filter(x => x.state === "QUARANTINED").length,
    byRegion,
  };
}
