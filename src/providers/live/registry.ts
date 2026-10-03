import { BookingDemandClient } from "./booking";
import { RateHawkClient } from "./ratehawk";
import { HbxClient } from "./hbx";
export function liveProviderRegistry(){return{booking:new BookingDemandClient(),ratehawk:new RateHawkClient(),hbx:new HbxClient()};}
export function liveProviderStatuses(){return Object.values(liveProviderRegistry()).map(x=>x.status());}
