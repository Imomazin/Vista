import {parseBundle} from './migration';
export class CloudError extends Error { constructor(message:string,public status=400){super(message);} }
export const sessionCookie='__Host-vista-session';
export function cloudConfig(){const url=process.env.VISTA_SUPABASE_URL;const key=process.env.VISTA_SUPABASE_ANON_KEY;if(!url||!key)return null;const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.supabase.co')||u.username||u.password||u.port)throw new CloudError('Cloud configuration needs review.',503);return {url:u.origin,key};}
export function requireSameOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw new CloudError('Request origin is not permitted.',403);}
export async function readJson(request:Request,max=3_000_000){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new CloudError('Use an application/json request.',415);
 if(Number(request.headers.get('content-length'))>max)throw new CloudError('Request is too large.',413);
 const reader=request.body?.getReader();if(!reader)throw new CloudError('Request body required.');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new CloudError('Request is too large.',413);}chunks.push(value);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new CloudError('Invalid JSON request.');}
}
export async function provider(path:string,init:RequestInit={},token?:string){
 const config=cloudConfig();if(!config)throw new CloudError('Cloud workspace is not configured.',503);
 let response:Response;try{response=await fetch(config.url+path,{...init,cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json',...init.headers}});}catch{throw new CloudError('Cloud provider could not be reached. Local work is unchanged.',503);}
 if(!response.ok){if(response.status===429)throw new CloudError('Provider request limit reached. Try again later.',429);if(response.status===409)throw new CloudError('Cloud workspace changed. Reload before saving.',409);if(response.status===401||response.status===403)throw new CloudError('Sign in again or ask your organisation owner for access.',response.status);throw new CloudError('Cloud request failed. Check provider configuration and try again.',502);}
 return response.status===204?null:response.json();
}
export async function authenticated(request:Request){
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
 if(!token||token.length>8000)throw new CloudError('Sign in to access a cloud workspace.',401);
 const user=await provider('/auth/v1/user',{},token);if(typeof user?.id!=='string'||!user.email_confirmed_at)throw new CloudError('A verified account is required.',401);
 return {token,user};
}
export function organisationId(value:unknown){if(typeof value!=='string'||!/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(value))throw new CloudError('Select a valid organisation.');return value;}
export async function membership(token:string,userId:string,id:string,write=false){
 const rows=await provider('/rest/v1/vista_memberships?select=role&organisation_id=eq.'+id+'&user_id=eq.'+encodeURIComponent(userId),{},token);
 if(!rows?.length||(write&&!['owner','editor'].includes(rows[0].role)))throw new CloudError('Your membership does not permit this action.',403);
 return rows[0].role as string;
}
export async function saveCloud(request:Request){
 requireSameOrigin(request);const {token,user}=await authenticated(request);const body=await readJson(request,3_100_000);const id=organisationId(body.organisationId);
 await membership(token,user.id,id,true);if(!Number.isSafeInteger(body.revision)||body.revision<0)throw new CloudError('Invalid revision.');
 let bundle;try{bundle=parseBundle(JSON.stringify(body.bundle));}catch(e){throw new CloudError(e instanceof Error?e.message:'Invalid transfer package.');}
 const path='/rest/v1/vista_workspaces'+(body.revision?'?organisation_id=eq.'+id+'&revision=eq.'+body.revision:'');
 const result=await provider(path,{method:body.revision?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organisation_id:id,revision:body.revision+1,payload:bundle,updated_by:user.id})},token);
 if(!result?.length)throw new CloudError('Cloud workspace changed. Reload before saving.',409);
 return {revision:result[0].revision,updatedAt:result[0].updated_at};
}
