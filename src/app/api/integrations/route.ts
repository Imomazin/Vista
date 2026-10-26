import {NextResponse} from "next/server";
import {authenticated,CloudError,membership,organisationId,readJson,requireSameOrigin} from "@/lib/cloud";
import {requestLimit} from "@/lib/rate-limit";
import {externalStatus,googleSearchConsole,googleAnalytics,hubspotCrm,openAiSample,requireProviderOwner,type Source} from "@/lib/external-integrations";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
function respondError(e:unknown){
 const status=e instanceof CloudError?e.status:503;
 const msg=e instanceof CloudError?e.message:"External connection could not be reached; no data has been saved.";
 return NextResponse.json({error:msg},{status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(){
 return NextResponse.json({providers:externalStatus(),note:"Configured means credentials exist, not necessarily authorised or live. Run a permissioned test to verify."},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 try{
  requireSameOrigin(request);
  const limit=await requestLimit(request,"external-source",5,3600);
  if(!limit.allowed)throw new CloudError("Connection testing limit reached. Try later.",429);
  const {token,user}=await authenticated(request);
  const input=await readJson(request,3000);
  const org=organisationId(input.organisationId);
  const role=await membership(token,user.id,org);
  requireProviderOwner(org,role,process.env.VISTA_PROVIDER_ORGANISATION_ID);
  const source=input.source as Source;
  const available=externalStatus();
  if(!["gsc","ga4","hubspot","openai"].includes(source))throw new CloudError("Choose a supported provider.");
  if(!available[source].configured)throw new CloudError("Provider has no server credentials configured.",503);
  let result:unknown;
  if(source==="gsc")result=await googleSearchConsole(request);
  else if(source==="ga4")result=await googleAnalytics(request,input);
  else if(source==="hubspot")result=await hubspotCrm();
  else if(source==="openai")result=await openAiSample(String(input.brand||""),String(input.prompt||""));
  console.info(JSON.stringify({event:"vista.connector.success",source,organisationId:org,at:new Date().toISOString()}));
  return NextResponse.json({connected:true,source,result},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return respondError(e);}
}
