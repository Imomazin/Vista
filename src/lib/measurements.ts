/** Imported source reports. Never treated as an authenticated provider connection. */
export const measurementKey='vista-measurements';
export type Source='gsc'|'ga4';
export type MeasurementRow={date:string;page:string;query:string;country:string;device:string;channel:string;clicks:number;impressions:number;position:number;sessions:number;keyEvents:number;revenue:number};
export type Dataset={id:string;projectId:string;name:string;source:Source;property:string;sourceUrl:string;start:string;end:string;timezone:string;currency:string;collectedAt:string;importedAt:string;scope:string;limitations:string;rows:MeasurementRow[]};
export type MeasurementBook={version:1;datasets:Dataset[]};
export const emptyMeasurements=():MeasurementBook=>({version:1,datasets:[]});
export function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function text(value:unknown,max=2048):value is string{return typeof value==='string'&&value.length<=max;}
function numeric(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1e15;}
function safeUrl(value:string){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
export function parseMeasurements(raw:string,projects?:string[]):MeasurementBook{
 if(raw.length>2_000_000)throw Error('Measurement register exceeds 2 MB. Export and archive older reports.');
 const book=JSON.parse(raw);if(book?.version!==1||!Array.isArray(book.datasets)||book.datasets.length>24)throw Error('Invalid measurement register; maximum 24 reports.');
 const ids=new Set<string>();let total=0;
 for(const d of book.datasets){
  if(!d||!['id','projectId','name','property','sourceUrl','start','end','timezone','currency','collectedAt','importedAt','scope','limitations'].every(k=>text(d[k]))||!d.id||!d.projectId||!d.name.trim()||!d.property.trim()||!d.scope.trim()||!d.limitations.trim()||ids.has(d.id)||!['gsc','ga4'].includes(d.source)||!safeUrl(d.sourceUrl))throw Error('Report identity, source, scope and limitations are required.');
  if(projects&&!projects.includes(d.projectId))throw Error('Report refers to a missing project.');ids.add(d.id);
  if(!validDate(d.start)||!validDate(d.end)||d.start>d.end||!Number.isFinite(Date.parse(d.collectedAt))||!Number.isFinite(Date.parse(d.importedAt)))throw Error('Invalid report date range or collection time.');
  try{new Intl.DateTimeFormat('en',{timeZone:d.timezone});}catch{throw Error('Use a valid IANA time zone.');}
  if(d.source==='gsc'&&d.timezone!=='America/Los_Angeles')throw Error('Search Console daily dates use America/Los_Angeles.');
  if(d.source==='ga4'&&!/^[A-Z]{3}$/.test(d.currency))throw Error('GA4 reports need a three-letter currency code.');
  if(!Array.isArray(d.rows)||!d.rows.length||d.rows.length>5000||(total+=d.rows.length)>10000)throw Error('Use 1–5,000 rows per report, up to 10,000 across the register.');
  const keys=new Set<string>();
  for(const r of d.rows){
   if(!r||!['date','page','query','country','device','channel'].every(k=>text(r[k]))||!['clicks','impressions','position','sessions','keyEvents','revenue'].every(k=>numeric(r[k]))||!validDate(r.date)||r.date<d.start||r.date>d.end||!(r.page.startsWith('/')||r.page==='(not set)'||safeUrl(r.page)))throw Error('Invalid measurement row, date, page or metric.');
   if(!Number.isInteger(r.clicks)||!Number.isInteger(r.impressions)||!Number.isInteger(r.sessions)||r.clicks>r.impressions||(r.impressions>0&&r.position<1))throw Error('Counts must be whole numbers; clicks cannot exceed impressions; observed position starts at one.');
   if(d.source==='gsc'&&(r.sessions||r.keyEvents||r.revenue||r.channel)||d.source==='ga4'&&(r.clicks||r.impressions||r.position||r.query))throw Error('Metrics from different providers cannot be mixed into one report.');
   const key=JSON.stringify([r.date,r.page,r.query,r.country,r.device,r.channel]);if(keys.has(key))throw Error('Duplicate dimensional row. Remove totals and duplicate rows before import.');keys.add(key);
  }
 }
 return book;
}
/** RFC-style CSV with quoted commas, escaped quotes and multiline fields. */
export function parseCsv(input:string):Record<string,string>[] {
 if(input.length>1_500_000)throw Error('CSV exceeds 1.5 MB.');
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 const finish=()=>{row.push(field);field='';closed=false;};
 for(let i=0;i<input.length;i++){
  const c=input[i];if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('Malformed CSV quoting.');quoted=true;}
  else if(c===','){finish();}else if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;finish();if(row.some(v=>v.trim()))rows.push(row);row=[];}
  else{if(closed)throw Error('Unexpected text after closing CSV quote.');field+=c;}
 }
 if(quoted)throw Error('Unclosed CSV field.');finish();if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length<2||rows.length>5001)throw Error('CSV must contain a header and 1–5,000 data rows.');
 const headers=rows.shift()!.map(v=>v.replace(/^\uFEFF/,'').trim().toLowerCase());if(new Set(headers).size!==headers.length||headers.some(h=>!h||['__proto__','constructor','prototype'].includes(h)))throw Error('CSV headers must be distinct and safe.');
 return rows.map((values,i)=>{if(values.length!==headers.length)throw Error('CSV column mismatch on row '+(i+2)+'.');return Object.fromEntries(headers.map((h,j)=>[h,values[j].trim()]));});
}
export function importCsv(csv:string,meta:Omit<Dataset,'rows'>):Dataset {
 const rows=parseCsv(csv);const required=meta.source==='gsc'?['date','page','clicks','impressions','position']:['date','page','sessions','keyevents','revenue'];
 if(required.some(k=>!(k in rows[0])))throw Error('Required columns: '+required.join(', ')+'. Use daily page-level rows.');
 const allowed=new Set([...required,'country','device',...(meta.source==='gsc'?['query']:['channel'])]);
 if(Object.keys(rows[0]).some(k=>!allowed.has(k)))throw Error('Unsupported column. Use the documented template so metric definitions remain unambiguous.');
 function number(v:string|undefined){if(v===undefined)return 0;if(!/^(?:\d+\.?\d*|\.\d+)$/.test(v))throw Error('Use plain non-negative numeric values without separators or percentages.');return Number(v);}
 const dataset={...meta,rows:rows.map(r=>({date:r.date,page:r.page,query:r.query||'',country:r.country||'',device:r.device||'',channel:r.channel||'',clicks:number(r.clicks),impressions:number(r.impressions),position:number(r.position),sessions:number(r.sessions),keyEvents:number(r.keyevents),revenue:number(r.revenue)}))};
 return parseMeasurements(JSON.stringify({version:1,datasets:[dataset]})).datasets[0];
}
export type Filters={country?:string;device?:string;channel?:string;query?:string;start?:string;end?:string};
export function filterRows(d:Dataset,f:Filters){return d.rows.filter(r=>(!f.country||r.country===f.country)&&(!f.device||r.device===f.device)&&(!f.channel||r.channel===f.channel)&&(!f.query||(r.page+' '+r.query).toLowerCase().includes(f.query.toLowerCase()))&&(!f.start||r.date>=f.start)&&(!f.end||r.date<=f.end));}
export function totals(rows:MeasurementRow[]){const t=rows.reduce((a,r)=>({clicks:a.clicks+r.clicks,impressions:a.impressions+r.impressions,weightedPosition:a.weightedPosition+r.position*r.impressions,sessions:a.sessions+r.sessions,keyEvents:a.keyEvents+r.keyEvents,revenue:a.revenue+r.revenue}),{clicks:0,impressions:0,weightedPosition:0,sessions:0,keyEvents:0,revenue:0});return {...t,ctr:t.impressions?t.clicks/t.impressions:null,position:t.impressions?t.weightedPosition/t.impressions:null,eventsPerSession:t.sessions?t.keyEvents/t.sessions:null};}
export function groupRows(rows:MeasurementRow[],dimension:'page'|'query'|'date'|'country'|'device'|'channel') {const groups=new Map<string,MeasurementRow[]>();for(const r of rows){const key=r[dimension]||'(unspecified)';const group=groups.get(key);if(group)group.push(r);else groups.set(key,[r]);}return [...groups].map(([label,items])=>({label,...totals(items)}));}
export function comparisonProblem(a:Dataset,b:Dataset):string|null{
 if(a.projectId!==b.projectId||a.source!==b.source||a.property!==b.property)return 'Use the same project, provider and property.';
 if(a.timezone!==b.timezone||a.currency!==b.currency||a.scope!==b.scope)return 'Time zone, currency and declared report scope must match.';
 const dimensions=(d:Dataset)=>['query','country','device','channel'].filter(k=>d.rows.some(r=>r[k as keyof MeasurementRow]!=='' )).join(',');
 if(dimensions(a)!==dimensions(b))return 'Both reports need the same dimension breakdown.';
 if(a.start<=b.end&&b.start<=a.end)return 'Comparison periods must not overlap.';
 if(Date.parse(a.end)-Date.parse(a.start)!==Date.parse(b.end)-Date.parse(b.start))return 'Comparison periods must contain the same number of calendar days.';
 return null;
}
export function relativeChange(current:number,previous:number){return previous===0?null:(current-previous)/previous;}
export function measurementOpportunities(d:Dataset,rows:MeasurementRow[]){
 const all=totals(rows);return groupRows(rows,'page').flatMap(r=>{
  if(d.source==='gsc'&&r.impressions>=100&&r.ctr!==null&&all.ctr!==null&&r.ctr<all.ctr&&r.position!==null&&r.position<=20)return [{page:r.label,title:'Review the search proposition',reason:`${r.impressions} imported impressions; ${(r.ctr*100).toFixed(2)}% CTR versus ${(all.ctr*100).toFixed(2)}% for these filtered rows. Impression-weighted position ${r.position.toFixed(1)}.`,priority:r.impressions*(all.ctr-r.ctr),next:'Inspect query intent, title and snippet. Compare a later equivalent period; this is a hypothesis, not predicted uplift.'}];
  if(d.source==='ga4'&&r.sessions>=100&&r.eventsPerSession!==null&&all.eventsPerSession!==null&&r.eventsPerSession<all.eventsPerSession)return [{page:r.label,title:'Investigate landing-page outcomes',reason:`${r.sessions} imported sessions; ${r.eventsPerSession.toFixed(3)} key events/session versus ${all.eventsPerSession.toFixed(3)} for these filtered rows.`,priority:r.sessions*(all.eventsPerSession-r.eventsPerSession),next:'Check event configuration, traffic mix and consent before designing an experiment. Key events/session is not a conversion probability.'}];return [];
 }).sort((a,b)=>b.priority-a.priority).slice(0,20);
}
export function reportMarkdown(d:Dataset,rows:MeasurementRow[]){const t=totals(rows);return [`# VisTa | ${d.name}`,'',`Source: ${d.source.toUpperCase()} user-imported report. Provider authenticity has not been verified.`,`Property: ${d.property}`,`Source link: ${d.sourceUrl}`,`Period: ${d.start} to ${d.end}; time zone: ${d.timezone}; currency: ${d.currency||'not applicable'}`,`Collected: ${d.collectedAt}; imported: ${d.importedAt}`,`Scope: ${d.scope}`,`Limitations: ${d.limitations}`,`Selected rows: ${rows.length} of ${d.rows.length}`,'',...(d.source==='gsc'?[`Clicks: ${t.clicks}`,`Impressions: ${t.impressions}`,`CTR: ${t.ctr===null?'unavailable':(t.ctr*100).toFixed(2)+'%'}`,`Impression-weighted position: ${t.position===null?'unavailable':t.position.toFixed(2)}`]:[`Sessions: ${t.sessions}`,`Key events: ${t.keyEvents}`,`Key events/session: ${t.eventsPerSession===null?'unavailable':t.eventsPerSession.toFixed(3)}`,`Revenue: ${t.revenue} ${d.currency}`]),'','These are aggregates of imported rows, not reconciled provider totals. No causal attribution or automatic outcome verification.'].join('\n');}
