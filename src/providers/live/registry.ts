import { BookingDemandClient } from "./booking";
import { RateHawkClient } from "./ratehawk";
import { HbxClient } from "./hbx";

export function liveProviderRegistry(){
  return{
    booking:new BookingDemandClient(),
    ratehawk:new RateHawkClient(),
    hbx:new HbxClient(),
  };
}

export function liveProviderStatuses(){
  const registry=liveProviderRegistry();
  return Object.values(registry).map(client=>client.status());
}
