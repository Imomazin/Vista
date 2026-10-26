'use client';
import {useEffect,useState} from 'react';
import {compareReports,comparisonIssue,historyKey,parseHistory,type SavedReport,type GoogleReport} from '@/lib/provider-history';
export default function ProviderHistory({organisationId,results}:{organisationId:string;results:Record<string,unknown>}){
 const [mode,setMode]=useState<'browser'|'cloud'>('browser');
 const [cloudRecords,setCloudRecords]=useState<SavedReport[]>([]),[busy,setBusy]=useState(false);
 const [records,setRecords]=useState<SavedReport[]>([]),[current,setCurrent]=useState(''),[baseline,setBaseline]=useState(''),[message,setMessage]=useState('');
 function load(){try{setRecords(parseHistory(localStorage.getItem(historyKey)||'[]'));}catch{setRecords([]);setMessage('Saved history cannot be read. Export browser storage before recovery; existing records have not been overwritten.');}}
 useEffect(()=>{load();window.addEventListener('storage',load);return()=>window.removeEventListener('storage',load);},[]);
 useEffect(()=>{setCurrent('');setBaseline('');setMessage('');},[organisationId]);
 useEffect(()=>{
  const controller=new AbortController();let active=true;
  async function refresh(){if(!organisationId){setCloudRecords([]);setMessage('Sign in and select an organisation to view its cloud history.');return;}setBusy(true);try{
   const response=await fetch('/api/integrations/reports?organisationId='+encodeURIComponent(organisationId),{cache:'no-store',signal:controller.signal});const data=await response.json();
   if(!response.ok)throw Error(data.error||'Cloud history unavailable.');
   const parsed=parseHistory(JSON.stringify(data.reports));if(active)setCloudRecords(parsed);
  }catch(e){if(active){setCloudRecords([]);if(mode==='cloud')setMessage(e instanceof Error?e.message:'Cloud history unavailable.');}}finally{if(active)setBusy(false);}}
  if(mode==='cloud')void refresh();window.addEventListener('vista-cloud-reports-update',refresh);
  return()=>{active=false;controller.abort();window.removeEventListener('vista-cloud-reports-update',refresh);};
 },[organisationId,mode]);
 const visible=(mode==='cloud'?cloudRecords:records).filter(r=>r.organisationId===organisationId),a=visible.find(r=>r.id===current),b=visible.find(r=>r.id===baseline);
 const issue=a&&b?comparisonIssue(a,b):null,comparison=a&&b&&!issue?compareReports(a,b):[];
 function save(source:string){try{
  const report=results[source] as GoogleReport;if(!report||!organisationId)return;
  const latest=parseHistory(localStorage.getItem(historyKey)||'[]');
  if(latest.length>=30)throw Error('History holds 30 reports. Export and remove a report before saving another.');
  if(latest.some(r=>r.organisationId===organisationId&&r.report.source===report.source&&r.report.observedAt===report.observedAt))throw Error('This response is already saved.');
  const entry={id:crypto.randomUUID(),organisationId,report};const next=parseHistory(JSON.stringify([entry,...latest]));localStorage.setItem(historyKey,JSON.stringify(next));setRecords(next);setCurrent(entry.id);setMessage('Report saved on this browser.');
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to save report.');}}
 async function remove(){if(mode==='cloud'){setBusy(true);try{const response=await fetch('/api/integrations/reports',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({organisationId,id:current})});const data=await response.json();if(!response.ok)throw Error(data.error||'Removal failed.');setCloudRecords(rows=>rows.filter(r=>r.id!==current));setCurrent('');setMessage('Cloud report removed.');}catch(e){setMessage(e instanceof Error?e.message:'Removal failed.');}finally{setBusy(false);}return;}try{const next=parseHistory(localStorage.getItem(historyKey)||'[]').filter(r=>!(r.id===current&&r.organisationId===organisationId));localStorage.setItem(historyKey,JSON.stringify(next));setRecords(next);setCurrent('');setMessage('Selected browser copy removed.');}catch{setMessage('Unable to update saved history.');}}
 function exportHistory(){const url=URL.createObjectURL(new Blob([JSON.stringify(visible,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='VisTa Google report history.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section className="report-vault" aria-labelledby="report-vault-title"><span className="eyebrow">OBSERVE / COMPARE / DECIDE</span><h3 id="report-vault-title">Your evidence, over time.</h3><p>Choose browser history or organisation cloud history. Browser copies remain on this device after sign-out; save locally only on a trusted device.</p><label className="report-storage">History location<select value={mode} disabled={busy} onChange={e=>{setMode(e.target.value as 'browser'|'cloud');setCurrent('');setBaseline('');setMessage('');}}><option value="browser">This browser</option><option value="cloud">Organisation cloud</option></select></label>{mode==='cloud'&&<p>Latest 30 organisation reports. Enable cloud saving above before retrieving a new report. Only owners can delete cloud reports.</p>}{busy&&<p role="status">Updating cloud history…</p>}<div className="report-vault-actions">{mode==='browser'&&['gsc','ga4'].map(source=><button key={source} disabled={!organisationId||!results[source]} onClick={()=>save(source)}>Save {source.toUpperCase()} response</button>)}<button disabled={!visible.length} onClick={exportHistory}>Export organisation history</button></div>
 <div className="report-selectors">{[['Selected report',current,setCurrent],['Comparison baseline',baseline,setBaseline]].map(([label,value,setter])=><label key={String(label)}>{String(label)}<select value={String(value)} onChange={e=>(setter as (v:string)=>void)(e.target.value)}><option value="">Choose a saved report</option>{visible.map(r=><option key={r.id} value={r.id}>{r.report.view||'Search queries'} · {r.report.period?.startDate||'Realtime'} · {new Date(r.report.observedAt).toLocaleString()}</option>)}</select></label>)}</div>
 {a&&<div className="saved-report-detail"><p>{a.report.property||a.report.site} · {a.report.rows.length} rows · {a.report.period?`${a.report.period.startDate} to ${a.report.period.endDate}`:'Realtime snapshot'}</p><details><summary>Saved source evidence</summary><pre>{JSON.stringify(a.report,null,2)}</pre></details><button disabled={busy} onClick={()=>void remove()}>Remove selected {mode==='cloud'?'cloud report':'browser copy'}</button></div>}
 {issue&&<p role="status">{issue}</p>}{a&&b&&!issue&&<><p>Matched rows only. Missing rows are not treated as zero. Changes are associations, not proof of causation. User counts are not additive.</p><div className="provider-table" tabIndex={0} role="region" aria-label="Report comparison"><table><thead><tr>{['Segment','Metric','Baseline','Selected','Change'].map(v=><th scope="col" key={v}>{v}</th>)}</tr></thead><tbody>{comparison.map((r,i)=><tr key={i}><td>{r.label}</td><td>{r.metric}</td><td>{r.baseline}</td><td>{r.current}</td><td>{r.change===null?'No percentage baseline':`${r.change>0?'+':''}${r.change.toFixed(1)}%`}</td></tr>)}</tbody></table>{!comparison.length&&<p>No matching segments to compare.</p>}</div></>}{message&&<p role="status">{message}</p>}
 </section>;
}
