import {NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {openAiSample} from "@/lib/external-integrations";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
function secured(request:Request){
 const secret=process.env.CRON_SECRET,auth=request.headers.get("authorization")||"";
 if(!secret||secret.length<32||!auth.startsWith("Bearer "))return false;
 const supplied=auth.slice(7);
 return supplied.length===secret.length&&timingSafeEqual(Buffer.from(supplied),Buffer.from(secret));
}
async function run(request:Request){
 if(!secured(request))return NextResponse.json({error:"Scheduled sampling authorisation required."},{status:401});
 const required=["VISTA_SUPABASE_URL","VISTA_SUPABASE_SERVICE_ROLE_KEY","VISTA_AI_SAMPLING_ORGANISATION_ID","VISTA_AI_SAMPLING_BRAND","VISTA_AI_SAMPLING_PROMPTS","OPENAI_API_KEY"] as const;
 if(required.some(name=>!process.env[name]))return NextResponse.json({error:"Scheduled sampling configuration incomplete."},{status:503});
 const base=process.env.VISTA_SUPABASE_URL||"",key=process.env.VISTA_SUPABASE_SERVICE_ROLE_KEY||"",org=process.env.VISTA_AI_SAMPLING_ORGANISATION_ID||"";
 const site=new URL(base);
 if(site.protocol!=="https:"||!site.hostname.endsWith(".supabase.co")||site.pathname!=="/"||site.username||site.password||site.port)return NextResponse.json({error:"Invalid datastore host."},{status:503});
 if(!/^[a-f0-9-]{36}$/i.test(org))return NextResponse.json({error:"Invalid organisation ID."},{status:503});
 let prompts:unknown;
 try{prompts=JSON.parse(process.env.VISTA_AI_SAMPLING_PROMPTS||"");}catch{return NextResponse.json({error:"Invalid sampling prompts configuration."},{status:503});}
 if(!Array.isArray(prompts)||prompts.length<1||prompts.length>3||!prompts.every(x=>typeof x==="string"&&x.length>=12&&x.length<=900))return NextResponse.json({error:"Configure one to three bounded prompts."},{status:503});
 const brand=process.env.VISTA_AI_SAMPLING_BRAND||"";
 if(brand.length<2||brand.length>100)return NextResponse.json({error:"Invalid brand configuration."},{status:503});
 const summary:{promptIndex:number;stored:boolean;error?:string}[]=[];
 for(let i=0;i<prompts.length;i++){
  try{
   const result=await openAiSample(brand,String(prompts[i]));
   const data={organisation_id:org,provider:"openai",model:result.model,brand,prompt:String(prompts[i]),response:result.response,citations:result.citations,mentioned:result.mentioned,observed_at:result.observedAt};
   const response=await fetch(site.origin+"/rest/v1/vista_ai_samples",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},cache:"no-store",signal:AbortSignal.timeout(10000),body:JSON.stringify(data)});
   if(!response.ok)throw new Error("Storage rejected sample: HTTP "+response.status);
   summary.push({promptIndex:i,stored:true});
  }catch(e){summary.push({promptIndex:i,stored:false,error:e instanceof Error?e.message:"Provider or storage failed."});}
 }
 const total=summary.filter(x=>x.stored).length;
 console.info(JSON.stringify({event:"vista.sampling.daily",attempts:summary.length,stored:total}));
 return NextResponse.json({ranAt:new Date().toISOString(),attempted:summary.length,stored:total,summary},{status:total===summary.length?200:total>0?207:503,headers:{"Cache-Control":"no-store"}});
}
export const GET=run;
export const POST=run;
