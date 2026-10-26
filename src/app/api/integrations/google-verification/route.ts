import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {googleAnalytics,googleSearchConsole} from "@/lib/external-integrations";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
// Temporary production verification route. Revoke after one-time provider tests.
export async function GET(request:Request){
 const secret=process.env.VISTA_GOOGLE_SMOKE_SECRET||"";
 const supplied=request.headers.get("x-vista-google-smoke")||"";
 if(secret.length<32||secret.length!==supplied.length||!timingSafeEqual(Buffer.from(secret),Buffer.from(supplied))){
  return NextResponse.json({error:"Not authorised"},{status:401,headers:{"Cache-Control":"no-store"}});
 }
 const result:Record<string,unknown>={};
 for(const [provider,run] of [["gsc",googleSearchConsole],["ga4",googleAnalytics]] as const){
  try{
   const data=await run(request);
   result[provider]={authenticated:true,observedAt:data.observedAt,rows:data.rows.length,source:data.source};
  }catch(e){
   // Do not return API credentials, raw source records or upstream response bodies.
   result[provider]={authenticated:false,error:e instanceof Error?e.message.slice(0,160):"Unknown provider error"};
  }
 }
 return NextResponse.json({result,testedAt:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}});
}
