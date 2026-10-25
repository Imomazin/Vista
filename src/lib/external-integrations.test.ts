import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,verify} from "node:crypto";
import {assertion,externalStatus} from "./external-integrations";
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
