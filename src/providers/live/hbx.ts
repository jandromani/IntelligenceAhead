import type { LiveProviderStatus,LiveSearchHit } from "./common";
export class HbxClient{
  readonly provider="hbx";
  status():LiveProviderStatus{return{provider:this.provider,configured:false,commercialReady:false,environment:"sandbox",missingEnv:["HBX_API_KEY","HBX_SECRET"],blockers:["preview host uses safe provider stubs"],notes:["Real HBX availability/signature adapter is present in Petshop master."]};}
  async searchHotels(_input:unknown):Promise<LiveSearchHit[]>{return[];}
}
