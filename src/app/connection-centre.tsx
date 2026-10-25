'use client';
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
  const membership=Array.isArray(session.memberships)?session.memberships[0]:null;
  setOrg(membership?.organisation_id||"");
  setCloud(session.authenticated&&membership?"ready":session.configured?"signin":"offline");
  setError("");
  }catch{setError("Connection status unavailable. No provider data has been fetched.");setCloud("offline");}
 }
 useEffect(()=>{void refresh();},[]);
 async function run(source:Source){
  if(!org){setError("Sign in to a configured VisTa organisation before testing provider access.");return;}
  setRunning(source);setError("");
  try{
   const res=await fetch("/api/integrations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organisationId:org,source,brand,prompt:question})});
   const payload=await res.json();
   if(!res.ok||!payload.connected)throw new Error(payload.error||"Provider test failed.");
   setResults(r=>({...r,[source]:payload.result}));
  }catch(e){setError(source.toUpperCase()+": "+(e instanceof Error?e.message:"Connection failed."));}
  finally{setRunning(null);}
 }
 async function loadSampleHistory(){if(!org)return;setHistoryBusy(true);setError("");try{const response=await fetch("/api/integrations/ai-samples?organisationId="+encodeURIComponent(org),{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error||"Unable to read AI sample history.");setSampleHistory(Array.isArray(data.samples)?data.samples:[]);}catch(e){setError(e instanceof Error?e.message:"AI sample history is unavailable.");}finally{setHistoryBusy(false);}}
 return <section className="vista-connection-centre" aria-labelledby="live-connector-title">
  <header className="live-connector-header"><div><span className="eyebrow"><PlugZap size={15}/> CONNECTED INTELLIGENCE / SOURCE INTEGRITY</span>
    <h2 id="live-connector-title">Real data. Verified connections.</h2>
    <p>Authorise each provider, perform a real API request and inspect what it actually returns. A configured connector is not considered live until its authenticated test succeeds.</p></div>
   <button className="connector-refresh" type="button" onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh status</button></header>
  <div className="connector-identity">{cloud==="ready"?<><ShieldCheck size={17}/> Signed in to a verified VisTa organisation. Your read-only provider requests are permission-checked.</>:<><KeyRound size={17}/>{cloud==="signin"?"Cloud login is configured. Sign in using the workspace cloud controls before running provider tests.":cloud==="checking"?"Checking identity and source configuration…":"Cloud identity is not yet configured. Configure Supabase and authorise a workspace before connecting sources."}</>}</div>
  <div className="connector-grid">{sources.map(source=>{
    const config=readiness?.[source.id];
    const tested=results[source.id]!==undefined;
    return <article className={"connector-source connector-"+source.id} key={source.id}>
      <div className="connector-source-head"><Activity size={21}/><span className={"connector-state "+(tested?"verified":config?.configured?"prepared":"offline")}>{tested?"Live test passed":config?.configured?"Credentials configured":"Not connected"}</span></div>
      <h3>{source.title}</h3><p>{source.description}</p><span className="connector-engine">ENGINE: {source.use}</span>
      {source.id==="openai"&&<div className="connector-ai-input"><label>Brand<input value={brand} maxLength={100} onChange={e=>setBrand(e.target.value)}/></label><label>Test prompt<textarea rows={3} maxLength={900} value={question} onChange={e=>setQuestion(e.target.value)}/></label></div>}
      <button type="button" className="connector-test" disabled={!config?.configured||cloud!=="ready"||running!==null} onClick={()=>void run(source.id)}>{running===source.id?"Testing live provider…":"Test live connection"} <ArrowUpRight size={15}/></button>
      <small>{config?.method||"Checking credentials…"}</small>
      {tested&&<div className="connector-result"><div><strong>Authenticated response received</strong><button onClick={()=>exportJson(source.title,results[source.id])} type="button"><Download size={14}/> Export</button></div><pre>{JSON.stringify(results[source.id],null,2).slice(0,6000)}</pre></div>}
    </article>;
  })}</div>
  <div className="connector-history"><div><h3>Scheduled AI answer sampling</h3><p>Once credentials, source table and a production scheduler are configured, VisTa records dated answers and citations for repeatable comparisons. Runs use one to three approved prompts per day.</p></div><button type="button" disabled={cloud!=="ready"||historyBusy} onClick={()=>void loadSampleHistory()}>{historyBusy?"Loading recorded samples…":"Review saved AI samples"}</button></div>
  {sampleHistory!==null&&<div className="connector-history-results"><p>{sampleHistory.length} authorised sampling records returned</p>{sampleHistory.slice(0,15).map((sample,i)=><article key={String(sample.id||i)}><strong>{String(sample.brand||"Brand")} · {String(sample.model||"Model")}</strong><time>{String(sample.observed_at||"")}</time><p>{String(sample.prompt||"")}</p><blockquote>{String(sample.response||"").slice(0,750)}</blockquote><small>{sample.mentioned?"Brand mentioned":"No literal brand mention"} · {Array.isArray(sample.citations)?sample.citations.length:0} citation annotations</small></article>)}</div>}
  {error&&<div className="connector-error" role="alert">{error}</div>}
  <p className="connector-warning">Connection data is retrieved on demand and is not retained by this screen. Google properties, CRM accounts and AI keys require explicit authorisation. HubSpot is the initial CRM adapter; Salesforce and other CRMs need their own provider setup. AI samples are observations, not search rankings or representative share-of-voice measurements.</p>
 </section>;
}
