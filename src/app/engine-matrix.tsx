'use client';
import {useEffect,useState} from "react";
import {Activity,ArrowUpRight,BookOpen,Layers3,RadioTower,ScanLine,Search,ShieldCheck,Sparkles,Target} from "lucide-react";
import type {Workspace} from "@/lib/workspace";
import type {EngineId} from "@/lib/engine-methods";
import {engineMethods,engineSummary} from "@/lib/engine-methods";
import {emptyEngineLedger,parseEngineLedger,engineLedgerKey,countEngineEvidence,type EngineLedger} from "@/lib/engine-evidence";
import "./engine-matrix.css";
const icons=[Search,Target,ScanLine,BookOpen,ShieldCheck,RadioTower,Layers3,Activity,Sparkles] as const;
export default function EngineMatrix({workspace,onSelect}:{workspace:Workspace;onSelect:(id:EngineId)=>void}){
 const [ledger,setLedger]=useState<EngineLedger>(emptyEngineLedger);
 const [recovery,setRecovery]=useState(false);
 useEffect(()=>{
  const load=()=>{try{const raw=localStorage.getItem(engineLedgerKey);setLedger(raw?parseEngineLedger(raw):emptyEngineLedger());setRecovery(false);}catch{setRecovery(true);}};
  load();window.addEventListener("storage",load);window.addEventListener("vista-engine-update",load);
  return()=>{window.removeEventListener("storage",load);window.removeEventListener("vista-engine-update",load);};
 },[]);
 return <section className="vte-matrix" aria-labelledby="vte-matrix-heading">
  <div className="vte-matrix-heading"><div><span className="eyebrow">ONE LIVING SYSTEM / NINE ELEMENTS</span><h2 id="vte-matrix-heading">The intelligence architecture.</h2><p>Each dimension has a distinct job. Together, they connect observations, interpretation and action.</p></div><span className="vte-matrix-connection"><i/> SOURCE STATUS SHOWN PER ELEMENT</span></div>
  {recovery&&<p className="vte-matrix-recovery" role="alert">Evidence records need recovery in the VisTa ecosystem workspace.</p>}
  <div className="vte-matrix-grid">
   {engineMethods.map((engine,i)=>{
    const Icon=icons[i],summary=engineSummary(engine.id,workspace),manual=countEngineEvidence(ledger,engine.id);
    const state=engine.id===3?"SITE AUDITS LIVE":engine.id===4||engine.id===7||engine.id===8||engine.id===9?"PARTIAL TOOLS":"SOURCE NOT CONNECTED";
    return <button key={engine.id} onClick={()=>onSelect(engine.id)} aria-label={"Open "+engine.name+" engine"} className="vte-matrix-cell">
     <div className="vte-matrix-cell-top"><span className="vte-matrix-icon"><Icon size={19}/></span><span>{String(engine.id).padStart(2,"0")} / {engine.pillar}</span><ArrowUpRight size={15}/></div>
     <h3>{engine.name}</h3><p>{engine.short}</p>
     <div className="vte-matrix-progress"><span>{summary.value===null?"—":summary.value}</span><span>{summary.value===null?"Connected measurements":summary.label}</span></div>
     <div className="vte-matrix-bottom"><span>{manual} manually documented</span><small>{state}</small></div>
    </button>;
   })}
  </div>
 </section>;
}
