'use client';
import {useEffect,useMemo,useRef,useState} from "react";
import {Activity,ArrowRight,ArrowUpRight,BookOpen,Check,ChevronRight,CircleHelp,Download,FileText,Globe2,Layers3,Orbit,Plus,RadioTower,ScanLine,Search,ShieldCheck,Sparkles,Target,Trash2,Upload,X} from "lucide-react";
import type {CSSProperties,FormEvent} from "react";
import type {Workspace} from "@/lib/workspace";
import type {View,WorkspaceTab} from "@/lib/navigation";
import {preferredProject,rememberProject} from "@/lib/workspace";
import {buildOpportunities} from "@/lib/opportunities";
import {engineMethods,engineSummary,type EngineId,engineById} from "@/lib/engine-methods";
import {emptyEngineLedger,parseEngineLedger,saveEngineEvidence,removeEngineEvidence,engineLedgerKey,countEngineEvidence,type EngineEvidence,type EngineLedger,type EvidenceKind,type EvidenceStage} from "@/lib/engine-evidence";
import EngineDiagnostic from "./engine-diagnostic";
import "./ecosystem.css";

const icons=[Search,Target,ScanLine,BookOpen,ShieldCheck,RadioTower,Layers3,Activity,Sparkles] as const;
const positions=[
 {x:50,y:8},{x:75,y:17},{x:90,y:39},{x:83,y:69},{x:61,y:89},
 {x:38,y:89},{x:16,y:69},{x:10,y:39},{x:25,y:17}
];
type Nav=(view:View,tab?:WorkspaceTab)=>void;
function cleanHost(url:string){try{return new URL(url).hostname.replace(/^www\./,"");}catch{return url;}}
function exportRecords(ledger:EngineLedger){
 const url=URL.createObjectURL(new Blob([JSON.stringify(ledger,null,2)],{type:"application/json"}));
 const a=document.createElement("a");a.href=url;a.download="VisTa Engine Evidence.json";a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function VisTaMark({compact=false}:{compact?:boolean}){
 return <span className={"vista-wordmark"+(compact?" wordmark-compact":"")} aria-label="VisTa">Vis<span>T</span>a</span>;
}
export function EngineDock({active,onSelect}:{active:EngineId,onSelect:(id:EngineId)=>void}){
 return <nav className="vista-engine-dock" aria-label="Nine VisTa intelligence elements">
  {engineMethods.map(e=>{const Icon=icons[e.id-1];return <button key={e.id} title={e.name} onClick={()=>onSelect(e.id)} aria-label={"Open "+e.name} aria-current={active===e.id?"page":undefined}><Icon size={14} strokeWidth={1.8}/><span>{e.id}</span></button>;})}
 </nav>;
}
export function VisTaMorph({motion,onContinue}:{motion:boolean,onContinue:()=>void}){
 return <div className={"vista-morph"+(!motion?" morph-still":"")} role="dialog" aria-modal="true" aria-label="VisTa becomes nine interconnected intelligence elements">
  <div className="morph-halo morph-halo-outer" aria-hidden="true"/><div className="morph-halo morph-halo-inner" aria-hidden="true"/>
  <div className="morph-centre"><span className="morph-kicker">MARKETING SUPERIOR INTELLIGENCE</span><VisTaMark/><p>Nine elements. One living intelligence.</p></div>
  <svg className="morph-links" viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true">{positions.map((p,i)=><line key={i} x1="500" y1="350" x2={p.x*10} y2={p.y*7}/>)}</svg>
  <div className="morph-particles" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{"--n":i} as CSSProperties}/>)}</div>
  <div className="morph-elements">{engineMethods.map((e,i)=>{const Icon=icons[i];return <div className="morph-element" key={e.id} style={{"--x":positions[i].x+"%","--y":positions[i].y+"%","--order":i} as CSSProperties}><span className="morph-element-icon"><Icon size={18}/></span><span className="morph-element-label">{e.name}</span></div>;})}</div>
  <button className="morph-skip" onClick={onContinue}>Enter the VisTa universe <ArrowRight size={17}/></button>
 </div>;
}
export default function VisTaEcosystem({data,selected,onSelect,onNavigate}:{data:Workspace,selected:EngineId,onSelect:(id:EngineId)=>void,onNavigate:Nav}){
 const [tab,setTab]=useState<"overview"|"evidence"|"playbook"|"diagnostic">("overview");
 const [projectId,setProjectId]=useState("all");
 const [ledger,setLedger]=useState<EngineLedger>(emptyEngineLedger);
 const [recovery,setRecovery]=useState(false);
 const [message,setMessage]=useState("");
 const [editing,setEditing]=useState(false);
 const [query,setQuery]=useState("");
 const file=useRef<HTMLInputElement>(null);
 const projects=data.projects;
 const currentProject=projects.find(p=>p.id===projectId);
 const current=engineById(selected)||engineMethods[0];
 const detail=engineSummary(current.id,data,currentProject?.id);
 const allRecords=ledger.records.filter(r=>r.engineId===selected&&(!currentProject||r.projectId===currentProject.id));
 const records=allRecords.filter(r=>(r.title+" "+r.details+" "+r.implication+" "+r.nextAction).toLowerCase().includes(query.trim().toLowerCase()));
 const recency=records.slice().sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
 const counts=engineMethods.map(m=>countEngineEvidence(ledger,m.id,currentProject?.id));
 const opportunities=useMemo(()=>buildOpportunities(data,currentProject?.id),[data,currentProject?.id]);
 useEffect(()=>{try{const raw=window.localStorage.getItem(engineLedgerKey);if(raw)setLedger(parseEngineLedger(raw));setRecovery(false);}catch{setRecovery(true);setMessage("Saved engine evidence could not be loaded. Export the original data before replacing it.");}},[]);
 useEffect(()=>{const refresh=()=>{try{const raw=window.localStorage.getItem(engineLedgerKey);setLedger(raw?parseEngineLedger(raw):emptyEngineLedger());setRecovery(false);}catch{setRecovery(true);}};
  window.addEventListener("storage",refresh);window.addEventListener("vista-engine-update",refresh);
  return()=>{window.removeEventListener("storage",refresh);window.removeEventListener("vista-engine-update",refresh);};
 },[]);
 function persist(next:EngineLedger,overwrite=false){
  if(recovery&&!overwrite){setMessage("Export the damaged backup before saving new records.");return false;}
  try{const safe=parseEngineLedger(JSON.stringify(next));window.localStorage.setItem(engineLedgerKey,JSON.stringify(safe));setLedger(safe);setRecovery(false);window.dispatchEvent(new Event("vista-engine-update"));return true;}
  catch(e){setMessage(e instanceof Error?e.message:"Unable to save evidence.");return false;}
 }
 function choose(id:EngineId){onSelect(id);setTab("overview");setEditing(false);setQuery("");setMessage("");}
 function openAction(){if(current.tab)onNavigate(current.route,current.tab);else onNavigate(current.route);}
 function add(e:FormEvent<HTMLFormElement>){
  e.preventDefault();
  if(!projects.length){setMessage("Create a project before recording evidence.");return;}
  const form=e.currentTarget;
  const fields=new FormData(form);
  const project=String(fields.get("project")||"");
  if(!projects.some(p=>p.id===project)){setMessage("Select an existing project.");return;}
  const source=String(fields.get("source")||"").trim();
  if(source){try{const u=new URL(source);if(u.protocol!=="https:"||u.username||u.password)throw Error();}catch{setMessage("Evidence source must be a valid public HTTPS link, or left blank.");return;}}
  const date=String(fields.get("date")||new Date().toISOString().slice(0,10));
  const time=new Date(date+"T12:00:00.000Z");
  if(!Number.isFinite(time.getTime())){setMessage("Enter a valid observation date.");return;}
  const record:EngineEvidence={id:crypto.randomUUID(),engineId:selected,projectId:project,title:String(fields.get("title")||"").trim(),kind:String(fields.get("kind")||"Finding") as EvidenceKind,
   source,details:String(fields.get("details")||"").trim(),implication:String(fields.get("implication")||"").trim(),nextAction:String(fields.get("nextAction")||"").trim(),
   observedAt:time.toISOString(),savedAt:new Date().toISOString(),stage:"Observed"};
  if(!record.title||!record.details){setMessage("Include an observation title and its supporting detail.");return;}
  if(persist(saveEngineEvidence(ledger,record))){setEditing(false);form.reset();setMessage("Evidence saved to this browser workspace.");}
 }
 function setStage(record:EngineEvidence,stage:EvidenceStage){
  const updated=saveEngineEvidence(ledger,{...record,stage,savedAt:new Date().toISOString()});
  if(persist(updated))setMessage(stage==="User-verified"?"Marked user-verified. Confirm the supporting source before relying on this observation.":"Evidence stage updated.");
 }
 const available=projects.length>0;
 return <section className="vte" aria-labelledby="vte-heading">
  <header className="vte-intro"><div><span className="eyebrow"><Orbit size={15}/> THE VIS TA INTELLIGENCE UNIVERSE</span><h1 id="vte-heading">One identity.<br/><em>Nine dimensions of advantage.</em></h1><p>Every element starts with a question, connects evidence to decisions and closes with a measurable action.</p></div><button className="vte-enter-command" onClick={()=>onNavigate("command")}>Open Command Centre <ArrowUpRight size={16}/></button></header>
  <div className="vte-map" aria-label="VisTa nine-element constellation">
   <div className="vte-map-orbit orbit-a"/><div className="vte-map-orbit orbit-b"/><div className="vte-map-orbit orbit-c"/>
   <svg className="vte-map-lines" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">{positions.map((p,i)=><line key={i} x1="500" y1="310" x2={p.x*10} y2={p.y*6.2}/>)}</svg>
   <div className="vte-map-core"><VisTaMark compact/><span>INTELLIGENCE CORE</span><small>SELECT AN ELEMENT</small></div>
   {engineMethods.map((method,i)=>{const Icon=icons[i];return <button key={method.id} className={"vte-map-node"+(selected===method.id?" selected":"")} style={{left:positions[i].x+"%",top:positions[i].y+"%","--order":i} as CSSProperties} onClick={()=>choose(method.id)} aria-pressed={selected===method.id}><span className="vte-node-icon"><Icon size={20}/></span><span className="vte-node-caption"><small>{String(method.id).padStart(2,"0")} / {method.pillar}</small>{method.name}</span></button>;})}
   <span className="vte-map-corner corner-a">OBSERVE / INTERPRET</span><span className="vte-map-corner corner-b">PRIORITISE / ACT / VERIFY</span>
  </div>
  <div className="vte-control"><div className="vte-control-selector"><label htmlFor="vte-project">Evidence scope</label><select id="vte-project" value={currentProject?.id||"all"} onChange={e=>{setProjectId(e.target.value);setEditing(false);}}><option value="all">All projects</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="vte-control-count"><span>9 ELEMENTS</span><span>{counts.reduce((sum,n)=>sum+n,0)} MANUAL EVIDENCE RECORDS</span></div></div>
  <div className="vte-focus" key={current.id}>
   <div className="vte-focus-top"><div className="vte-focus-number">{String(current.id).padStart(2,"0")}</div><div><span className="eyebrow">PILLAR {current.pillar} / {current.short.toUpperCase()}</span><h2>{current.name}</h2><p>{current.promise}</p></div><span className="vte-capability-label">{current.id===3?"LIVE HTML AUDITS":current.id===4||current.id===7||current.id===9||current.id===8?"PARTIAL WORKSPACE":"SOURCE INTEGRATION PLANNED"}</span></div>
   <div className="vte-focus-tabs">{(["overview","diagnostic","evidence","playbook"] as const).map(t=><button key={t} onClick={()=>{setTab(t);setEditing(false);setMessage("");}} aria-pressed={tab===t} className={tab===t?"selected":""}>{t==="overview"?"Intelligence & value":t==="diagnostic"?"Deep diagnostic":t==="evidence"?"Evidence ledger":"Decision playbook"}</button>)}</div>
   {tab==="overview"&&<div className="vte-overview">
    <div className="vte-value-lead"><div><span className="eyebrow">STRATEGIC DECISION</span><h3>{current.decision}</h3><p>{current.available}</p><button onClick={openAction} className="vte-primary">{current.action}<ArrowUpRight size={16}/></button></div><div className="vte-measured"><span>RECORDED EVIDENCE</span><strong>{detail.value===null?"—":detail.value}</strong><small>{detail.label}</small><p>{detail.note}</p></div></div>
    <div className="vte-overview-grid"><div><span className="eyebrow">WHAT THIS ELEMENT MUST DELIVER</span>{current.outcomes.map(o=><p key={o}><Check size={15}/>{o}</p>)}</div><div><span className="eyebrow">MEASUREMENTS</span>{current.metrics.map(m=><p key={m}><Activity size={14}/>{m}</p>)}<small>Only sourced measurements will be populated when integrations are available.</small></div></div>
    <div className="vte-evidence-kick"><div><span>TRACEABLE INTELLIGENCE</span><h3>{countEngineEvidence(ledger,current.id,currentProject?.id)} manual records for this element</h3><p>Capture what happened, the source, why it matters and the next action. This ledger lives only in your browser.</p></div><button onClick={()=>setTab("evidence")}>Inspect evidence <ArrowRight size={16}/></button></div>
    {current.id===3&&opportunities.length>0&&<div className="vte-recent-findings"><h3>Recent observed technical issues</h3>{opportunities.slice(0,4).map(o=><div key={o.key}><span>{o.priority}</span><strong>{o.name}</strong><small>{cleanHost(o.url)}</small></div>)}</div>}
   </div>}
   {tab==="diagnostic"&&<EngineDiagnostic key={current.id} engine={current} projects={projects} onRecord={records=>{let next=ledger;for(const record of records)next=saveEngineEvidence(next,record);return persist(next);}}/>}
   {tab==="playbook"&&<div className="vte-playbook"><div><span className="eyebrow">FOUR DECISION QUESTIONS</span><ol>{current.diagnostic.map(q=><li key={q}>{q}</li>)}</ol></div><div><span className="eyebrow">REQUIRED EVIDENCE INPUTS</span>{current.inputs.map(input=><p key={input}><ChevronRight size={14}/>{input}</p>)}<div className="vte-playbook-steps">OBSERVE <ArrowRight size={12}/> EXPLAIN <ArrowRight size={12}/> PRIORITISE <ArrowRight size={12}/> ACT <ArrowRight size={12}/> VERIFY</div></div><button onClick={()=>setTab("evidence")} className="vte-primary">Record an observation <Plus size={15}/></button></div>}
   {tab==="evidence"&&<div className="vte-ledger">
    <div className="vte-ledger-head"><div><span className="eyebrow">SOURCE-CENTRED INTELLIGENCE</span><h3>Evidence ledger <small>{allRecords.length} records</small></h3></div><div className="vte-ledger-actions"><button onClick={()=>exportRecords(ledger)} disabled={!ledger.records.length&&!recovery}><Download size={14}/> Export</button><button onClick={()=>file.current?.click()}><Upload size={14}/> Import</button><button className="vte-primary" disabled={!available||recovery} onClick={()=>setEditing(v=>!v)}><Plus size={14}/>{editing?"Close form":"Add evidence"}</button></div></div>
    <input ref={file} type="file" accept=".json" hidden onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>3_000_000)throw Error("Backup exceeds 3 MB.");const incoming=parseEngineLedger(await f.text(),projects.map(p=>p.id));if(!window.confirm("Replace the existing VisTa engine evidence in this browser? Export it first if needed."))return;if(persist(incoming,true))setMessage("Valid evidence backup imported.");}catch(err){setMessage(err instanceof Error?err.message:"Import failed.");}finally{e.target.value="";}}}/>
    {recovery&&<div className="vte-warning" role="alert"><CircleHelp size={17}/> Saved evidence needs recovery. Export the original file before importing a valid replacement. <button onClick={()=>{const raw=localStorage.getItem(engineLedgerKey)||"{}";const url=URL.createObjectURL(new Blob([raw],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="VisTa Original Evidence Recovery.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Download original</button></div>}
    {message&&<div className="vte-message" role="status">{message}<button onClick={()=>setMessage("")} aria-label="Dismiss message"><X size={13}/></button></div>}
    {!available&&<div className="vte-warning"><CircleHelp size={16}/> Create a local project before recording evidence. <button onClick={()=>onNavigate("workspace","Projects")}>Open projects</button></div>}
    {editing&&available&&!recovery&&<form className="vte-evidence-form" onSubmit={add}>
     <label>Project<select name="project" defaultValue={currentProject?.id||preferredProject()||projects[0].id} required>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
     <label>Observation title<input name="title" maxLength={180} placeholder="Specific and verifiable claim" required/></label>
     <label>Type<select name="kind"><option>Finding</option><option>Opportunity</option><option>Risk</option><option>Outcome</option></select></label>
     <label>Date observed<input type="date" name="date" defaultValue={new Date().toISOString().slice(0,10)} required/></label>
     <label className="vte-wide">Public source link (optional)<input type="url" name="source" maxLength={2048} placeholder="https://..."/></label>
     <label className="vte-wide">Supporting evidence<textarea name="details" maxLength={3000} rows={3} required placeholder="Document the exact observation, source context and limits"/></label>
     <label className="vte-wide">Why it matters<textarea name="implication" maxLength={1600} rows={2} placeholder="Explain a grounded business or technical implication"/></label>
     <label className="vte-wide">Recommended next step<textarea name="nextAction" maxLength={1200} rows={2} placeholder="An action that can be independently checked"/></label>
     <button className="vte-primary" type="submit">Save observed evidence <Check size={15}/></button>
    </form>}
    <div className="vte-ledger-filter"><label htmlFor="vte-ledger-search">Find evidence</label><input id="vte-ledger-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search observations, impacts and actions"/></div>
    <div className="vte-record-list">{recency.map(record=><article className="vte-record" key={record.id}><div className="vte-record-title"><span>{record.kind} · {new Date(record.observedAt).toLocaleDateString("en-GB")}</span><h4>{record.title}</h4><p>{projects.find(p=>p.id===record.projectId)?.name||"Project"}</p></div><p>{record.details}</p>{record.implication&&<div className="vte-record-detail"><strong>Implication</strong><span>{record.implication}</span></div>}{record.nextAction&&<div className="vte-record-detail"><strong>Next action</strong><span>{record.nextAction}</span></div>}{record.source&&<a href={record.source} target="_blank" rel="noopener noreferrer" className="vte-source">{cleanHost(record.source)} <ArrowUpRight size={13}/></a>}<div className="vte-record-controls"><label>Record stage <select value={record.stage} onChange={e=>setStage(record,e.target.value as EvidenceStage)}>{(["Observed","Hypothesis","Action planned","User-verified"] as const).map(s=><option key={s}>{s}</option>)}</select></label><button onClick={()=>{if(window.confirm("Delete this observation from the browser?"))persist(removeEngineEvidence(ledger,record.id));}}><Trash2 size={13}/> Delete</button></div></article>)}
    {!recency.length&&<div className="vte-empty"><FileText size={26}/><h4>No matching observations yet.</h4><p>{query?"Try another term.":"Capture your first dated, source-aware observation in this element."}</p></div>}
    </div>
    <p className="vte-local-note">Records are browser-local and can be lost if browser data is cleared. Export backups regularly. User-verified records are user attestations, not automated verification. Do not store sensitive customer data here.</p>
   </div>}
  </div>
 </section>;
}
