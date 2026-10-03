import { handleCallback } from "@vercel/queue";

export const POST=handleCallback(
  async (message,metadata)=>{
    console.log(JSON.stringify({
      level:"info",
      event:"queue_event_consumed",
      topic:metadata.topicName,
      consumerGroup:metadata.consumerGroup,
      messageId:metadata.messageId,
      deliveryCount:metadata.deliveryCount,
      payload:message,
    }));
  },
  {
    visibilityTimeoutSeconds:60,
    retry:(_error,metadata)=>metadata.deliveryCount>5?{acknowledge:true}:{afterSeconds:Math.min(300,2**metadata.deliveryCount*5)},
  },
);
