import {parseEngineLedger, type EngineLedger} from './engine-evidence';
import type {EngineId} from './engine-methods';
export const decisionKey='vista-decisions';
export const stages=['Proposed','Approved','In progress','Awaiting verification','Verified','Learned'] as const;
export type DecisionStage=typeof stages[number];
export type Decision={id:string;projectId:string;title:string;evidenceIds:string[];owner:string;due:string;hypothesis:string;alternative:string;verification:string;outcome:string;lesson:string;verificationSource:string;stage:DecisionStage;createdAt:string;updatedAt:string;history:{stage:DecisionStage;at:string;note:string}[]};
export type DecisionBook={version:1;records:Decision[]};
export const emptyDecisionBook=():DecisionBook=>({version:1,records:[]});
export function parseDecisions(raw:string,ledger?:EngineLedger):DecisionBook{
 if(raw.length>2_000_000)throw Error('Decision backup exceeds 2 MB.');
 const x=JSON.parse(raw);if(!x||x.version!==1||!Array.isArray(x.records)||x.records.length>500)throw Error('Invalid decision register.');
 const ids=new Set();for(const r of x.records){
  if(!r||!['id','projectId','title','owner','due','hypothesis','alternative','verification','outcome','lesson','verificationSource','createdAt','updatedAt'].every(k=>typeof r[k]==='string'&&r[k].length<=4000)||!r.id||!r.projectId||!r.title.trim()||ids.has(r.id))throw Error('Invalid or duplicate decision.');ids.add(r.id);
  if(!stages.includes(r.stage)||!Number.isFinite(Date.parse(r.createdAt))||!Number.isFinite(Date.parse(r.updatedAt))||!Array.isArray(r.evidenceIds)||!r.evidenceIds.length||r.evidenceIds.length>100||!r.evidenceIds.every((id:unknown)=>typeof id==='string')||new Set(r.evidenceIds).size!==r.evidenceIds.length)throw Error('Invalid decision evidence or stage.');
  if(r.due&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.due)||!Number.isFinite(Date.parse(r.due))||new Date(r.due).toISOString().slice(0,10)!==r.due))throw Error('Invalid review date.');
  if(r.verificationSource){const u=new URL(r.verificationSource);if(u.protocol!=='https:'||u.username||u.password)throw Error('Verification requires an HTTPS source.');}
  if(!Array.isArray(r.history)||r.history.length>100||!r.history.every((h:Decision['history'][number])=>h&&stages.includes(h.stage)&&typeof h.note==='string'&&h.note.length<=4000&&Number.isFinite(Date.parse(h.at))))throw Error('Invalid decision history.');
  if(ledger&&r.evidenceIds.some((id:string)=>!ledger.records.some(e=>e.id===id&&e.projectId===r.projectId)))throw Error('Decisions cannot reference missing evidence or another project.');
  if(r.stage!=='Proposed'&&(!r.owner.trim()||!r.verification.trim()||!r.hypothesis.trim()||!r.alternative.trim()))throw Error('Approval requires an owner, hypothesis, alternative and verification plan.');
  if(['Verified','Learned'].includes(r.stage)&&(!r.outcome.trim()||!r.verificationSource))throw Error('Verification needs an outcome and supporting source.');
  if(r.stage==='Learned'&&!r.lesson.trim())throw Error('Record the lesson before completing the loop.');
 }
 return x;
}
export function advanceDecision(record:Decision,next:DecisionStage,at=new Date().toISOString()):Decision{
 if(stages.indexOf(next)!==stages.indexOf(record.stage)+1)throw Error('Complete the current decision checkpoint first.');
 const result={...record,stage:next,updatedAt:at,history:[...record.history,{stage:next,at,note:next==='Verified'?record.outcome:next==='Learned'?record.lesson:record.verification}]};
 parseDecisions(JSON.stringify({version:1,records:[result]}));return result;
}
/** Same-source relationships are evidence links, never proof of causation. */
export function evidenceLinks(ledger:EngineLedger,projectId:string){
 const records=ledger.records.filter(r=>r.projectId===projectId&&r.source);
 const groups=new Map<string,typeof records>();for(const r of records){const url=new URL(r.source);url.hash='';const key=url.href;groups.set(key,[...(groups.get(key)||[]),r]);}
 return [...groups].filter(([,rs])=>rs.length>1).map(([source,rs])=>({source,records:rs,engines:[...new Set(rs.map(r=>r.engineId))]}));
}
export function retrieveEvidence(ledger:EngineLedger,projectId:string,query:string,engineId?:EngineId){
 const terms=[...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])].slice(0,20);
 if(!terms.length)return [];
 return parseEngineLedger(JSON.stringify(ledger)).records.filter(r=>r.projectId===projectId&&(!engineId||r.engineId===engineId)).map(r=>({record:r,matches:terms.filter(t=>(r.title+' '+r.details+' '+r.implication+' '+r.nextAction).toLowerCase().includes(t)).length})).filter(r=>r.matches>0).sort((a,b)=>b.matches-a.matches||Date.parse(b.record.observedAt)-Date.parse(a.record.observedAt)).slice(0,10);
}
