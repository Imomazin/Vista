'use client';
import {useState} from "react";
import {Check,ChevronRight,Plus,ShieldAlert} from "lucide-react";
import type {EngineMethod} from "@/lib/engine-methods";
import {diagnosticActions} from "@/lib/engine-diagnostic-actions";
import type {EngineEvidence} from "@/lib/engine-evidence";
import type {Workspace} from "@/lib/workspace";

type Answer="yes"|"gap"|"unknown";
export default function EngineDiagnostic({engine,projects,onRecord}:{engine:EngineMethod;projects:Workspace["projects"];onRecord:(records:EngineEvidence[])=>boolean}){
 const [answers,setAnswers]=useState<Record<number,Answer>>({});
 const [projectId,setProjectId]=useState(projects[0]?.id||"");
 const [source,setSource]=useState("");
 const [message,setMessage]=useState("");
 const answered=Object.keys(answers).length;
 const gaps=Object.values(answers).filter(x=>x==="gap").length;
 const ready=projects.some(p=>p.id===projectId);
 function save(){
  if(!ready){setMessage("Choose an existing project before saving.");return;}
  if(source){try{const u=new URL(source);if(u.protocol!=="https:"||u.username||u.password)throw Error();}catch{setMessage("Source must be a public HTTPS link or left empty.");return;}}
  const included=engine.diagnostic.map((question,i)=>({question,answer:answers[i],next:diagnosticActions[engine.id][i]})).filter(x=>x.answer&&x.answer!=="unknown");
  if(!included.length){setMessage("Select at least one evidenced or potential gap to save.");return;}
  const now=new Date().toISOString();
  const records:EngineEvidence[]=included.map((item,i)=>({
   id:crypto.randomUUID(),engineId:engine.id,projectId,title:(item.answer==="gap"?"Self-assessed gap: ":"Self-reported confirmation: ")+item.question,
   kind:item.answer==="gap"?"Risk":"Finding",source,details:"Self-assessment only. Question: "+item.question+" Response: "+(item.answer==="gap"?"Gap identified":"Reported as supported")+". Evidence requires independent verification.",
   implication:item.answer==="gap"?"Possible weakness for investigation; commercial impact is not measured.":"The reported condition should be checked against the source and periodically revalidated.",
   nextAction:item.next,observedAt:now,savedAt:now,stage:"Hypothesis"
  }));
  if(onRecord(records)){setAnswers({});setSource("");setMessage(records.length+" self-assessment observation"+(records.length===1?"":"s")+" saved to the evidence ledger.");}
 }
 return <div className="vte-diagnostic">
  <div className="vte-diagnostic-heading"><div><span className="eyebrow">DEEP VALUE / GUIDED SELF-ASSESSMENT</span><h3>{engine.name}: where is the opportunity?</h3><p>Answer four diagnostic questions, document assumptions and generate actionable investigation records. These answers are self-reported and are not live measurements.</p></div><div className="vte-diagnostic-progress"><strong>{answered} / 4</strong><span>QUESTIONS REVIEWED</span><small>{gaps} potential gaps identified</small></div></div>
  <div className="vte-diagnostic-questions">
   {engine.diagnostic.map((question,i)=><div className="vte-diagnostic-question" key={i}>
    <div className="vte-diagnostic-q"><span>{String(i+1).padStart(2,"0")}</span><div><h4>{question}</h4><p><ChevronRight size={13}/>{diagnosticActions[engine.id][i]}</p></div></div>
    <fieldset aria-label={question}><legend className="sr-only">Select the self-assessed status</legend>
     {([{v:"yes",text:"Evidence confirmed"},{v:"gap",text:"Gap identified"},{v:"unknown",text:"Not assessed"}] as const).map(option=><label key={option.v} className={answers[i]===option.v?"chosen":""}><input type="radio" name={"diagnostic-"+engine.id+"-"+i} checked={answers[i]===option.v} onChange={()=>{setAnswers(previous=>({...previous,[i]:option.v}));setMessage("");}}/><span>{option.text}</span></label>)}
    </fieldset>
   </div>)}
  </div>
  <div className="vte-diagnostic-save"><div><label htmlFor="diagnostic-project">Project</label><select id="diagnostic-project" value={ready?projectId:""} onChange={e=>setProjectId(e.target.value)}><option value="">Choose a project</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div><label htmlFor="diagnostic-source">Supporting source (optional)</label><input id="diagnostic-source" value={source} onChange={e=>setSource(e.target.value)} placeholder="https://…" type="url"/></div><button className="vte-primary" onClick={save} disabled={!ready||!Object.keys(answers).length}><Plus size={15}/> Save review to evidence</button></div>
  {message&&<p className="vte-message" role="status">{message}</p>}
  <p className="vte-diagnostic-note"><ShieldAlert size={14}/> Entries are marked Hypothesis and require verification. No rankings, traffic, financial results or AI citations are inferred from responses.</p>
 </div>;
}
