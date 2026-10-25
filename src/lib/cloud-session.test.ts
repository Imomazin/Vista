import test from 'node:test';
import assert from 'node:assert/strict';
import {POST,GET} from '../app/api/cloud/session/route';

const base='https://vista.example/api/cloud/session';
const token='a'.repeat(250);
const id='5fabaf24-5f9a-42ff-b8d8-1b9cf6177226';
function request(body:unknown){
 return new Request(base,{method:'POST',headers:{origin:'https://vista.example','Content-Type':'application/json','x-real-ip':crypto.randomUUID()},body:JSON.stringify(body)});
}
async function mockProvider<T>(responses:(url:URL)=>unknown,run:()=>Promise<T>):Promise<T>{
 const previous=globalThis.fetch;
 const url=process.env.VISTA_SUPABASE_URL,key=process.env.VISTA_SUPABASE_ANON_KEY;
 process.env.VISTA_SUPABASE_URL='https://vistatest.supabase.co';
 process.env.VISTA_SUPABASE_ANON_KEY='sb_publishable_test';
 globalThis.fetch=(async(input:RequestInfo|URL)=>{
  const requested=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const result=responses(requested);
  if(result===undefined)return new Response('Not found',{status:404});
  return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});
 }) as typeof fetch;
 try{return await run();}
 finally{globalThis.fetch=previous;if(url===undefined)delete process.env.VISTA_SUPABASE_URL;else process.env.VISTA_SUPABASE_URL=url;
 if(key===undefined)delete process.env.VISTA_SUPABASE_ANON_KEY;else process.env.VISTA_SUPABASE_ANON_KEY=key;}
}
test('Supabase email request targets this deployment callback instead of localhost',async()=>{
 await mockProvider(url=>url.pathname==='/auth/v1/otp'?{}:undefined,async()=>{
  const response=await POST(request({action:'request-code',email:'owner@example.com'}));
  assert.equal(response.status,200);
  assert.match((await response.json()).message,/link/i);
 });
 await mockProvider(url=>{
  if(url.pathname==='/auth/v1/otp'){
   assert.equal(url.searchParams.get('redirect_to'),'https://vista.example/auth/callback');
   return {};
  }
 },async()=>{
  const response=await POST(request({action:'request-code',email:'owner@example.com'}));
  assert.equal(response.status,200);
 });
});
test('magic link needs a validated account and organisation membership',async()=>{
 await mockProvider(url=>{
  if(url.pathname==='/auth/v1/user')return {id:'00000000-0000-0000-0000-000000000001',email:'owner@example.com',email_confirmed_at:'2026-10-25T10:00:00Z'};
  if(url.pathname==='/rest/v1/vista_memberships')return [];
 },async()=>{
  const response=await POST(request({action:'accept-link',accessToken:token}));
  assert.equal(response.status,403);
  assert.equal(response.headers.get('set-cookie'),null);
 });
});
test('verified owner magic link becomes HttpOnly session and is readable via cloud endpoint',async()=>{
 await mockProvider(url=>{
  if(url.pathname==='/auth/v1/user')return {id:'00000000-0000-0000-0000-000000000001',email:'owner@example.com',email_confirmed_at:'2026-10-25T10:00:00Z'};
  if(url.pathname==='/rest/v1/vista_memberships')return [{organisation_id:id,role:'owner',vista_organisations:{name:'Ambidexters'}}];
 },async()=>{
  const response=await POST(request({action:'accept-link',accessToken:token}));
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie')||'';
  assert.match(cookie,/__Host-vista-session=/);
  assert.match(cookie,/HttpOnly/);
  assert.match(cookie,/Secure/);
  assert.match(cookie,/SameSite=strict/i);
  assert.equal((await response.json()).signedIn,true);
  const session=await GET(new Request(base,{headers:{cookie:'__Host-vista-session='+token}}));
  const result=await session.json();
  assert.equal(result.authenticated,true);
  assert.equal(result.memberships[0].role,'owner');
 });
});
test('missing and malformed magic-link tokens are rejected',async()=>{
 await mockProvider(()=>undefined,async()=>{
  assert.equal((await POST(request({action:'accept-link',accessToken:''}))).status,401);
  assert.equal((await POST(request({action:'accept-link',accessToken:'a'.repeat(4100)}))).status,401);
 });
});
