'use client';
import ProviderHistory from './provider-history';
import {useEffect,useState} from "react";
import {Activity,ArrowUpRight,Download,KeyRound,PlugZap,RefreshCw,ShieldCheck} from "lucide-react";
import "./connection-centre.css";
type Source="gsc"|"ga4"|"hubspot"|"openai";
type Connection={configured:boolean;method:string};
const sources:{id:Source;title:string;description:string;use:string}[]=[
 {id:"gsc",title:"Google Search Console",description:"Real search queries, impressions, clicks and average position",use:"Search Visibility"},
 {id:"ga4",title:"Google Analytics 4",description:"Real channel sessions, users and key events",use:"Impact / Analytics Intelligence"},
 {id:"hubspot",title:"HubSpot CRM",description:"Read-only contact stages and deal samples",use:"Agency / Impact Intelligence"},
 {id:"openai",title:"OpenAI answer sampling",description:"Real model response with prompt, date and reported citations",use:"AI Exposure / GEO"}
];
function exportJson(source:string,content:unknown){
 const blob=new Blob([JSON.stringify(content,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);const a=document.createElement("a");
 a.href=url;a.download="VisTa "+source+" source evidence.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function ConnectionCentre(){
 const [readiness,setReadiness]=useState<Record<Source,Connection>|null>(null);
 const [org,setOrg]=useState("");
 const [memberships,setMemberships]=useState<{organisation_id:string;role:string;vista_organisations:{name:string}}[]>([]);
 const [retain,setRetain]=useState(false);
 const [view,setView]=useState('channels');
 const [startDate,setStartDate]=useState(()=>new Date(Date.now()-28*86400000).toISOString().slice(0,10));
 const [endDate,setEndDate]=useState(()=>new Date(Date.now()-86400000).toISOString().slice(0,10));
 const [cloud,setCloud]=useState<"checking"|"offline"|"signin"|"ready">("checking");
 const [brand,setBrand]=useState("Ambidexters");
 const [question,setQuestion]=useState("Which software consulting firms offer AI-driven business transformation services?");
 const [running,setRunning]=useState<Source|null>(null);
 const [error,setError]=useState("");
 const [results,setResults]=useState<Partial<Record<Source,unknown>>>({});
 const [sampleHistory,setSampleHistory]=useState<Record<string,unknown>[]|null>(null);
 const [historyBusy,setHistoryBusy]=useState(false);
 async function refresh(){
  try{const [status,session]=await Promise.all([
   fetch("/api/integrations",{cache:"no-store"}).then(r=>r.json()),
   fetch("/api/cloud/session",{cache:"no-store"}).then(r=>r.json())
  ]);
  setReadiness(status.providers||null);
  const available=Array.isArray(session.memberships)?session.memberships:[];
  setMemberships(available);
  const membership=available.find((m:{organisation_id:string})=>m.organisation_id===org)||(available.length===1?available[0]:null);
  setResults({});setSampleHistory(null);
  setOrg(membership?.organisation_id||"");
  setCloud(session.authenticated&&available.length?"ready":session.configured?"signin":"offline");
  setError("");
  }catch{setError("Connection status unavailable. No provider data has been fetched.");setCloud("offline");}
 }
 useEffect(()=>{void refresh();},[]);
 async function run(source:Source){
  if(!org){setError("Sign in to a configured VisTa organisation before testing provider access.");return;}
  setRunning(source);setError("");setResults(r=>{const next={...r};delete next[source];return next;});
  try{
   const res=await fetch("/api/integrations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organisationId:org,source,brand,prompt:question,retain,...(source==='ga4'?{view,startDate,endDate}:{})})});
   const payload=await res.json();
   if(!res.ok||!payload.connected)throw new Error(payload.error||"Provider test failed.");
   setResults(r=>({...r,[source]:payload.result}));
   if(payload.storageWarning)setError(payload.storageWarning);
   if(payload.saved)window.dispatchEvent(new Event("vista-cloud-reports-update"));
  }catch(e){setError(source.toUpperCase()+": "+(e instanceof Error?e.message:"Connection failed."));}
  finally{setRunning(null);}
 }
 async function loadSampleHistory(){if(!org)return;setHistoryBusy(true);setError("");try{const response=await fetch("/api/integrations/ai-samples?organisationId="+encodeURIComponent(org),{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to read AI sample history.");setSampleHistory(Array.isArray(data.samples)?data.samples:[]);}catch(e){setError(e instanceof Error?e.message:"AI sample history is unavailable.");}finally{setHistoryBusy(false);}}
 return <section className="vista-connection-centre" aria-labelledby="live-connector-title">
  <header className="live-connector-header"><div><span className="eyebrow"><PlugZap size={15}/> CONNECTED INTELLIGENCE / SOURCE INTEGRITY</span>
    <h2 id="live-connector-title">Real data. Verified connections.</h2>
    <p>Authorise each provider, perform a real API request and inspect what it actually returns. A configured connector is not considered live until its authenticated test succeeds.</p></div>
   <button className="connector-refresh" type="button" disabled={running!==null||historyBusy} onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh status</button></header>
  <div className="connector-identity">{cloud==="ready"?<><ShieldCheck size={17}/> Signed in to a verified VisTa organisation. Your read-only provider requests are permission-checked.</>:<><KeyRound size={17}/>{cloud==="signin"?"Cloud login is configured. Sign in using the workspace cloud controls before running provider tests.":cloud==="checking"?"Checking identity and source configuration…":"Cloud identity is not yet configured. Configure Supabase and authorise a workspace before connecting sources."}</>}</div>
  {cloud==='ready'&&<label className="connector-org">Organisation<select aria-label="Provider organisation" disabled={running!==null||historyBusy} value={org} onChange={e=>{setOrg(e.target.value);setResults({});setSampleHistory(null);setError('');}}><option value="">Select organisation</option>{memberships.map(m=><option key={m.organisation_id} value={m.organisation_id}>{m.vista_organisations?.name||m.organisation_id} · {m.role}</option>)}</select></label>}
  <label className="connector-retain"><input type="checkbox" checked={retain} disabled={running!==null} onChange={e=>setRetain(e.target.checked)}/> Save new Google responses to this organisation’s cloud history</label>
  <div className="connector-grid">{sources.map(source=>{
    const config=readiness?.[source.id];
    const tested=results[source.id]!==undefined;
    return <article className={"connector-source connector-"+source.id} key={source.id}>
      <div className="connector-source-head"><Activity size={21}/><span className={"connector-state "+(tested?"verified":config?.configured?"prepared":"offline")}>{tested?"Live test passed":config?.configured?"Credentials configured":"Not connected"}</span></div>
      <h3>{source.title}</h3><p>{source.description}</p><span className="connector-engine">ENGINE: {source.use}</span>
      {source.id==='ga4'&&<fieldset className="connector-report-options" disabled={running!==null}><legend>Analytics report</legend><label>View<select value={view} onChange={e=>setView(e.target.value)}><option value="channels">Acquisition channels</option><option value="pages">Landing pages</option><option value="daily">Daily trend</option><option value="realtime">Realtime events</option></select></label>{view!=='realtime'&&<><label>From<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label><label>To<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label></>}</fieldset>}
      {source.id==="openai"&&<div className="connector-ai-input"><label>Brand<input value={brand} maxLength={100} onChange={e=>setBrand(e.target.value)}/></label><label>Test prompt<textarea rows={3} maxLength={900} value={question} onChange={e=>setQuestion(e.target.value)}/></label></div>}
      <button type="button" className="connector-test" disabled={!config?.configured||cloud!=="ready"||!org||memberships.find(m=>m.organisation_id===org)?.role!=="owner"||running!==null} onClick={()=>void run(source.id)}>{running===source.id?"Testing live provider…":"Test live connection"} <ArrowUpRight size={15}/></button>
      <small>{config?.method||"Checking credentials…"}</small>
      {tested&&<div className="connector-result"><div><strong>Authenticated response received</strong><button onClick={()=>exportJson(source.title,results[source.id])} type="button"><Download size={14}/> Export</button></div><ProviderReport result={results[source.id]}/><details><summary>Inspect source response</summary><pre>{JSON.stringify(results[source.id],null,2).slice(0,6000)}</pre></details></div>}
    </article>;
  })}</div>
  <ProviderHistory organisationId={org} results={results}/>
  <div className="connector-history"><div><h3>Scheduled AI answer sampling</h3><p>Once credentials, source table and a production scheduler are configured, VisTa records dated answers and citations for repeatable comparisons. Runs use one to three approved prompts per day.</p></div><button type="button" disabled={cloud!=="ready"||!org||running!==null||historyBusy} onClick={()=>void loadSampleHistory()}>{historyBusy?"Loading recorded samples…":"Review saved AI samples"}</button></div>
  {sampleHistory!==null&&<div className="connector-history-results"><p>{sampleHistory.length} authorised sampling records returned</p>{sampleHistory.slice(0,15).map((sample,i)=><article key={String(sample.id||i)}><strong>{String(sample.brand||"Brand")} · {String(sample.model||"Model")}</strong><time>{String(sample.observed_at||"")}</time><p>{String(sample.prompt||"")}</p><blockquote>{String(sample.response||"").slice(0,750)}</blockquote><small>{sample.mentioned?"Brand mentioned":"No literal brand mention"} · {Array.isArray(sample.citations)?sample.citations.length:0} citation annotations</small></article>)}</div>}
  {error&&<div className="connector-error" role="alert">{error}</div>}
  <p className="connector-warning">Connection data is retrieved on demand. Google responses are retained on this browser only when you choose Save. Google properties, CRM accounts and AI keys require explicit authorisation. HubSpot is the initial CRM adapter; Salesforce and other CRMs need their own provider setup. AI samples are observations, not search rankings or representative share-of-voice measurements.</p>
 </section>;
}

function ProviderReport({result}:{result:unknown}){
 const data=result as {rows?:Record<string,unknown>[];observedAt?:string;scope?:string;period?:{startDate:string;endDate:string};property?:string;site?:string;truncated?:boolean;rowCount?:number;note?:string};
 if(!Array.isArray(data.rows))return null;
 const columns=Object.keys(data.rows[0]||{});
 return <div className="provider-report"><p>{data.property?'Property '+data.property:data.site}</p><p>Retrieved {data.observedAt?new Date(data.observedAt).toLocaleString():'unknown time'} · {data.scope||'Search query sample'}</p>{data.period&&<p>{data.period.startDate} to {data.period.endDate}</p>}
 {data.rows.length===0?<div className="provider-empty" role="status"><strong>Connected. No report rows returned.</strong><p>The request succeeded. This report does not yet provide traffic or event evidence. {data.property?'Try another period or the Realtime report after a consented visit.':'Review the property and reporting period in Search Console; empty rows do not establish indexing or search visibility.'}</p></div>:<div className="provider-table" tabIndex={0} role="region" aria-label="Provider report table"><table><thead><tr>{columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{data.rows.map((row,i)=><tr key={i}>{columns.map(c=><td key={c}>{typeof row[c]==='number'?Number(row[c]).toLocaleString(undefined,{maximumFractionDigits:3}):String(row[c]??'')}</td>)}</tr>)}</tbody></table></div>}
 {data.truncated&&<p role="status">Showing {data.rows.length} of {data.rowCount} rows. This is a partial report.</p>}<small>{data.note||'Returned rows are a sample, not complete property totals.'}</small></div>;
}
