import { runBookingLiveWave, type BookingLiveWaveInput } from "@/src/services/booking-live-wave";

export async function executeBookingLiveWave(input:BookingLiveWaveInput){
  "use step";
  return runBookingLiveWave(input);
}

export async function bookingLiveWaveWorkflow(input:BookingLiveWaveInput){
  "use workflow";
  const result=await executeBookingLiveWave(input);
  return{runType:"booking-live-wave",result,completedAt:new Date().toISOString()};
}
