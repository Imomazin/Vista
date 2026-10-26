'use client';
import {useEffect,useState} from 'react';
import {compareReports,comparisonIssue,historyKey,parseHistory,type SavedReport,type GoogleReport} from '@/lib/provider-history';
export default function ProviderHistory({organisationId,results}:{organisationId:string;results:Record<string,unknown>}){
 const [records,setRecords]=useState<SavedReport[]>([]),[current,setCurrent]=useState(''),[baseline,setBaseline]=useState(''),[message,setMessage]=useState('');
 function load(){try{setRecords(parseHistory(localStorage.getItem(historyKey)||'[]'));}catch{setRecords([]);setMessage('Saved history cannot be read. Export browser storage before recovery; existing records have not been overwritten.');}}
 useEffect(()=>{load();window.addEventListener('storage',load);return()=>window.removeEventListener('storage',load);},[]);
 useEffect(()=>{setCurrent('');setBaseline('');setMessage('');},[organisationId]);
 const visible=records.filter(r=>r.organisationId===organisationId),a=visible.find(r=>r.id===current),b=visible.find(r=>r.id===baseline);
 const issue=a&&b?comparisonIssue(a,b):null,comparison=a&&b&&!issue?compareReports(a,b):[];
 function save(source:string){try{
  const report=results[source] as GoogleReport;if(!report||!organisationId)return;
  const latest=parseHistory(localStorage.getItem(historyKey)||'[]');
  if(latest.length>=30)throw Error('History holds 30 reports. Export and remove a report before saving another.');
  if(latest.some(r=>r.organisationId===organisationId&&r.report.source===report.source&&r.report.observedAt===report.observedAt))throw Error('This response is already saved.');
  const entry={id:crypto.randomUUID(),organisationId,report};const next=parseHistory(JSON.stringify([entry,...latest]));localStorage.setItem(historyKey,JSON.stringify(next));setRecords(next);setCurrent(entry.id);setMessage('Report saved on this browser.');
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to save report.');}}
 function remove(){try{const next=parseHistory(localStorage.getItem(historyKey)||'[]').filter(r=>!(r.id===current&&r.organisationId===organisationId));localStorage.setItem(historyKey,JSON.stringify(next));setRecords(next);setCurrent('');setMessage('Selected browser copy removed.');}catch{setMessage('Unable to update saved history.');}}
 function exportHistory(){const url=URL.createObjectURL(new Blob([JSON.stringify(visible,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='VisTa Google report history.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="report-vault" aria-labelledby="report-vault-title"><span className="eyebrow">OBSERVE / COMPARE / DECIDE</span><h3 id="report-vault-title">Your evidence, over time.</h3><p>Save authorised Google responses on this browser. These copies are not cloud backups and remain on this device after sign-out. Save only on a trusted device.</p><div className="report-vault-actions">{['gsc','ga4'].map(source=><button key={source} disabled={!organisationId||!results[source]} onClick={()=>save(source)}>Save {source.toUpperCase()} response</button>)}<button disabled={!visible.length} onClick={exportHistory}>Export organisation history</button></div>
 <div className="report-selectors">{[['Selected report',current,setCurrent],['Comparison baseline',baseline,setBaseline]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<select value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}><option value="">Choose a saved report</option>{visible.map(r=><option key={r.id} value={r.id}>{r.report.view||'Search queries'} · {r.report.period?.startDate||'Realtime'} · {new Date(r.report.observedAt).toLocaleString()}</option>)}</select></label>)}</div>
 {a&&<div className="saved-report-detail"><p>{a.report.property||a.report.site} · {a.report.rows.length} rows · {a.report.period?`${a.report.period.startDate} to ${a.report.period.endDate}`:'Realtime snapshot'}</p><details><summary>Saved source evidence</summary><pre>{JSON.stringify(a.report,null,2)}</pre></details><button onClick={remove}>Remove selected browser copy</button></div>}
 {issue&&<p role="status">{issue}</p>}{a&&b&&!issue&&<><p>Matched rows only. Missing rows are not treated as zero. Changes are associations, not proof of causation. User counts are not additive.</p><div className="provider-table" tabIndex={0} role="region" aria-label="Report comparison"><table><thead><tr>{['Segment','Metric','Baseline','Selected','Change'].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{comparison.map((r,i)=><tr key={i}><td>{r.label}</td><td>{r.metric}</td><td>{r.baseline}</td><td>{r.current}</td><td>{r.change===null?'No percentage baseline':`${r.change>0?'+':''}${r.change.toFixed(1)}%`}</td></tr>)}</tbody></table>{!comparison.length&&<p>No matching segments to compare.</p>}</div></>}{message&&<p role="status">{message}</p>}
 </section>;
}
