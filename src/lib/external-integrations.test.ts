import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,verify} from "node:crypto";
import {assertion,externalStatus,requireProviderOwner,googleWifConfigured,googleWifAudience,exchangeVercelGoogleToken} from "./external-integrations";
test("provider readiness reports missing credentials as disconnected",()=>{
 const r=externalStatus({});
 for(const c of Object.values(r))assert.equal(c.configured,false);
});
test("GSC and GA4 demand both a Google identity and property authorisation target",()=>{
 const base={GOOGLE_SERVICE_ACCOUNT_EMAIL:"service@project.iam.gserviceaccount.com",GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:"fake"};
 const a=externalStatus(base);assert.equal(a.gsc.configured,false);assert.equal(a.ga4.configured,false);
 const b=externalStatus({...base,GOOGLE_SEARCH_CONSOLE_SITE_URL:"sc-domain:example.com",GOOGLE_ANALYTICS_PROPERTY_ID:"12345678"});
 assert.equal(b.gsc.configured,true);assert.equal(b.ga4.configured,true);assert.equal(b.hubspot.configured,false);
});
test("CRM and AI require separate server credentials",()=>{
 const s=externalStatus({HUBSPOT_PRIVATE_APP_TOKEN:"fake",OPENAI_API_KEY:"fake"});
 assert.equal(s.hubspot.configured,true);assert.equal(s.openai.configured,true);assert.equal(s.gsc.configured,false);
});
test("Google JWT uses RS256, audience, restricted scope and exact expiry",()=>{
 const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
 const pem=privateKey.export({type:"pkcs8",format:"pem"}).toString();
 const scope="https://www.googleapis.com/auth/webmasters.readonly";
 const jwt=assertion("bot@example.iam.gserviceaccount.com",pem,scope,1800000000);
 const [h,p,s]=jwt.split(".");
 const header=JSON.parse(Buffer.from(h,"base64url").toString("utf8"));
 const body=JSON.parse(Buffer.from(p,"base64url").toString("utf8"));
 assert.equal(header.alg,"RS256");
 assert.equal(body.aud,"https://oauth2.googleapis.com/token");
 assert.equal(body.scope,scope);
 assert.equal(body.exp-body.iat,3600);
 const v=verify("RSA-SHA256",Buffer.from(h+"."+p),publicKey,Buffer.from(s,"base64url"));
 assert.equal(v,true);
});

test("shared provider access is restricted to the approved organisation owner",()=>{
 const target="5fabaf24-5f9a-42ff-b8d8-1b9cf6177226";
 assert.doesNotThrow(()=>requireProviderOwner(target,"owner",target));
 assert.throws(()=>requireProviderOwner(target,"editor",target),{status:403});
 assert.throws(()=>requireProviderOwner(target,"viewer",target),{status:403});
 assert.throws(()=>requireProviderOwner(target,"owner",undefined),{status:403});
 assert.throws(()=>requireProviderOwner("00000000-0000-4000-8000-000000000000","owner",target),{status:403});
});

test("keyless Vercel federation counts as configured GSC but not GA4 without a property",()=>{
 const config={GOOGLE_SERVICE_ACCOUNT_EMAIL:"vista-readonly-intelligence@vista-intelligence.iam.gserviceaccount.com",GCP_PROJECT_NUMBER:"639180933626",GCP_WORKLOAD_IDENTITY_POOL_ID:"vista-vercel",GCP_WORKLOAD_IDENTITY_PROVIDER_ID:"vercel-production",GOOGLE_SEARCH_CONSOLE_SITE_URL:"https://vista.ambidexters.com/"};
 assert.equal(googleWifConfigured(config),true);
 assert.equal(externalStatus(config).gsc.configured,true);
 assert.equal(externalStatus(config).ga4.configured,false);
 assert.equal(googleWifAudience(config),"//iam.googleapis.com/projects/639180933626/locations/global/workloadIdentityPools/vista-vercel/providers/vercel-production");
});
test("Google keyless authentication performs restricted STS exchange and impersonation",async()=>{
 const config={GOOGLE_SERVICE_ACCOUNT_EMAIL:"vista-readonly-intelligence@vista-intelligence.iam.gserviceaccount.com",GCP_PROJECT_NUMBER:"639180933626",GCP_WORKLOAD_IDENTITY_POOL_ID:"vista-vercel",GCP_WORKLOAD_IDENTITY_PROVIDER_ID:"vercel-production"};
 const previous=globalThis.fetch;
 let requests=0;
 globalThis.fetch=(async(url:string|URL|Request,opts?:RequestInit)=>{
  const uri=String(url);
  requests++;
  if(uri==="https://sts.googleapis.com/v1/token"){
   assert.equal(opts?.method,"POST");
   const body=opts?.body as URLSearchParams;
   assert.equal(body.get("subject_token"),"abc.abc.abc");
   assert.equal(body.get("requested_token_type"),"urn:ietf:params:oauth:token-type:access_token");
   return new Response(JSON.stringify({access_token:"short-lived-sts"}),{status:200});
  }
  if(uri.startsWith("https://iamcredentials.googleapis.com/v1/")){
   const headers=opts?.headers as Record<string,string>;
   assert.equal(headers.Authorization,"Bearer short-lived-sts");
   assert.deepEqual(JSON.parse(String(opts?.body)).scope,["https://www.googleapis.com/auth/webmasters.readonly"]);
   return new Response(JSON.stringify({accessToken:"delegated-readonly-token"}),{status:200});
  }
  throw new Error("Unexpected URL "+uri);
 }) as typeof fetch;
 try{
  assert.equal(await exchangeVercelGoogleToken("abc.abc.abc","https://www.googleapis.com/auth/webmasters.readonly",config),"delegated-readonly-token");
  assert.equal(requests,2);
 }finally{globalThis.fetch=previous;}
});
test("keyless token exchange rejects malformed OIDC, scopes and configuration before fetching",async()=>{
 const config={GOOGLE_SERVICE_ACCOUNT_EMAIL:"vista-readonly-intelligence@vista-intelligence.iam.gserviceaccount.com",GCP_PROJECT_NUMBER:"639180933626",GCP_WORKLOAD_IDENTITY_POOL_ID:"vista-vercel",GCP_WORKLOAD_IDENTITY_PROVIDER_ID:"vercel-production"};
 await assert.rejects(exchangeVercelGoogleToken("bad","https://www.googleapis.com/auth/webmasters.readonly",config));
 await assert.rejects(exchangeVercelGoogleToken("abc.abc.abc","https://www.googleapis.com/auth/cloud-platform",config));
 assert.throws(()=>googleWifAudience({...config,GCP_PROJECT_NUMBER:"bad"}));
});
