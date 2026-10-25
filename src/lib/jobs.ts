import {timingSafeEqual} from 'node:crypto';
import {CloudError,cloudConfig,provider} from './cloud';
import {fetchPublicHtml} from './safe-fetch';import {analyseHtml} from './audit';
export function jobsConfigured(){return Boolean(cloudConfig()&&process.env.VISTA_JOB_WORKER_KEY&&process.env.CRON_SECRET&&process.env.CRON_SECRET.length>=32);}
export function requireWorker(request:Request){const secret=process.env.CRON_SECRET;if(!secret||secret.length<32)throw new CloudError('Job worker is not configured.',503);const supplied=Buffer.from(request.headers.get('authorization')||'');const expected=Buffer.from('Bearer '+secret);if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))throw new CloudError('Worker authorization required.',401);if(!jobsConfigured())throw new CloudError('Job worker is not configured.',503);}
export async function runOneAudit(){
 const token=process.env.VISTA_JOB_WORKER_KEY!;
 const jobs=await provider('/rest/v1/rpc/vista_claim_audit',{method:'POST',body:'{}'},token);
 const job=jobs?.[0];if(!job)return {state:'idle'};
 let output=null,failure=null;
 try{if(typeof job.url!=='string'||job.url.length>2048)throw Error();const page=await fetchPublicHtml(job.url);output={report:analyseHtml(page.url,page.html,page.robots),requestedUrl:job.url,collectedAt:new Date().toISOString(),provenance:'public-html',limitations:'Retrieved HTML only; does not verify rendered content, ranking, indexing, speed or AI visibility.'};}
 catch{failure='Public page inspection failed. Check the target URL and source availability.';}
 const accepted=await provider('/rest/v1/rpc/vista_finish_audit',{method:'POST',body:JSON.stringify({job:job.id,fence:job.lease_token,output,failure})},token);
 return {state:accepted?(failure?'retry-or-failed':'succeeded'):'lease-expired-or-cancelled',jobId:job.id};
}
