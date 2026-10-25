import type {EngineId} from "./engine-methods";

export type EvidenceStage="Observed"|"Hypothesis"|"Action planned"|"User-verified";
export type EvidenceKind="Opportunity"|"Risk"|"Finding"|"Outcome";
export type EngineEvidence={
 id:string; engineId:EngineId; projectId:string; title:string;kind:EvidenceKind;
 source:string; details:string; implication:string; nextAction:string;
 observedAt:string; savedAt:string; stage:EvidenceStage;
};
export type EngineLedger={version:1;records:EngineEvidence[]};
export const engineLedgerKey="vista-engine-evidence";
export const emptyEngineLedger=():EngineLedger=>({version:1,records:[]});
const validRecord=(x:unknown):x is Record<string,unknown>=>typeof x==="object"&&x!==null&&!Array.isArray(x);
const stages:EvidenceStage[]=["Observed","Hypothesis","Action planned","User-verified"];
const kinds:EvidenceKind[]=["Opportunity","Risk","Finding","Outcome"];
export function parseEngineLedger(raw:string,allowedProjects?:string[]):EngineLedger{
 if(raw.length>3_000_000)throw new Error("Evidence backup exceeds the supported size.");
 const obj:unknown=JSON.parse(raw);
 if(!validRecord(obj)||obj.version!==1||!Array.isArray(obj.records)||obj.records.length>1200)throw new Error("Unsupported VisTa evidence format.");
 const ids=new Set<string>();
 const valid=obj.records.every((r:unknown)=>{
  if(!validRecord(r))return false;
  const limits:{[key:string]:number}={id:80,projectId:80,title:180,source:2048,details:3000,implication:1600,nextAction:1200,observedAt:60,savedAt:60};
  if(!Object.entries(limits).every(([k,n])=>typeof r[k]==="string"&&(r[k] as string).length<=n))return false;
  if(!(Number.isInteger(r.engineId)&&Number(r.engineId)>=1&&Number(r.engineId)<=9))return false;
  if(!stages.includes(r.stage as EvidenceStage)||!kinds.includes(r.kind as EvidenceKind))return false;
  if(!(r.id as string)||(ids.has(r.id as string)))return false;
  ids.add(r.id as string);
  if(!(r.title as string).trim()||!(r.projectId as string).trim())return false;
  if(allowedProjects&&!allowedProjects.includes(r.projectId as string))return false;
  if(!Number.isFinite(Date.parse(r.observedAt as string))||!Number.isFinite(Date.parse(r.savedAt as string)))return false;
  if(r.source){
   try{const url=new URL(r.source as string);if(url.protocol!=="https:"||url.username||url.password)return false;}catch{return false;}
  }
  return true;
 });
 if(!valid)throw new Error("Evidence file contains invalid or duplicate records.");
 return obj as EngineLedger;
}
export function saveEngineEvidence(ledger:EngineLedger,evidence:EngineEvidence):EngineLedger{
 const next:EngineLedger={version:1,records:[evidence,...ledger.records.filter(r=>r.id!==evidence.id)]};
 return parseEngineLedger(JSON.stringify(next));
}
export function removeEngineEvidence(ledger:EngineLedger,id:string):EngineLedger{
 return {...ledger,records:ledger.records.filter(r=>r.id!==id)};
}
export function countEngineEvidence(ledger:EngineLedger,engineId:EngineId,projectId?:string){
 return ledger.records.filter(r=>r.engineId===engineId&&(!projectId||r.projectId===projectId)).length;
}
