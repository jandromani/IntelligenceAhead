import { liveProviderRegistry } from "@/src/providers/live/registry";
import type { LiveProviderStatus } from "@/src/providers/live/common";

export type ProviderReadiness={
  provider:string;
  configured:boolean;
  commercialReady:boolean;
  environment:"sandbox"|"production";
  blockers:string[];
  grade:"DISABLED"|"DISCOVERY"|"COMMERCIAL_READY";
};

export function readinessFromStatus(status:LiveProviderStatus):ProviderReadiness{
  const blockers=[...(status.blockers || [])];
  if(!status.configured && !blockers.length) blockers.push("credentials not configured");
  const commercialReady=Boolean(status.configured && status.commercialReady);
  return{
    provider:status.provider,
    configured:status.configured,
    commercialReady,
    environment:status.environment,
    blockers,
    grade:!status.configured ? "DISABLED" : commercialReady ? "COMMERCIAL_READY" : "DISCOVERY",
  };
}

export function providerReadinessReport(){
  const registry=liveProviderRegistry();
  return Object.values(registry).map(provider=>readinessFromStatus(provider.status()));
}
