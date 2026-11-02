export const sourceDefinitions = [
 {id:'gsc',name:'Google Search Console',purpose:'Search queries, clicks and impressions',next:'Retrieve an authorised search report.'},
 {id:'ga4',name:'Google Analytics',purpose:'Channels, landing pages and key events',next:'Check Realtime or retrieve a dated report.'},
 {id:'hubspot',name:'HubSpot CRM',purpose:'Contact stages and deal observations',next:'Retrieve an authorised CRM sample.'},
 {id:'openai',name:'AI answer sampling',purpose:'Recorded responses, mentions and citations',next:'Run an approved prompt and inspect its sources.'}
] as const;
export type SourceId=typeof sourceDefinitions[number]['id'];
export type Readiness=Record<SourceId,boolean>;
export function parseReadiness(input:unknown):Readiness{
 if(!input||typeof input!=='object'||!('providers' in input))throw Error('Source configuration could not be checked.');
 const providers=input.providers;
 if(!providers||typeof providers!=='object')throw Error('Source configuration could not be checked.');
 const values=sourceDefinitions.map(({id})=>{
  const item=(providers as Record<string,unknown>)[id];
  if(!item||typeof item!=='object'||!('configured' in item)||typeof item.configured!=='boolean')throw Error('Source configuration response is incomplete.');
  return [id,item.configured];
 });
 return Object.fromEntries(values) as Readiness;
}
export function sourcePresentation(configured:boolean|undefined){
 return configured===true?{label:'Credentials configured',action:'Verify access',tone:'configured'}:
 configured===false?{label:'Setup needed',action:'Set up source',tone:'missing'}:
 {label:'Not checked',action:'Open connections',tone:'unknown'};
}
