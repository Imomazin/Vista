'use client';

import { useMemo, useState } from 'react';
import { Activity, ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, Clock3, Download, FileText, Globe2, Layers3, Radar, ScanLine, ShieldCheck, Sparkles, Target } from 'lucide-react';
import type { Workspace } from '@/lib/workspace';
import type { View, WorkspaceTab } from '@/lib/navigation';
import { buildOpportunities, latestProjectSnapshots, technicalTrend } from '@/lib/opportunities';
import './pulse.css';

type Props = {
  data: Workspace;
  onNavigate: (view: View, tab?: WorkspaceTab) => void;
};

const niceDate = (date: string) => new Date(date).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'numeric'});
const host = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
};

function Trend({ values }: {values: {at:string; score:number}[]}) {
  if(values.length < 2) return <p className="pulse-trend-empty">A second scan of the same page will establish its technical trend.</p>;
  const points=values.slice(-12);
  const coords=points.map((v,i)=>{
    const x=8+(i/(points.length-1))*284;
    const y=77-(v.score/100)*62;
    return [x,y] as const;
  });
  const line=coords.map(p=>p.join(',')).join(' ');
  return <div className="pulse-trend-chart">
    <svg viewBox="0 0 300 94" role="img" aria-label={'Observed HTML audit scores: '+points.map(v=>v.score).join(', ')}>
      {[25,50,75,100].map(n=><line key={n} x1="5" y1={77-(n/100)*62} x2="295" y2={77-(n/100)*62} stroke="#ffffff13" strokeDasharray="3 5"/>)}
      <polyline points={line} fill="none" stroke="#a4ffdb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
      {coords.map((p,i)=><circle key={i} cx={p[0]} cy={p[1]} r={i===coords.length-1?4:2.5} fill={i===coords.length-1?'#f4fff8':'#a4ffdb'} stroke="#10231e" strokeWidth="2"/>)}
    </svg>
    <div className="pulse-trend-labels"><span>{niceDate(points[0].at)}</span><span>{niceDate(points[points.length-1].at)}</span></div>
  </div>;
}

export default function VistaPulse({data, onNavigate}:Props) {
  const [projectId,setProjectId]=useState('all');
  const [filter,setFilter]=useState<'all'|'issue'|'warning'>('all');
  const [focused,setFocused]=useState<string|null>(null);
  const [tab,setTab]=useState<'radar'|'timeline'|'evidence'>('radar');
  const selection = data.projects.some(p=>p.id===projectId)?projectId:'all';
  const opportunities=useMemo(()=>buildOpportunities(data,selection==='all'?undefined:selection),[data,selection]);
  const latest=useMemo(()=>latestProjectSnapshots(data,selection==='all'?undefined:selection),[data,selection]);
  const shown=opportunities.filter(o=>filter==='all'||o.status===filter);
  const chosen=shown.find(o=>o.key===focused)||shown[0];
  const observations=data.observations.filter(o=>selection==='all'||o.projectId===selection);
  const briefs=data.briefs.filter(b=>selection==='all'||b.projectId===selection);
  const sources=latest.length;
  const issues=opportunities.filter(o=>o.status==='issue').length;
  const score=latest.length?Math.round(latest.reduce((total,item)=>total+item.report.technicalScore,0)/latest.length):null;
  const forTrend=latest[0];
  const trend=forTrend?technicalTrend(data,forTrend.projectId,forTrend.report.url):[];
  const events=[
    ...data.snapshots.filter(s=>selection==='all'||s.projectId===selection).map(s=>({id:s.id,kind:'scan',date:s.report.inspectedAt,subject:host(s.report.url),detail:'HTML evidence · '+s.report.technicalScore+'/100',url:s.report.url})),
    ...observations.map(o=>({id:o.id,kind:'ai',date:o.observedAt,subject:o.provider,detail:'Manual AI response observation'+(o.mentioned?' · brand mentioned':''),url:o.source})),
  ].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,9);
  const geometry=shown.slice(0,14).map((o,i)=>{
    const angle=-Math.PI/2+i*2.399963229728653;
    const radius=26+(i%4)*7;
    return {opportunity:o,x:50+Math.cos(angle)*radius*.81,y:50+Math.sin(angle)*radius*.81};
  });

  function exportEvidence() {
    const payload={title:'Vista Evidence Register',method:'Technical priority is based only on the severity and recurrence of observed HTML findings. It is not a forecast of ranking, traffic, sales or AI visibility.',exportedAt:new Date().toISOString(),project:selection,scannedPages:latest.map(s=>({projectId:s.projectId,url:s.report.url,inspectedAt:s.report.inspectedAt,htmlScore:s.report.technicalScore})),opportunities,observations:observations.map(o=>({provider:o.provider,observedAt:o.observedAt,prompt:o.prompt,mentioned:o.mentioned,source:o.source}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='Vista Evidence Register.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  return <section className="vista-pulse" aria-labelledby="vista-pulse-title">
    <div className="pulse-top">
      <div><span className="pulse-overline"><Activity size={13}/> VISTA / LIVE WORKSPACE EVIDENCE</span><h2 id="vista-pulse-title">The intelligence <em>pulse.</em></h2><p>One view of your observed signals, priorities and next moves.</p></div>
      <div className="pulse-tools">
        <label htmlFor="pulse-project">Scope</label>
        <select id="pulse-project" value={selection} onChange={e=>{setProjectId(e.target.value);setFocused(null);}} aria-label="Choose a project for intelligence overview">
          <option value="all">All projects</option>
          {data.projects.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}
        </select>
        <button className="pulse-export" disabled={!latest.length&&!observations.length} onClick={exportEvidence}><Download size={15}/> Export evidence</button>
      </div>
    </div>
    <div className="pulse-indicators" aria-label="Evidence summary">
      <div className="pulse-indicator"><span><ScanLine size={15}/> ANALYSED PAGES</span><strong>{sources.toLocaleString('en-GB')}</strong><small>Latest saved scan per page</small></div>
      <div className="pulse-indicator"><span><CircleAlert size={15}/> PRIORITY FINDINGS</span><strong>{issues.toLocaleString('en-GB')}</strong><small>Observed HTML issues</small></div>
      <div className="pulse-indicator"><span><Activity size={15}/> HTML HEALTH</span><strong>{score===null?'—':score+'/100'}</strong><small>{score===null?'Awaiting first audit':'Mean of latest page checks'}</small></div>
      <div className="pulse-indicator"><span><Radar size={15}/> AI OBSERVATIONS</span><strong>{observations.length.toLocaleString('en-GB')}</strong><small>Manually recorded samples</small></div>
    </div>
    <div className="pulse-content-grid">
      <article className="pulse-observatory">
        <div className="pulse-card-title"><div><span className="pulse-overline">DECISION INTELLIGENCE</span><h3>{tab==='radar'?'Opportunity radar':tab==='timeline'?'Signal timeline':'Evidence pathways'}</h3></div><div className="pulse-tabs" aria-label="Intelligence display">
          {(['radar','timeline','evidence'] as const).map(t=><button key={t} className={tab===t?'selected':''} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t==='radar'?'Radar':t==='timeline'?'Timeline':'Evidence'}</button>)}
        </div></div>
        {tab==='radar'&&<div className="pulse-radar-layout">
          <div className="pulse-radar-visual">
            <div className="pulse-orbit orbit-one"/><div className="pulse-orbit orbit-two"/><div className="pulse-orbit orbit-three"/><div className="pulse-orbit orbit-four"/>
            <div className="pulse-axis horizontal"/><div className="pulse-axis vertical"/>
            <div className="pulse-radar-centre"><Sparkles size={19}/><strong>VISTA</strong><small>OBSERVED</small></div>
            {geometry.map((node,i)=><button key={node.opportunity.key} className={'pulse-radar-node '+(node.opportunity.key===chosen?.key?'focused ':'')+(node.opportunity.status==='issue'?'critical':'review')} style={{left:node.x+'%',top:node.y+'%'}} aria-label={node.opportunity.name+' on '+host(node.opportunity.url)} onClick={()=>setFocused(node.opportunity.key)} title={node.opportunity.name}><span/></button>)}
            {!geometry.length&&<span className="pulse-radar-wait">AWAITING OBSERVED SIGNALS</span>}
            <div className="pulse-orbit-caption">TECHNICAL SIGNAL SPACE / NOT A REVENUE FORECAST</div>
          </div>
          <div className="pulse-radar-insight">
            <span className="pulse-overline">SELECTED SIGNAL</span>
            {chosen?<><div className={'pulse-priority '+(chosen.status==='issue'?'urgent':'review')}><span/>{chosen.priority} · HTML evidence</div><h4>{chosen.name}</h4><p>{chosen.recommendation}</p><div className="pulse-meta"><span>{host(chosen.url)}</span><span>{niceDate(chosen.inspectedAt)}</span></div><button className="pulse-text-link" onClick={()=>onNavigate('workspace','Action board')}>Manage this finding <ArrowUpRight size={15}/></button></>
            :<><h4>Clarity begins with evidence.</h4><p>Run an investigation, save the findings and Vista will surface the recurring technical opportunities here.</p><button className="pulse-text-link" onClick={()=>onNavigate('investigation')}>Investigate a website <ArrowUpRight size={15}/></button></>}
          </div>
        </div>}
        {tab==='timeline'&&<div className="pulse-timeline">
          {!events.length&&<div className="pulse-empty"><Clock3 size={25}/><h4>No saved activity yet.</h4><p>Evidence from audits and manually recorded AI observations will appear here.</p></div>}
          {events.map(e=><div className="pulse-timeline-event" key={e.kind+e.id}><span className="timeline-marker"/><div><span className="pulse-overline">{e.kind==='scan'?'PAGE AUDIT':'AI OBSERVATION'} · {niceDate(e.date)}</span><h4>{e.subject}</h4><p>{e.detail}</p></div></div>)}
        </div>}
        {tab==='evidence'&&<div className="pulse-pathways">
          <div><span className="pulse-overline">01 / PROJECTS</span><strong>{selection==='all'?data.projects.length:1}</strong><p>Owned websites and objectives</p><FolderLink onClick={()=>onNavigate('workspace','Projects')}/></div>
          <ArrowRight className="pathway-arrow" size={20}/>
          <div><span className="pulse-overline">02 / OBSERVATIONS</span><strong>{sources}</strong><p>Latest verified HTML snapshots</p><FolderLink onClick={()=>onNavigate('workspace','Audit history')}/></div>
          <ArrowRight className="pathway-arrow" size={20}/>
          <div><span className="pulse-overline">03 / EXECUTION</span><strong>{opportunities.length}</strong><p>Observed findings for action</p><FolderLink onClick={()=>onNavigate('workspace','Action board')}/></div>
        </div>}
        <div className="pulse-footer-note"><ShieldCheck size={13}/> All displayed scores describe saved HTML checks. Search, revenue and AI rankings are not inferred.</div>
      </article>
      <article className="pulse-priorities">
        <div className="pulse-card-title"><div><span className="pulse-overline">ACTIONABLE EVIDENCE</span><h3>Your next moves</h3></div><Target size={19}/></div>
        <div className="pulse-filter" aria-label="Filter technical findings">{[{id:'all',text:'All'},{id:'issue',text:'Priority'},{id:'warning',text:'Review'}].map(item=><button key={item.id} aria-pressed={filter===item.id} className={filter===item.id?'active':''} onClick={()=>{setFilter(item.id as 'all'|'issue'|'warning');setFocused(null);}}>{item.text}</button>)}</div>
        <div className="pulse-priority-list">
          {shown.slice(0,5).map((op,i)=><button key={op.key} className={'pulse-priority-row '+(chosen?.key===op.key?'is-selected':'')} onClick={()=>{setFocused(op.key);setTab('radar');}}><span className="priority-index">{String(i+1).padStart(2,'0')}</span><span className="priority-copy"><strong>{op.name}</strong><small>{host(op.url)} · {op.affectedPages>1?op.affectedPages+' pages affected':'One page observed'}</small></span><span className={'priority-level '+(op.status==='issue'?'issue':'warning')}>{op.priority}</span></button>)}
          {!shown.length&&<div className="pulse-empty"><CheckCircle2 size={26}/><h4>{latest.length?'No findings in this filter.':'Your opportunity radar is ready.'}</h4><p>{latest.length?'Try another category or scan additional pages.':'Run a site scan and save the results to activate it.'}</p></div>}
        </div>
        <button className="pulse-primary-action" onClick={()=>onNavigate(opportunities.length?'workspace':'investigation','Action board')}>{opportunities.length?'Open action board':'Run a first investigation'} <ArrowUpRight size={16}/></button>
      </article>
    </div>
    <div className="pulse-bottom-grid">
      <div className="pulse-trend-panel"><div className="pulse-card-title"><div><span className="pulse-overline">OBSERVED PERFORMANCE</span><h3>Technical history</h3></div><Activity size={17}/></div><p>{forTrend?host(forTrend.report.url):'Awaiting your first saved page'}</p><Trend values={trend}/></div>
      <div className="pulse-connection-panel"><div className="pulse-card-title"><div><span className="pulse-overline">DATA PROVENANCE</span><h3>Intelligence sources</h3></div><Globe2 size={17}/></div><div className="pulse-source"><span><ScanLine size={15}/> Public HTML audits</span><small className={latest.length?'has-data':'not-connected'}>{latest.length?latest.length+' saved pages':'No evidence yet'}</small></div><div className="pulse-source"><span><Layers3 size={15}/> Google Search Console</span><small className="not-connected">Not connected</small></div><div className="pulse-source"><span><Activity size={15}/> Google Analytics</span><small className="not-connected">Not connected</small></div><button className="pulse-text-link" onClick={()=>onNavigate('workspace','Connections')}>View connections <ArrowUpRight size={14}/></button></div>
      <div className="pulse-studio-panel"><div className="pulse-card-title"><div><span className="pulse-overline">CONTENT & EXPERIMENTATION</span><h3>Move from signal to story</h3></div><FileText size={17}/></div><strong>{briefs.length}</strong><p>Editorial briefs in your selected scope.</p><button className="pulse-text-link" onClick={()=>onNavigate('workspace','Content studio')}>Open content studio <ArrowUpRight size={14}/></button></div>
    </div>
  </section>;
}
function FolderLink({onClick}:{onClick:()=>void}){return <button onClick={onClick} className="pulse-text-link">Open records <ArrowUpRight size={13}/></button>;}
