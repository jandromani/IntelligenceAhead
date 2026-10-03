import { send } from "@vercel/queue";

export type BusEvent<T=unknown>={
  id:string;
  type:string;
  occurredAt:string;
  correlationId?:string;
  payload:T;
};

export async function publishBusEvent<T>(event:BusEvent<T>){
  try{
    const result=await send("atlas-events",event,{
      idempotencyKey:event.id,
      retentionSeconds:86400,
      headers:event.correlationId?{"x-correlation-id":event.correlationId}:undefined,
    });
    return{published:true,messageId:result.messageId};
  }catch(error){
    console.warn(JSON.stringify({level:"warning",event:"queue_publish_failed",type:event.type,id:event.id,error:String(error)}));
    return{published:false,error:String(error)};
  }
}

export function busEvent<T>(type:string,payload:T,correlationId?:string,id?:string):BusEvent<T>{
  return{id:id||crypto.randomUUID(),type,occurredAt:new Date().toISOString(),correlationId,payload};
}
