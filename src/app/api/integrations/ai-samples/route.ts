import {NextResponse} from "next/server";
import {authenticated,CloudError,organisationId,membership,provider} from "@/lib/cloud";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{
  const {token,user}=await authenticated(request);
  const id=organisationId(new URL(request.url).searchParams.get("organisationId"));
  await membership(token,user.id,id);
  const rows=await provider("/rest/v1/vista_ai_samples?select=id,provider,model,brand,prompt,response,citations,mentioned,observed_at&organisation_id=eq."+id+"&order=observed_at.desc&limit=40",{},token);
  return NextResponse.json({samples:rows},{headers:{"Cache-Control":"no-store"}});
 }catch(e){
  const status=e instanceof CloudError?e.status:503;
  return NextResponse.json({error:e instanceof CloudError?e.message:"AI sample history unavailable."},{status,headers:{"Cache-Control":"no-store"}});
 }
}
