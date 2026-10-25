import {createHmac,randomBytes} from 'node:crypto';
import {CloudError} from './cloud';
const localSecret=randomBytes(32).toString('hex');
const counters=new Map<string,{count:number;until:number}>();
export function localLimit(key:string,limit:number,windowMs:number,now=Date.now()){
 for(const [k,v] of counters)if(v.until<=now)counters.delete(k);
 const old=counters.get(key);if(!old&&counters.size>=5000)throw new CloudError('Request capacity reached. Try again later.',429);
 const entry=old||{count:0,until:now+windowMs};entry.count++;counters.set(key,entry);return {allowed:entry.count<=limit,retryAfter:Math.max(1,Math.ceil((entry.until-now)/1000)),mode:'process-local' as const};
}
export function redisConfig(){const url=process.env.VISTA_RATE_LIMIT_URL,token=process.env.VISTA_RATE_LIMIT_TOKEN,salt=process.env.VISTA_RATE_LIMIT_SALT;if(!url&&!token&&!salt)return null;if(!url||!token||!salt||salt.length<32)throw new CloudError('Request protection configuration is incomplete.',503);const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.upstash.io')||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash)throw new CloudError('Request protection configuration needs review.',503);return {url:u.origin,token,salt};}
/** One atomic counter + expiry. No raw IP or email stored in the provider. */
export async function requestLimit(request:Request,scope:string,limit=10,windowSeconds=600,fetcher:typeof fetch=fetch){
 const config=redisConfig();const ip=request.headers.get('x-real-ip')||'shared-unknown-client';const digest=createHmac('sha256',config?.salt||localSecret).update(scope+'\0'+ip).digest('hex');const key='vista:limit:'+scope+':'+digest;
 if(!config)return localLimit(key,limit,windowSeconds*1000);
 const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return {n,redis.call('TTL',KEYS[1])}";
 try{const response=await fetcher(config.url,{method:'POST',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1',key,String(windowSeconds)]),signal:AbortSignal.timeout(3000),cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(data.error||!Array.isArray(data.result)||!data.result.every((n:unknown)=>typeof n==='number')||data.result[1]<0)throw Error();return {allowed:data.result[0]<=limit,retryAfter:Math.max(1,data.result[1]),mode:'durable' as const};}catch{throw new CloudError('Request protection is temporarily unavailable. Try again later.',503);}
}
