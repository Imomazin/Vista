import {NextResponse} from 'next/server';import {CloudError} from '@/lib/cloud';import {requireWorker,runOneAudit} from '@/lib/jobs';
export const dynamic='force-dynamic';export const maxDuration=30;
// Invoke with an authenticated external scheduler after preview validation.
// No recurring production schedule is enabled by this commit.
export async function POST(request:Request){const requestId=crypto.randomUUID();try{requireWorker(request);const result=await runOneAudit();console.info(JSON.stringify({event:'vista.job.worker',requestId,...result}));return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}catch(e){const status=e instanceof CloudError?e.status:503;console.warn(JSON.stringify({event:'vista.job.worker',requestId,status}));return NextResponse.json({error:e instanceof CloudError?e.message:'Worker execution failed.',requestId},{status,headers:{'Cache-Control':'no-store'}});}}
export const GET=POST;
