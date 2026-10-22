'use client';
import { useState } from 'react';
import { ArrowRight, Download, CheckCircle2, Clock3, Target } from 'lucide-react';
import { projectActions, actionBrief, type ProjectAction } from '@/lib/actions';
import type { Workspace, ActionPlan } from '@/lib/workspace';

type Props={data:Workspace;projectId:string;persist:(next:Workspace)=>boolean;scan:()=>void;busy:boolean;onBrief:()=>void;notify:(message:string)=>void};
export default function ActionBoard({data,projectId,persist,scan,busy,onBrief,notify}:Props){
  const [filter,setFilter]=useState('All');
  const [query,setQuery]=useState('');
  const [expanded,setExpanded]=useState('');
  const actions=projectActions(data,projectId);
  const project=data.projects.find(p=>p.id===projectId)!;
  const now=new Date();
  const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const overdue=(a:ProjectAction)=>a.stage!=='Verified'&&!!a.plan.due&&a.plan.due<today;
  const shown=actions.filter(a=>(filter==='All'||(filter==='Overdue'?overdue(a):a.stage===filter))&&[a.signal.name,a.plan.owner,a.url].some(v=>v.toLowerCase().includes(query.toLowerCase())));
  function update(action:ProjectAction,patch:Partial<ActionPlan>){
    const plan={...action.plan,...patch,evidenceAt:patch.stage?action.inspectedAt:action.plan.evidenceAt};
    return persist({...data,actionPlans:[...(data.actionPlans||[]).filter(a=>a.key!==action.key),plan]});
  }
  function exportBoard(){
    const body=`# ${project.name}: action register\n\n${actions.map(a=>`## ${a.signal.name}\nStatus: ${a.stage}\nPriority: ${a.signal.status==='issue'?'High':'Review'}\nPage: ${a.url}\nOwner: ${a.plan.owner||'Unassigned'}\nDue: ${a.plan.due||'Unscheduled'}\nEvidence: ${a.signal.detail}\nRecommendation: ${a.signal.recommendation}\nNotes: ${a.plan.notes||'None'}\n`).join('\n')}`;
    const url=URL.createObjectURL(new Blob([body],{type:'text/markdown'}));const link=document.createElement('a');link.href=url;link.download='Vista Action Register.md';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <div className="action-workspace">
    <div className="workspace-card action-intro"><div><span className="section-overline">EVIDENCE INTO EXECUTION</span><h2>Make the next move count.</h2><p>Assign the work. Track the change. Verify it against fresh evidence.</p></div><button className="primary-button" disabled={busy} onClick={scan}>{busy?'Analysing…':'Rescan project website'}<ArrowRight size={16}/></button></div>
    <div className="workspace-metrics"><div><Target size={18}/><span>OPEN ACTIONS</span><strong>{actions.filter(a=>a.stage!=='Verified').length}</strong></div><div><Clock3 size={18}/><span>AWAITING VERIFICATION</span><strong>{actions.filter(a=>a.stage==='Ready for verification').length}</strong></div><div><CheckCircle2 size={18}/><span>VERIFIED SIGNALS</span><strong>{actions.filter(a=>a.stage==='Verified').length}</strong></div><div><span>OVERDUE</span><strong>{actions.filter(overdue).length}</strong><small>Based on your due dates</small></div></div>
    <div className="action-controls"><label>Find an action<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search signal, owner or page"/></label><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Planned','In progress','Ready for verification','Needs attention','Verified','Overdue'].map(s=><option key={s}>{s}</option>)}</select></label><button disabled={!actions.length} onClick={exportBoard}><Download size={15}/> Export register</button></div>
    {!actions.length&&<div className="workspace-card"><h3>{data.snapshots.some(s=>s.projectId===projectId)?'No open findings.':'Build your evidence baseline.'}</h3><p>Run an audit to identify actionable HTML findings for this project.</p></div>}
    {!!actions.length&&!shown.length&&<p role="status">No actions match these filters.</p>}
    <div className="action-list">{shown.map(action=><article className={'workspace-card action-card '+(action.stage==='Verified'?'verified':'')} key={action.key}>
      <div className="action-card-heading"><span className={'action-priority '+action.signal.status}>{action.signal.status==='issue'?'HIGH PRIORITY':action.stage==='Verified'?'CHECK PASSED':'REVIEW'}</span><span className="action-stage">{action.stage}</span></div>
      <h3>{action.signal.name}</h3><p>{action.signal.recommendation}</p><a className="action-page" href={action.url} target="_blank" rel="noopener noreferrer">{action.url}<ArrowRight size={12}/></a>
      <div className="action-evidence"><small>OBSERVED EVIDENCE</small><p>{action.signal.detail}</p><time dateTime={action.inspectedAt}>{new Date(action.inspectedAt).toLocaleString('en-GB')}</time></div>
      <div className="action-assignment"><span>{action.plan.owner||'Unassigned'}</span><span className={overdue(action)?'overdue':''}>{action.plan.due?`${overdue(action)?'Overdue · ': 'Due · '}${action.plan.due}`:'No due date'}</span></div>
      <div className="action-buttons"><button aria-expanded={expanded===action.key} onClick={()=>setExpanded(expanded===action.key?'':action.key)}>{expanded===action.key?'Close details':'Manage action'}</button><button onClick={()=>{const brief={id:crypto.randomUUID(),projectId,topic:`${action.signal.name}: ${project.name}`,intent:'Evidence-led improvement',audience:project.audience,outline:actionBrief(action,project),status:'Draft' as const};if(persist({...data,briefs:[brief,...data.briefs]})){notify('Evidence brief created in your editorial pipeline.');onBrief();}}}>Create evidence brief<ArrowRight size={14}/></button></div>
      {expanded===action.key&&<form key={action.key+action.stage} className="workspace-form action-editor" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);if(update(action,{owner:String(f.get('owner')).trim(),due:String(f.get('due')),notes:String(f.get('notes')),stage:action.stage==='Verified'?action.plan.stage:String(f.get('stage')) as ActionPlan['stage']}))notify('Action saved.');}}>
        <label>Owner<input name="owner" defaultValue={action.plan.owner} maxLength={120} placeholder="Person responsible"/></label><label>Due date<input type="date" name="due" defaultValue={action.plan.due}/></label>
        <label>Delivery stage<select name="stage" defaultValue={action.stage==='Needs attention'?'In progress':action.plan.stage} disabled={action.stage==='Verified'}><option>Planned</option><option>In progress</option><option>Ready for verification</option></select></label>
        <label>Implementation notes<textarea name="notes" rows={4} defaultValue={action.plan.notes} maxLength={10000} placeholder="Changes made, decisions and evidence"/></label>
        <p className="workspace-note">Verification comes from a passing scan of this exact page. A later failing scan reopens work marked ready. The rescan button scans the project website; use Site intelligence to scan other page addresses and save their results.</p><button className="primary-button">Save action</button>
      </form>}
    </article>)}</div>
    <p className="workspace-note">Owners are labels only and receive no notifications. Dates and notes are stored in this browser and included in workspace backups.</p>
  </div>;
}
