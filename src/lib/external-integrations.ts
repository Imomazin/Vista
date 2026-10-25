import {createSign} from "node:crypto";
import {CloudError} from "./cloud";
export type Source="gsc"|"ga4"|"hubspot"|"openai";
export function externalStatus(env:NodeJS.ProcessEnv=process.env){
 const google=Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
 return {
  gsc:{configured:google&&Boolean(env.GOOGLE_SEARCH_CONSOLE_SITE_URL),method:"Google service account with Search Console property access"},
  ga4:{configured:google&&Boolean(env.GOOGLE_ANALYTICS_PROPERTY_ID),method:"Google service account with GA4 Viewer property access"},
  hubspot:{configured:Boolean(env.HUBSPOT_PRIVATE_APP_TOKEN),method:"HubSpot private app token with CRM read scopes"},
  openai:{configured:Boolean(env.OPENAI_API_KEY),method:"OpenAI API key and budget"},
 };
}
export function assertion(email:string,privateKey:string,scope:string,iat:number){
 const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const header=encode({alg:"RS256",typ:"JWT"});
 const payload=encode({iss:email,scope,aud:"https://oauth2.googleapis.com/token",iat,exp:iat+3600});
 const text=header+"."+payload;
 const sign=createSign("RSA-SHA256");sign.update(text);sign.end();
 return text+"."+sign.sign(privateKey.replace(/\\n/g,"\n")).toString("base64url");
}
async function googleToken(scope:string){
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
 if(!email||!key)throw new CloudError("Google credentials not configured.",503);
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",signal:AbortSignal.timeout(12000),headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:assertion(email,key,scope,Math.floor(Date.now()/1000))})});
 if(!response.ok)throw new CloudError("Google authorisation failed. Verify property permissions.",502);
 const data=await response.json();if(typeof data.access_token!=="string")throw new CloudError("Google token missing.",502);
 return data.access_token as string;
}
async function providerJson(url:string,init:RequestInit){
 const res=await fetch(url,{...init,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000)});
 if(!res.ok)throw new CloudError("Provider returned HTTP "+res.status+". Check access, rate limits and configuration.",res.status===429?429:502);
 if(Number(res.headers.get("content-length")||0)>230000)throw new CloudError("Provider payload too large.",502);
 const raw=await res.text();if(raw.length>230000)throw new CloudError("Provider payload too large.",502);
 try{return JSON.parse(raw);}catch{throw new CloudError("Provider returned invalid JSON.",502);}
}
function required(s:string|undefined,label:string){if(!s)throw new CloudError("Configure "+label+" in the deployment environment.",503);return s;}
export async function googleSearchConsole(){
 const site=required(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL,"GOOGLE_SEARCH_CONSOLE_SITE_URL");
 if(!(site.startsWith("sc-domain:")||/^https:\/\/[^ ]+\/$/.test(site)))throw new CloudError("Invalid Search Console property scope.",503);
 const token=await googleToken("https://www.googleapis.com/auth/webmasters.readonly");
 const end=new Date(Date.now()-2*86400000),start=new Date(end.getTime()-27*86400000);
 const period={startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
 const data=await providerJson("https://www.googleapis.com/webmasters/v3/sites/"+encodeURIComponent(site)+"/searchAnalytics/query",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({...period,dimensions:["query"],rowLimit:25})});
 return {source:"Google Search Console API",site,period,observedAt:new Date().toISOString(),rows:(data.rows||[]).map((x:any)=>({query:String(x.keys?.[0]||""),clicks:Number(x.clicks||0),impressions:Number(x.impressions||0),ctr:Number(x.ctr||0),position:Number(x.position||0)})),note:"Property-scoped Google query sample, not a ranking prediction."};
}
export async function googleAnalytics(){
 const property=required(process.env.GOOGLE_ANALYTICS_PROPERTY_ID,"GOOGLE_ANALYTICS_PROPERTY_ID");
 if(!/^\d{4,25}$/.test(property))throw new CloudError("Invalid GA4 property identifier.",503);
 const token=await googleToken("https://www.googleapis.com/auth/analytics.readonly");
 const data=await providerJson("https://analyticsdata.googleapis.com/v1beta/properties/"+property+":runReport",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({dateRanges:[{startDate:"28daysAgo",endDate:"yesterday"}],dimensions:[{name:"sessionDefaultChannelGroup"}],metrics:[{name:"sessions"},{name:"totalUsers"},{name:"keyEvents"}],limit:25})});
 return {source:"GA4 Analytics Data API",property,observedAt:new Date().toISOString(),scope:"Last 28 days, sessionDefaultChannelGroup",rows:(data.rows||[]).map((x:any)=>({channel:String(x.dimensionValues?.[0]?.value||""),sessions:Number(x.metricValues?.[0]?.value||0),users:Number(x.metricValues?.[1]?.value||0),keyEvents:Number(x.metricValues?.[2]?.value||0)}))};
}
export async function hubspotCrm(){
 const token=required(process.env.HUBSPOT_PRIVATE_APP_TOKEN,"HUBSPOT_PRIVATE_APP_TOKEN");
 const headers={Authorization:"Bearer "+token};
 const [contacts,deals]=await Promise.all([
  providerJson("https://api.hubapi.com/crm/v3/objects/contacts?limit=20&properties=createdate,lifecyclestage",{headers}),
  providerJson("https://api.hubapi.com/crm/v3/objects/deals?limit=20&properties=dealname,dealstage,amount,closedate",{headers})
 ]);
 return {source:"HubSpot CRM API",observedAt:new Date().toISOString(),scope:"Up to 20 recent contacts and deals; not a full CRM total",
  contacts:(contacts.results||[]).map((x:any)=>({id:String(x.id),createdAt:x.properties?.createdate||null,stage:x.properties?.lifecyclestage||null})),
  deals:(deals.results||[]).map((x:any)=>({id:String(x.id),name:x.properties?.dealname||null,stage:x.properties?.dealstage||null,amount:x.properties?.amount||null,closeDate:x.properties?.closedate||null}))};
}
export async function openAiSample(brand:string,prompt:string){
 const key=required(process.env.OPENAI_API_KEY,"OPENAI_API_KEY");
 if(typeof brand!=="string"||typeof prompt!=="string"||brand.trim().length<2||brand.length>100||prompt.trim().length<12||prompt.length>900)throw new CloudError("Enter a brand and a specific question (12–900 characters).");
 const model=process.env.OPENAI_SAMPLING_MODEL||"gpt-4.1-mini";
 if(!/^[\w.-]{2,80}$/.test(model))throw new CloudError("Invalid model configuration.",503);
 const data=await providerJson("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model,input:prompt,max_output_tokens:650,store:false})});
 const blocks=(data.output||[]).flatMap((x:any)=>x.content||[]);
 const response=blocks.filter((x:any)=>x.type==="output_text").map((x:any)=>String(x.text||"")).join("\n").slice(0,12000);
 if(!response)throw new CloudError("AI provider returned no answer text.",502);
 const citations=blocks.flatMap((x:any)=>x.annotations||[]).filter((x:any)=>x.type==="url_citation"&&typeof x.url==="string").map((x:any)=>({url:x.url,title:x.title||""}));
 return {source:"OpenAI Responses API",provider:"openai",model,brand,prompt,response,citations,mentioned:response.toLocaleLowerCase().includes(brand.toLocaleLowerCase()),observedAt:new Date().toISOString(),scope:"One source-labelled model answer; not a representative ranking or visibility score."};
}
