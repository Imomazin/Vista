import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {googleSearchConsole} from "@/lib/external-integrations";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
export async function GET(request:Request){
 const expected=process.env.VISTA_GOOGLE_SMOKE_SECRET||"";
 const supplied=request.headers.get("x-vista-smoke-secret")||"";
 if(expected.length<48||expected.length!==supplied.length||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))){
  return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
 }
 try{
  const report=await googleSearchConsole(request);
  return NextResponse.json({ok:true,property:report.site,reportWindow:report.period,observedAt:report.observedAt,rowCount:report.rows.length},{headers:{"Cache-Control":"no-store"}});
 }catch(error){
  console.error(JSON.stringify({event:"vista.gsc.federation.test.failed",kind:error instanceof Error?error.constructor.name:"unknown"}));
  return NextResponse.json({ok:false,error:error instanceof Error?error.message:"Google connection test failed."},{status:503,headers:{"Cache-Control":"no-store"}});
 }
}
