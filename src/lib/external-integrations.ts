import {createSign} from "node:crypto";
import {CloudError} from "./cloud";
export type Source="gsc"|"ga4"|"hubspot"|"openai";
export function requireProviderOwner(organisationId:string,role:string,authorisedOrganisationId:string|undefined){
 if(!authorisedOrganisationId||organisationId!==authorisedOrganisationId)throw new CloudError("This organisation is not authorised to access the shared provider connection.",403);
 if(role!=="owner")throw new CloudError("Only the organisation owner may test shared provider credentials.",403);
}

export function externalStatus(env:Record<string,string|undefined>=process.env){
 const google=Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY||(env.GCP_PROJECT_NUMBER&&env.GCP_WORKLOAD_IDENTITY_POOL_ID&&env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID)));
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
export function googleWifConfigured(env:Record<string,string|undefined>=process.env){
 return Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&env.GCP_PROJECT_NUMBER&&env.GCP_WORKLOAD_IDENTITY_POOL_ID&&env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID);
}
export function googleWifAudience(env:Record<string,string|undefined>=process.env){
 if(!googleWifConfigured(env))throw new CloudError("Google Workload Identity Federation is not configured.",503);
 const n=env.GCP_PROJECT_NUMBER||"",p=env.GCP_WORKLOAD_IDENTITY_POOL_ID||"",d=env.GCP_WORKLOAD_IDENTITY_PROVIDER_ID||"";
 if(!/^\d{5,20}$/.test(n)||!/^[a-z][a-z0-9-]{2,31}$/.test(p)||!/^[a-z][a-z0-9-]{2,31}$/.test(d))throw new CloudError("Invalid Workload Identity Federation configuration.",503);
 return "//iam.googleapis.com/projects/"+n+"/locations/global/workloadIdentityPools/"+p+"/providers/"+d;
}
export async function exchangeVercelGoogleToken(oidcToken:string,scope:string,env:Record<string,string|undefined>=process.env){
 const audience=googleWifAudience(env);
 const email=env.GOOGLE_SERVICE_ACCOUNT_EMAIL||"";
 if(!/^[a-z0-9._-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(email))throw new CloudError("Invalid Google service account email.",503);
 if(!/^[\w.-]+\.[\w.-]+\.[\w.-]+$/.test(oidcToken)||oidcToken.length>10000)throw new CloudError("No valid Vercel OIDC credential in this request.",503);
 if(!["https://www.googleapis.com/auth/webmasters.readonly","https://www.googleapis.com/auth/analytics.readonly"].includes(scope))throw new CloudError("Google scope is not permitted.",403);
 const exchange=await fetch("https://sts.googleapis.com/v1/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},signal:AbortSignal.timeout(12000),cache:"no-store",
  body:new URLSearchParams({audience,grant_type:"urn:ietf:params:oauth:grant-type:token-exchange",
    requested_token_type:"urn:ietf:params:oauth:token-type:access_token",subject_token_type:"urn:ietf:params:oauth:token-type:jwt",
    subject_token:oidcToken,scope:"https://www.googleapis.com/auth/cloud-platform"})});
 if(!exchange.ok)throw new CloudError("Google rejected the Vercel workload identity. Check issuer, audience and production subject.",502);
 const sts=await exchange.json() as {access_token?:string};
 if(!sts.access_token)throw new CloudError("Google did not return a federated access token.",502);
 const grant=await fetch("https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/"+encodeURIComponent(email)+":generateAccessToken",{
 method:"POST",headers:{Authorization:"Bearer "+sts.access_token,"Content-Type":"application/json"},
 body:JSON.stringify({scope:[scope],lifetime:"1800s"}),cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!grant.ok)throw new CloudError("Google service account impersonation denied. Check production identity role and IAM Credentials API.",502);
 const data=await grant.json() as {accessToken?:string};
 if(!data.accessToken)throw new CloudError("Google did not return a delegated access token.",502);
 return data.accessToken;
}
async function googleToken(scope:string,request?:Request){
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
 if(googleWifConfigured()){
  const jwt=request?.headers.get("x-vercel-oidc-token")||"";
  return exchangeVercelGoogleToken(jwt,scope);
 }
 if(!email||!key)throw new CloudError("Google authentication is not configured.",503);
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
export async function googleSearchConsole(request?:Request){
 const site=required(process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL,"GOOGLE_SEARCH_CONSOLE_SITE_URL");
 if(!(site.startsWith("sc-domain:")||/^https:\/\/[^ ]+\/$/.test(site)))throw new CloudError("Invalid Search Console property scope.",503);
 const token=await googleToken("https://www.googleapis.com/auth/webmasters.readonly",request);
 const end=new Date(Date.now()-2*86400000),start=new Date(end.getTime()-27*86400000);
 const period={startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10)};
 const data=await providerJson("https://www.googleapis.com/webmasters/v3/sites/"+encodeURIComponent(site)+"/searchAnalytics/query",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({...period,dimensions:["query"],rowLimit:25})});
 return {source:"Google Search Console API",site,period,observedAt:new Date().toISOString(),rows:(data.rows||[]).map((x:any)=>({query:String(x.keys?.[0]||""),clicks:Number(x.clicks||0),impressions:Number(x.impressions||0),ctr:Number(x.ctr||0),position:Number(x.position||0)})),note:"Property-scoped Google query sample, not a ranking prediction."};
}
export function googleReportOptions(input:Record<string,unknown>={},now=new Date()){
 const view=input.view===undefined?'channels':input.view;
 if(typeof view!=='string'||!['channels','pages','daily','realtime'].includes(view))throw new CloudError('Choose a supported Google Analytics report.');
 const end=new Date(now.getTime()-86400000).toISOString().slice(0,10);
 const start=new Date(now.getTime()-28*86400000).toISOString().slice(0,10);
 const startDate=input.startDate??start,endDate=input.endDate??end;
 const valid=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!valid(startDate)||!valid(endDate)||startDate>endDate||endDate>now.toISOString().slice(0,10)||Date.parse(endDate)-Date.parse(startDate)>365*86400000)throw new CloudError('Choose valid dates in order, up to 366 days, ending no later than today.');
 return {view:String(view),startDate,endDate};
}
export async function googleAnalytics(request?:Request,input:Record<string,unknown>={}){
 const options=googleReportOptions(input);
 const property=required(process.env.GOOGLE_ANALYTICS_PROPERTY_ID,"GOOGLE_ANALYTICS_PROPERTY_ID");
 if(!/^\d{4,25}$/.test(property))throw new CloudError("Invalid GA4 property identifier.",503);
 const token=await googleToken("https://www.googleapis.com/auth/analytics.readonly",request);
 const realtime=options.view==='realtime';
 const dimension=realtime?'eventName':options.view==='pages'?'landingPage':options.view==='daily'?'date':'sessionDefaultChannelGroup';
 const metrics=realtime?['eventCount','activeUsers']:['sessions','totalUsers','keyEvents'];
 const body={...(!realtime?{dateRanges:[{startDate:options.startDate,endDate:options.endDate}]}:{}),dimensions:[{name:dimension}],metrics:metrics.map(name=>({name})),limit:100,orderBys:options.view==='daily'?[{dimension:{dimensionName:'date'}}]:[{metric:{metricName:metrics[0]},desc:true}]};
 const data=await providerJson("https://analyticsdata.googleapis.com/v1beta/properties/"+property+(realtime?":runRealtimeReport":":runReport"),{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(body)});
 if(!data||typeof data!=='object'||(data.rows!==undefined&&!Array.isArray(data.rows)))throw new CloudError('Provider returned an invalid report.',502);
 const rows=(data.rows||[]).map((x:any)=>({label:String(x?.dimensionValues?.[0]?.value||''),...Object.fromEntries(metrics.map((metric,index)=>{
  const value=x?.metricValues?.[index]?.value;
  return [metric,typeof value==='string'&&value.trim()!==''?Number(value):NaN];
 }))}));
 if(rows.some((row:Record<string,unknown>)=>metrics.some(m=>!Number.isFinite(row[m])||Number(row[m])<0)))throw new CloudError('Provider returned invalid metrics.',502);
 return {source:"GA4 Analytics Data API",property,observedAt:new Date().toISOString(),view:options.view,dimension,metrics,
 period:realtime?null:{startDate:options.startDate,endDate:options.endDate},scope:realtime?'Realtime event observations, last 30 minutes':dimension,
 timezone:data.metadata?.timeZone||null,metadata:data.metadata||{},rows,rowCount:data.rowCount??rows.length,
 truncated:typeof data.rowCount==='number'&&data.rowCount>rows.length,
 note:'Up to 100 rows. Users can appear in multiple rows and must not be summed. An empty response verifies access, not event collection. Realtime observations do not verify consent implementation.'};
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
