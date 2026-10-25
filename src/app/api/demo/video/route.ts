import {NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const mediaBase="https://pusbuucyprqbblfginbl.supabase.co/storage/v1/object/public/vista-media/";
async function media(request:Request,method:"GET"|"HEAD"){
 const webm=new URL(request.url).searchParams.get("format")==="webm";
 const upstreamUrl=mediaBase+(webm?"vista-walkthrough.webm":"vista-walkthrough.mp4");
 const range=request.headers.get("range");
 if(range&&!/^bytes=\d*-\d*$/.test(range))return new NextResponse(null,{status:416,headers:{"Cache-Control":"no-store"}});
 try{
  const upstream=await fetch(upstreamUrl,{method,headers:range?{Range:range}:{},signal:AbortSignal.timeout(16000),cache:"no-store",redirect:"error"});
  if(upstream.status!==200&&upstream.status!==206)return NextResponse.json({error:"Demo video currently unavailable."},{status:502,headers:{"Cache-Control":"no-store"}});
  const headers=new Headers({"Content-Type":webm?"video/webm":"video/mp4","Cache-Control":"public, max-age=3600, s-maxage=86400","Content-Disposition":webm?'inline; filename="vista-walkthrough.webm"':'inline; filename="vista-walkthrough.mp4"',"X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes"});
  for(const key of ["content-length","content-range","etag","last-modified"]){const value=upstream.headers.get(key);if(value)headers.set(key,value);}
  return new Response(method==="HEAD"?null:upstream.body,{status:upstream.status,headers});
 }catch{return NextResponse.json({error:"Demo video retrieval failed."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export function GET(request:Request){return media(request,"GET");}
export function HEAD(request:Request){return media(request,"HEAD");}
