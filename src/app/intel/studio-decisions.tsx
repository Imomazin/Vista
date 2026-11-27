'use client';
import { useMemo, useState } from 'react';
import { CheckCircle2, CircleDashed, CircleSlash, Clock3 } from 'lucide-react';
import type { Analysis } from '@/lib/intel/analysis';
import * as charts from '@/lib/intel/charts';
import type { Investigation } from '@/lib/intel/model';
import { crossEngineInvestigations } from '@/lib/intel/strategy';
import VistaChart from './vista-chart';
import { FindingCard, Metric } from './studio-ui';

type Props = { inv: Investigation; analysis: Analysis; onChange: (inv: Investigation) => void };

export function FindingsPanel({ inv, analysis }: Omit<Props, 'onChange'>) {
  const [severity, setSeverity] = useState('all');
  const [engine, setEngine] = useState('all');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const list = analysis.findings.filter(f => (severity === 'all' || f.severity === severity) && (engine === 'all' || String(f.engine) === engine) && (kind === 'all' || f.evidenceClass === kind) && (!query || (f.title + ' ' + f.summary + ' ' + f.evidenceId).toLowerCase().includes(query.toLowerCase())));
  return <div className="studio-panel">
    <div className="filter-bar" role="search">
      <label>Severity<select value={severity} onChange={e => setSeverity(e.target.value)}><option value="all">All</option>{['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Engine<select value={engine} onChange={e => setEngine(e.target.value)}><option value="all">All nine</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>Engine {n}</option>)}</select></label>
      <label>Evidence<select value={kind} onChange={e => setKind(e.target.value)}><option value="all">All classes</option><option value="observed">Directly observed</option><option value="first-party">First-party</option><option value="third-party">Third-party</option></select></label>
      <label className="grow">Search<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Finding, evidence ID or keyword"/></label>
      <span>{list.length} of {analysis.findings.length}</span>
    </div>
    {list.map(f => <FindingCard key={f.id} finding={f} competitors={inv.competitors} intervention={analysis.interventions.find(i => i.findingId === f.id)}/>)}
    {!list.length && <p className="empty-copy">No findings match these filters.</p>}
  </div>;
}

export function DecisionsPanel({ inv, analysis, onChange }: Props) {
  const settings = inv.settings || {};
  const currency = settings.currency || 'GBP';
  const money = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 });
  const decisions = settings.decisions || [];
  const update = (patch: Partial<NonNullable<Investigation['settings']>>) => onChange({ ...inv, settings: { ...settings, ...patch } });
  const decide = (interventionId: string, decision: 'approved' | 'deferred' | 'rejected') => update({ decisions: [{ id: crypto.randomUUID(), at: new Date().toISOString(), interventionId, decision, note: '' }, ...decisions].slice(0, 500) });
  const latest = (id: string) => decisions.find(d => d.interventionId === id)?.decision;
  const scenarios = useMemo(() => [30, 60, 90].map(limit => {
    const items = analysis.interventions.filter(i => i.phase <= limit);
    return { label: limit === 30 ? 'Scenario A · 30-day stabilisation' : limit === 60 ? 'Scenario B · 60-day build' : 'Scenario C · full 90-day programme', items: items.length, days: [items.reduce((s, i) => s + i.effortDays[0], 0), items.reduce((s, i) => s + i.effortDays[1], 0)], cost: [items.reduce((s, i) => s + i.cost[0], 0), items.reduce((s, i) => s + i.cost[1], 0)], severe: items.filter(i => i.urgency >= 4).length, value: Math.round(items.reduce((s, i) => s + i.impact * i.confidence, 0) * 10) / 10 };
  }), [analysis.interventions]);
  const available = (engine: number) => engine === 3 || engine === 4 || engine === 5 ? inv.pages.length > 0 : engine === 9 ? inv.observations.length > 0 : engine === 1 ? !!inv.firstParty.gsc : engine === 8 ? !!inv.firstParty.ga4 : false;
  return <div className="studio-panel">
    <div className="metric-row">
      <Metric label="Interventions" value={analysis.interventions.length}/><Metric label="Approved" value={analysis.interventions.filter(i => latest(i.id) === 'approved').length}/><Metric label="Total effort (days)" value={analysis.interventions.reduce((s, i) => s + i.effortDays[1], 0)} note={'upper estimate at ' + money(settings.dayRate ?? 650) + ' per day'}/><Metric label="Decisions recorded" value={decisions.length}/>
    </div>
    <section className="studio-section assumptions-bar"><h3>Cost and value assumptions</h3>
      <label>Day rate<input type="number" min={0} step={50} value={settings.dayRate ?? 650} onChange={e => update({ dayRate: Number(e.target.value) || 0 })}/></label>
      <label>Currency<select value={currency} onChange={e => update({ currency: e.target.value })}>{['GBP', 'EUR', 'USD', 'AED'].map(c => <option key={c}>{c}</option>)}</select></label>
      <label>Value per organic click (optional)<input type="number" min={0} step={0.1} value={settings.valuePerClick ?? ''} onChange={e => update({ valuePerClick: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Unknown"/></label>
      <p className="section-note">Effort ranges come from finding effort bands (low 0.5–2, medium 2–6, high 6–20 days). Commercial upside is modelled only with connected Search Console data.</p>
    </section>
    <div className="studio-charts">
      {[charts.quadrant(analysis.interventions, 'impact-effort'), charts.quadrant(analysis.interventions, 'urgency-importance'), charts.quadrant(analysis.interventions, 'risk-opportunity'), charts.opportunityBubbles(analysis.interventions, analysis.findings)].filter(Boolean).map(s => <VistaChart key={s!.id} spec={s!} height={340}/>)}
    </div>
    <section className="studio-section"><h3>Strategic scenario comparison</h3><div className="scenario-row">{scenarios.map(s => <div key={s.label} className="scenario"><span>{s.label}</span><strong>{s.items} actions</strong><small>{s.days[0]}–{s.days[1]} days · {money(s.cost[0])}–{money(s.cost[1])} · {s.severe} urgent issues addressed · expected value index {s.value}</small></div>)}</div><p className="section-note">Expected value index = Σ(impact × confidence) of included actions. It ranks scenarios relative to each other and is not a financial forecast.</p></section>
    <section className="studio-section"><h3>30 · 60 · 90-day roadmap</h3><div className="roadmap">{analysis.phases.map(p => <div key={p.phase} className="roadmap-col"><h4>{p.label}</h4>{p.items.map(i => <div key={i.id} className={'roadmap-item decision-' + (latest(i.id) || 'none')}><strong>{i.finding}</strong><small>{i.owner} · review {i.reviewDate}{i.dependsOn.length ? ' · after ' + i.dependsOn.join(', ') : ''}</small></div>)}{!p.items.length && <p className="empty-copy">Nothing scheduled.</p>}</div>)}</div></section>
    <section className="studio-section"><h3>Intervention register</h3><div className="table-scroll"><table className="studio-table interventions"><thead><tr><th>Finding</th><th>Evidence</th><th>Objective</th><th>Recommended action</th><th>Expected outcome</th><th>Effort</th><th>Cost range</th><th>Owner</th><th>Success metric</th><th>Review</th><th>Decision</th></tr></thead><tbody>
      {analysis.interventions.map(i => <tr key={i.id}><th scope="row">{i.finding}<small>Priority {i.priority} · {i.phase} days</small></th><td><a href={'#finding-' + i.evidenceId}>{i.evidenceId}</a></td><td>{i.objective}</td><td>{i.action}</td><td>{i.outcome}</td><td>{i.effortDays.join('–')} d</td><td>{money(i.cost[0])}–{money(i.cost[1])}</td><td><input aria-label={'Owner for ' + i.finding} value={settings.owners?.[i.findingId] || ''} placeholder="Assign" onChange={e => update({ owners: { ...(settings.owners || {}), [i.findingId]: e.target.value.slice(0, 80) } })}/></td><td>{i.metric}</td><td>{i.reviewDate}</td><td className="decision-buttons">{(['approved', 'deferred', 'rejected'] as const).map(d => <button key={d} className={latest(i.id) === d ? 'active' : ''} onClick={() => decide(i.id, d)} aria-pressed={latest(i.id) === d}>{d === 'approved' ? 'Approve' : d === 'deferred' ? 'Defer' : 'Reject'}</button>)}</td></tr>)}
    </tbody></table></div></section>
    {decisions.length > 0 && <section className="studio-section"><h3>Decision history</h3><ul className="decision-history">{decisions.slice(0, 30).map(d => <li key={d.id}><time>{d.at.slice(0, 16).replace('T', ' ')}</time> {d.decision} · {analysis.interventions.find(i => i.id === d.interventionId)?.finding || d.interventionId}</li>)}</ul></section>}
    <section className="studio-section"><h3>Cross-engine investigations</h3><p className="section-note">Structured diagnostic paths. They separate verified relationships from plausible explanations and list the validation each hypothesis needs.</p>
      {crossEngineInvestigations.map(x => <details key={x.id} className="cross-engine"><summary>{x.question}<small>Engines {x.engines.join(', ')}</small></summary><ol>{x.checks.map((c, i) => <li key={i}>{available(c.engine) ? <CheckCircle2 size={15} className="ok"/> : <CircleDashed size={15}/>}<div><strong>Engine {c.engine}: {c.evidence}</strong><span>{available(c.engine) ? 'Evidence available in this investigation.' : 'Evidence not connected — this step remains a hypothesis.'}</span><em>Validation: {c.validation}</em></div></li>)}</ol></details>)}
      <p className="dependency-note"><Clock3 size={14}/> Causality is never inferred from correlation; each hypothesis lists the evidence needed to confirm it. <CircleSlash size={14}/> Steps marked unavailable need connected sources.</p>
    </section>
  </div>;
}
