export type GoogleReport={source:string;property?:string;site?:string;view?:string;observedAt:string;period?:{startDate:string;endDate:string}|null;rows:Record<string,string|number>[];metadata?:{subjectToThresholding?:boolean;dataLossFromOtherRow?:boolean;samplingMetadatas?:unknown[]};truncated?:boolean;rowCount?:number;note?:string};
export type SavedReport={id:string;organisationId:string;report:GoogleReport};
export const historyKey='vista-google-report-history-v1';
export function parseHistory(raw:string):SavedReport[]{
 if(raw.length>2_000_000)throw Error('Report history exceeds the storage limit.');
 const records=JSON.parse(raw);
 if(!Array.isArray(records)||records.length>30)throw Error('Invalid report history.');
 const ids=new Set<string>();
 for(const entry of records){
  const r=entry?.report;
  if(!entry||typeof entry.id!=='string'||ids.has(entry.id)||typeof entry.organisationId!=='string'||!entry.organisationId||!r||!['Google Search Console API','GA4 Analytics Data API'].includes(r.source)||!Number.isFinite(Date.parse(r.observedAt))||!Array.isArray(r.rows)||r.rows.length>100)throw Error('Invalid saved report.');
  ids.add(entry.id);
  if(r.source==='GA4 Analytics Data API'&&(typeof r.property!=='string'||!['channels','pages','daily','realtime'].includes(r.view)))throw Error('Invalid analytics scope.');
  if(r.source==='Google Search Console API'&&typeof r.site!=='string')throw Error('Invalid search scope.');
  if(r.view!=='realtime'&&(!r.period||!/^\d{4}-\d{2}-\d{2}$/.test(r.period.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(r.period.endDate)||!Number.isFinite(Date.parse(r.period.startDate))||!Number.isFinite(Date.parse(r.period.endDate))||r.period.startDate>r.period.endDate))throw Error('Invalid saved reporting period.');
  for(const row of r.rows)if(!row||Array.isArray(row)||typeof row!=='object'||Object.keys(row).length>12||Object.entries(row).some(([k,v])=>['__proto__','constructor','prototype'].includes(k)||!(typeof v==='string'&&v.length<=3000||typeof v==='number'&&Number.isFinite(v)&&v>=0)))throw Error('Invalid saved report row.');
 }
 return records;
}
export function comparisonIssue(a:SavedReport,b:SavedReport):string|null{
 const x=a.report,y=b.report;
 if(a.organisationId!==b.organisationId||x.source!==y.source||x.property!==y.property||x.site!==y.site||x.view!==y.view)return 'Choose reports from the same organisation, property and report view.';
 if(x.view==='realtime')return 'Realtime observations are not comparable reporting periods.';
 if(x.view==='daily')return 'Daily trend comparison needs aligned dates. Choose channel or landing-page reports.';
 if(!x.rows.length||!y.rows.length)return 'Empty reports provide no measured baseline for comparison.';
 if([x,y].some(r=>r.metadata?.subjectToThresholding||r.metadata?.dataLossFromOtherRow||r.metadata?.samplingMetadatas?.length))return 'Thresholded, grouped or sampled reports need additional review before comparison.';
 if(x.truncated||y.truncated||x.source==='Google Search Console API')return 'Sampled or partial reports cannot establish comparable complete coverage.';
 if(!x.period||!y.period)return 'Both reports need explicit reporting periods.';
 const days=(p:{startDate:string;endDate:string})=>Date.parse(p.endDate)-Date.parse(p.startDate);
 if(days(x.period)!==days(y.period))return 'Choose reporting periods of equal length.';
 if(x.period.startDate<=y.period.endDate&&y.period.startDate<=x.period.endDate)return 'Choose non-overlapping reporting periods.';
 return null;
}
export function compareReports(current:SavedReport,baseline:SavedReport){
 const problem=comparisonIssue(current,baseline);if(problem)throw Error(problem);
 const previous=new Map(baseline.report.rows.map(r=>[String(r.label),r]));
 return current.report.rows.flatMap(row=>{
  const old=previous.get(String(row.label));if(!old)return [];
  return ['sessions','totalUsers','keyEvents'].flatMap(metric=>typeof row[metric]==='number'&&typeof old[metric]==='number'?[{label:String(row.label),metric,current:row[metric],baseline:old[metric],change:old[metric]===0?null:(row[metric]-old[metric])/old[metric]*100}]:[]);
 });
}
