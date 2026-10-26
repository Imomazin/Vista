import {NextResponse} from 'next/server';
import {authenticated,CloudError,membership,organisationId,provider,requireSameOrigin,readJson} from '@/lib/cloud';
export const dynamic='force-dynamic';
function response(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
function error(e:unknown){return response({error:e instanceof CloudError?e.message:'Saved reports could not be reached.'},e instanceof CloudError?e.status:503);}
export async function GET(request:Request){try{
 const {token,user}=await authenticated(request),org=organisationId(new URL(request.url).searchParams.get('organisationId'));
 await membership(token,user.id,org);
 const rows=await provider('/rest/v1/vista_google_reports?select=id,organisation_id,report,created_at&organisation_id=eq.'+org+'&order=created_at.desc&limit=30',{},token);
 return response({reports:rows.map((row:{id:string;organisation_id:string;report:unknown})=>({id:row.id,organisationId:row.organisation_id,report:row.report})),note:'Most recent 30 cloud reports. Export before removing a report.'});
 }catch(e){return error(e);}}
export async function DELETE(request:Request){try{
 requireSameOrigin(request);const {token,user}=await authenticated(request),input=await readJson(request,1000),org=organisationId(input.organisationId),id=organisationId(input.id);
 if(await membership(token,user.id,org)!=='owner')throw new CloudError('Only an organisation owner can remove cloud reports.',403);
 const rows=await provider('/rest/v1/vista_google_reports?organisation_id=eq.'+org+'&id=eq.'+id,{method:'DELETE',headers:{Prefer:'return=representation'}},token);
 if(!rows.length)throw new CloudError('Report was not found in this organisation.',404);
 return response({deleted:true});
 }catch(e){return error(e);}}
