'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BrainCircuit } from 'lucide-react';
import { computeAnalysis } from '@/lib/intel/analysis';
import * as charts from '@/lib/intel/charts';
import { engineStatus } from '@/lib/intel/engine-status';
import type { Investigation } from '@/lib/intel/model';
import { listInvestigations } from '@/lib/intel/store';
import { preferredProject, type Workspace } from '@/lib/workspace';
import VistaChart from './vista-chart';
import { EvidenceBadge, Metric } from './studio-ui';
import './intel.css';

function useLatest(data: Workspace) {
  const [latest, setLatest] = useState<Investigation | null>(null);
  const [all, setAll] = useState<Investigation[]>([]);
  useEffect(() => {
    const load = () => listInvestigations().then(list => {
      const usable = list.filter(i => i.pages.length && data.projects.some(p => p.id === i.projectId));
      setAll(usable);
      const preferred = preferredProject();
      setLatest(usable.find(i => i.projectId === preferred) || usable[0] || null);
    });
    load();
    window.addEventListener('vista-intel-update', load);
    return () => window.removeEventListener('vista-intel-update', load);
  }, [data.projects]);
  return { latest, all };
}

/** Integrated cockpit in the Command Centre: combines evidence from all engines for the active client. */
export function CommandCockpit({ data, openStudio }: { data: Workspace; openStudio: (tab: string) => void }) {
  const { latest } = useLatest(data);
  const analysis = useMemo(() => (latest ? computeAnalysis(latest) : null), [latest]);
  const project = latest && data.projects.find(p => p.id === latest.projectId);
  if (!latest || !analysis) return <section className="command-cockpit empty reveal"><div><span className="eyebrow"><BrainCircuit size={14}/> STRATEGIC INTELLIGENCE COCKPIT</span><h2>One integrated perspective, built from evidence.</h2><p>Run an investigation in the SEO &amp; GEO Studio to combine technical, content, authority, competitive and AI visibility evidence into one cockpit.</p></div><button className="mint-button" onClick={() => openStudio('brief')}>Open the Studio<ArrowUpRight size={16}/></button></section>;
  const radar = charts.capabilityRadar(analysis.index);
  return <section className="command-cockpit reveal" aria-label="Strategic intelligence cockpit">
    <header><div><span className="eyebrow"><BrainCircuit size={14}/> STRATEGIC INTELLIGENCE COCKPIT · {project?.name}</span><h2>{analysis.index.index !== null ? 'Intelligence Index ' + analysis.index.index : 'Evidence-led view'} <em>for {latest.brief.website.replace(/^https?:\/\//, '')}</em></h2><p>{analysis.index.index !== null ? 'Range ' + analysis.index.range!.join('–') + ' · ' : ''}{Math.round(analysis.index.coverage * 100)}% evidence coverage · investigated {latest.updatedAt.slice(0, 10)}</p></div><button className="ghost-button" onClick={() => openStudio('cockpit')}>Open full cockpit<ArrowUpRight size={15}/></button></header>
    <div className="cockpit-grid">
      <div className="cockpit-dimensions">{analysis.index.dimensions.map(d => <div key={d.id} className="cockpit-dim"><span>{d.label}</span><strong>{d.score ?? '—'}</strong><span className="coverage-bar"><i style={{ width: Math.round(d.coverage * 100) + '%' }}/></span><EvidenceBadge kind={d.evidenceClass}/></div>)}</div>
      {radar ? <VistaChart spec={radar} height={300}/> : <p className="empty-copy">Too few evidence-backed dimensions for a capability profile.</p>}
      <div className="cockpit-priorities"><h3>Priority interventions</h3><ol>{analysis.interventions.slice(0, 4).map(i => <li key={i.id}><strong>{i.finding}</strong><small>{i.evidenceId} · {i.phase} days · {i.metric}</small></li>)}</ol><div className="metric-row compact"><Metric label="Critical + high" value={analysis.findings.filter(f => f.severity === 'critical' || f.severity === 'high').length}/><Metric label="AI mention rate" value={analysis.geo.n ? Math.round(analysis.geo.mentionRate.value * 100) : null} suffix="%" note={analysis.geo.n ? 'n=' + analysis.geo.n : 'Not sampled'}/></div><button className="link-button" onClick={() => openStudio('decisions')}>Open Decision Room</button> · <button className="link-button" onClick={() => openStudio('executive')}>Board presentation</button></div>
    </div>
  </section>;
}

/** Engine-specific analytical dashboard on each engine page. */
export function EngineDashboard({ engine, data, openStudio, openMeasurements }: { engine: number; data: Workspace; openStudio: (tab: string) => void; openMeasurements: () => void }) {
  const { latest, all } = useLatest(data);
  const analysis = useMemo(() => (latest ? computeAnalysis(latest) : null), [latest]);
  const status = engineStatus[engine];
  const specs = !latest || !analysis ? [] : ({
    1: [charts.gscOpportunity(latest), charts.kpiBullets(latest, analysis.site)],
    2: [charts.ga4Channels(latest)],
    3: [charts.crawlFunnel(latest, analysis.site), charts.issueHeatmap(latest), charts.responseSankey(latest)],
    4: [charts.contentTreemap(analysis.site), charts.readinessScatter(latest, analysis.site)],
    5: [charts.entityNetwork(latest)],
    6: [],
    7: [charts.portfolioChart(all.filter((i, idx) => all.findIndex(x => x.projectId === i.projectId) === idx).map(i => { const a = computeAnalysis(i); return { name: data.projects.find(p => p.id === i.projectId)?.name || i.brief.brand, index: a.index.index, coverage: a.index.coverage, findings: a.findings.length, critical: a.findings.filter(f => f.severity === 'critical' || f.severity === 'high').length }; })), charts.quadrant(analysis.interventions, 'impact-effort')],
    8: [charts.ga4Channels(latest), charts.gscOpportunity(latest)],
    9: [charts.geoCategoryChart(latest), charts.geoShareChart(latest), charts.geoOpportunityHeatmap(latest)],
  } as Record<number, (charts.ChartSpec | null)[]>)[engine].filter((s): s is charts.ChartSpec => !!s);
  const tab = { 1: 'technical', 2: 'search', 3: 'technical', 4: 'content', 5: 'authority', 6: 'authority', 7: 'portfolio', 8: 'search', 9: 'geo' }[engine] || 'cockpit';
  const engineFindings = analysis?.findings.filter(f => f.engine === engine) || [];
  return <section className="engine-dashboard" aria-label={'Engine ' + engine + ' analytical dashboard'}>
    <header><div><span className="eyebrow">ENGINE {String(engine).padStart(2, '0')} · ANALYTICAL DASHBOARD</span><h2>{status.label}</h2><p>{status.operational}</p><p className="dependency-note">{status.dependency}</p></div>{latest ? <button className="ghost-button" onClick={() => openStudio(tab)}>Explore in the Studio<ArrowUpRight size={15}/></button> : <button className="mint-button" onClick={() => openStudio('brief')}>Start an investigation<ArrowUpRight size={15}/></button>}</header>
    {latest && <p className="section-note">Evidence from the latest investigation of {latest.brief.website.replace(/^https?:\/\//, '')} ({latest.updatedAt.slice(0, 10)}) · {engineFindings.length} findings for this engine.</p>}
    {specs.length > 0 && <div className="studio-charts">{specs.map(s => <VistaChart key={s.id} spec={s} height={320}/>)}</div>}
    {latest && !specs.length && <p className="empty-copy">No evidence for this engine in the latest investigation. {status.dependency}</p>}
    {(engine === 8 || engine === 1 || engine === 2) && <button className="link-button" onClick={openMeasurements}>Import Search Console or GA4 reports in Measurements</button>}
    {engineFindings.length > 0 && <ul className="engine-findings">{engineFindings.slice(0, 5).map(f => <li key={f.id}><span className={'sev sev-' + f.severity}>{f.severity}</span><strong>{f.title}</strong><small>{f.evidenceId}</small></li>)}</ul>}
  </section>;
}
