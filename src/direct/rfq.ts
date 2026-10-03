export type LongStayRFQ={
  hotelName:string;
  city:string;
  country:string;
  checkIn:string;
  nights:number;
  guests:1|2;
  board:"room"|"breakfast"|"half-board"|"full-board"|"all-inclusive";
  targetMonthlyEur:number;
};

export function buildRFQ(input:LongStayRFQ){
  if(input.nights<30||input.nights>180) throw new Error("RFQ nights must be 30..180");
  const totalTarget=Math.round(input.targetMonthlyEur*(input.nights/30));
  return{
    subject:`Long-stay request · ${input.nights} nights · ${input.city}`,
    commercial:{
      targetTotalEur:totalTarget,
      targetMonthlyEur:input.targetMonthlyEur,
      requestedBoard:input.board,
      guests:input.guests,
      stay:{checkIn:input.checkIn,nights:input.nights},
    },
    hotel:{
      name:input.hotelName,
      city:input.city,
      country:input.country,
    },
    proposition:[
      "Single guest/couple for a prolonged stay",
      "Lower turnover and housekeeping frequency than transient demand",
      "Shoulder/low-season occupancy opportunity",
      "Commissionable or net LONG30/LONG60/LONG90/LONG180 rate accepted",
    ],
  };
}
