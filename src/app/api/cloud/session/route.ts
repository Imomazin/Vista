import {requestLimit} from '@/lib/rate-limit';
import {NextResponse} from 'next/server';
import {cloudConfig,CloudError,requireSameOrigin,readJson,provider,authenticated,sessionCookie} from '@/lib/cloud';
export const dynamic='force-dynamic';
function error(e:unknown){return NextResponse.json({error:e instanceof CloudError?e.message:'Cloud service unavailable.'},{status:e instanceof CloudError?e.status:503,headers:{'Cache-Control':'no-store'}});}
export async function GET(request:Request){try{if(!cloudConfig())return NextResponse.json({configured:false,authenticated:false},{headers:{'Cache-Control':'no-store'}});const {token,user}=await authenticated(request);const memberships=await provider('/rest/v1/vista_memberships?select=organisation_id,role,vista_organisations(name)',{},token);return NextResponse.json({configured:true,authenticated:true,email:user.email,memberships},{headers:{'Cache-Control':'no-store'}});}catch(e){if(e instanceof CloudError&&e.status===401)return NextResponse.json({configured:true,authenticated:false},{headers:{'Cache-Control':'no-store'}});return error(e);}}
export async function POST(request:Request){try{requireSameOrigin(request);const body=await readJson(request,4800);if(body.action==='logout'){const response=NextResponse.json({signedOut:true});response.cookies.set(sessionCookie,'',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});return response;}
 const limit=await requestLimit(request,'sign-in',8,600);if(!limit.allowed)throw new CloudError('Sign-in request limit reached. Try again later.',429);
 if(body.action==='accept-link'){
  if(typeof body.accessToken!=='string'||body.accessToken.length<100||body.accessToken.length>4000)throw new CloudError('The email sign-in link is invalid or expired.',401);
  const token=body.accessToken;
  const user=await provider('/auth/v1/user',{},token);
  if(typeof user?.id!=='string'||!user.email_confirmed_at)throw new CloudError('This email address has not been verified.',401);
  const memberships=await provider('/rest/v1/vista_memberships?select=organisation_id&user_id=eq.'+encodeURIComponent(user.id),{},token);
  if(!Array.isArray(memberships)||!memberships.length)throw new CloudError('This account has no VisTa organisation membership.',403);
  const response=NextResponse.json({signedIn:true});
  response.cookies.set(sessionCookie,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:3600});
  return response;
 }
 if(typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email))throw new CloudError('Enter a valid email address.');
 if(body.action==='request-code'){const redirect=new URL('/auth/callback',request.url);await provider('/auth/v1/otp?redirect_to='+encodeURIComponent(redirect.href),{method:'POST',body:JSON.stringify({email:body.email,create_user:false})});return NextResponse.json({message:'If this account is eligible, a sign-in email has been sent. Open its secure link, or enter its six-digit code if one is shown.'});}
 if(body.action!=='verify'||typeof body.code!=='string'||!/^\d{6,10}$/.test(body.code))throw new CloudError('Enter the sign-in code.');
 const session=await provider('/auth/v1/verify',{method:'POST',body:JSON.stringify({email:body.email,token:body.code,type:'email'})});
 if(typeof session?.access_token!=='string'||!session?.user?.email_confirmed_at)throw new CloudError('Sign-in could not be verified.',401);
 const response=NextResponse.json({signedIn:true});response.cookies.set(sessionCookie,session.access_token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:Math.min(3600,Number(session.expires_in)||3600)});return response;
 }catch(e){return error(e);}}
