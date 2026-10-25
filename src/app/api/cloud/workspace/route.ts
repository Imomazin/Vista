import {NextResponse} from 'next/server';
import {CloudError,authenticated,organisationId,membership,provider,saveCloud} from '@/lib/cloud';
export const dynamic='force-dynamic';
function error(e:unknown){return NextResponse.json({error:e instanceof CloudError?e.message:'Cloud service unavailable.'},{status:e instanceof CloudError?e.status:503,headers:{'Cache-Control':'no-store'}});}
export async function GET(request:Request){try{const {token,user}=await authenticated(request);const id=organisationId(new URL(request.url).searchParams.get('organisationId'));await membership(token,user.id,id);const rows=await provider('/rest/v1/vista_workspaces?select=revision,payload,updated_at&organisation_id=eq.'+id,{},token);return NextResponse.json(rows[0]||{revision:0,payload:null},{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
export async function PUT(request:Request){try{return NextResponse.json(await saveCloud(request),{headers:{'Cache-Control':'no-store'}});}catch(e){return error(e);}}
