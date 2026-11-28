'use client';
import { useEffect, useMemo, useState } from 'react';
import { computeAnalysis } from '@/lib/intel/analysis';
import type { Investigation } from '@/lib/intel/model';
import { competitorChanges, minHistory, pageChanges, pulseMethod, pulseSignals, type PageChange, type Signal } from '@/lib/intel/pulse';
import { getInvestigation } from '@/lib/intel/store';

const statusLabel: Record<Signal['status'], string> = { normal: 'Normal', anomaly: 'Anomaly', changed: 'Changed', insufficient: 'Building baseline' };
const basisLabel: Record<Signal['basis'], string> = { observed: 'Observed', measured: 'Measured', estimate: 'Estimate' };
const changeLabel: Record<PageChange['kind'], string> = { status: 'HTTP status changed', noindex: 'No longer indexable', decay: 'Content shrank by 30% or more', removed: 'Not found in the latest crawl', title: 'Title changed', content: 'Content changed', added: 'Newly observed' };
const short = (u: string) => { try { const x = new URL(u); return x.pathname === '/' ? x.hostname.replace(/^www\./, '') : x.pathname; } catch { return u; } };

function Spark({ points }: { points: Signal['points'] }) {
  if (points.length < 2) return null;
  const xs = points.map(p => p.value), min = Math.min(...xs), max = Math.max(...xs), span = max - min || 1;
  const d = points.map((p, i) => (i ? 'L' : 'M') + (i * 100 / (points.length - 1)).toFixed(1) + ',' + (28 - (p.value - min) / span * 24).toFixed(1)).join(' ');
  return <svg className="pulse-spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path d={d}/></svg>;
}

/** VisTa Pulse: monitoring across a client's investigations (baselines, anomalies and changes). */
function Scheduling({ current, enabled, organisationId }: { current: Investigation; enabled: boolean; organisationId: string | null }) {
  const [state, setState] = useState('');
  const urls = [current.brief.website, ...(current.brief.seedUrls || [])].filter(Boolean).slice(0, 10);
  async function schedule() {
    setState('Scheduling…');
    try {
      const r = await fetch('/api/spider/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organisationId, urls, everyDays: 7 }) });
      const d = await r.json();
      setState(r.ok ? d.scheduled + ' page' + (d.scheduled === 1 ? '' : 's') + ' will be recrawled every ' + d.everyDays + ' days by VisTa Spider.' : d.error || 'Scheduling failed.');
    } catch { setState('Scheduling failed.'); }
  }
  if (!enabled) return <p className="rec-note">Scheduled monitoring is not active on this deployment. The owner enables it by applying <code>database/index.sql</code> and <code>database/spider.sql</code> in Supabase and setting <code>CRON_SECRET</code> and <code>VISTA_SUPABASE_SERVICE_ROLE_KEY</code> in Vercel; VisTa Spider then recrawls watched pages on a schedule. Until then Pulse updates whenever an investigation runs.</p>;
  if (!organisationId) return <p className="rec-note">Sign in to an organisation to schedule recrawls of this client&apos;s priority pages.</p>;
  return <div className="pulse-schedule"><button className="ghost-button" onClick={schedule}>Monitor {urls.length} priority page{urls.length === 1 ? '' : 's'} weekly</button>{state && <small role="status">{state}</small>}</div>;
}

export default function PulseMonitor({ history, current, scheduling = false, organisationId = null }: { history: Investigation[]; current: Investigation; scheduling?: boolean; organisationId?: string | null }) {
  const [full, setFull] = useState<Investigation[] | null>(null);
  const ids = useMemo(() => history.filter(h => ['complete', 'partial'].includes(h.job.status) && h.createdAt <= current.createdAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map(h => h.id), [history, current.createdAt]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(ids.map(id => (id === current.id ? Promise.resolve(current) : getInvestigation(id)))).then(list => { if (!cancelled) setFull(list.filter((x): x is Investigation => Boolean(x && x.pages.length))); }).catch(() => { if (!cancelled) setFull([]); });
    return () => { cancelled = true; };
  }, [ids, current]);
  const runs = useMemo(() => (full || []).map(inv => ({ inv, analysis: computeAnalysis(inv) })), [full]);
  const signals = useMemo(() => pulseSignals(runs), [runs]);
  const ordered = useMemo(() => (full || []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [full]);
  const latest = ordered[ordered.length - 1], previous = ordered[ordered.length - 2];
  const changes = useMemo(() => (latest && previous ? pageChanges(previous, latest) : []), [latest, previous]);
  const rivals = useMemo(() => (latest && previous ? competitorChanges(previous, latest) : []), [latest, previous]);
  if (!full) return <section className="studio-section"><p className="section-note">Loading the investigation history…</p></section>;
  const alerts = signals.filter(s => s.status === 'anomaly' || (s.status === 'changed' && s.direction === 'worse'));
  const kinds = [...new Set(changes.map(c => c.kind))];
  return <>
    <section className="studio-section" aria-label="VisTa Pulse monitoring"><div className="discovery-head"><h3>Monitoring <small className="lex-badge">VisTa Pulse</small></h3><p className="section-note">Compares this client's investigations over time: {ordered.length} investigation{ordered.length === 1 ? '' : 's'}{ordered.length ? ' from ' + ordered[0].createdAt.slice(0, 10) + ' to ' + ordered[ordered.length - 1].createdAt.slice(0, 10) : ''}. Each metric is judged against the median of the earlier runs; a baseline needs {minHistory} earlier investigations. </p></div>
      {alerts.length > 0 ? <p className="pulse-alert" role="status"><strong>{alerts.length} signal{alerts.length === 1 ? '' : 's'} need attention:</strong> {alerts.map(a => a.label).join(', ')}.</p> : <p className="lex-coverage" role="status">{signals.some(s => s.status !== 'insufficient') ? 'No anomalies against the baseline.' : 'Baselines are still being built; run further investigations of this client to enable anomaly detection.'}</p>}
      <div className="pulse-grid">{signals.map(s => <div key={s.id} className={'pulse-card pulse-' + s.status + (s.direction ? ' dir-' + s.direction : '')}>
        <div className="pulse-card-head"><span>{s.label}</span><small className={'factor-basis basis-' + s.basis}>{basisLabel[s.basis]}</small></div>
        <strong>{s.latest ? (Math.round(s.latest.value * 10) / 10).toLocaleString('en-GB') + s.unit : '—'}</strong>
        <Spark points={s.points}/>
        <small className="pulse-status">{statusLabel[s.status]}{s.direction && s.status !== 'insufficient' ? ' · ' + (s.direction === 'better' ? 'better' : s.direction === 'worse' ? 'worse' : 'different') : ''}</small>
        <small className="rec-note">{s.message}</small>
      </div>)}</div>
      <Scheduling current={current} enabled={scheduling} organisationId={organisationId}/>
      <p className="lex-method"><small>{pulseMethod}</small></p>
    </section>
    <section className="studio-section" aria-label="Changes since the previous investigation"><div className="discovery-head"><h3>Changes since the previous investigation</h3><p className="section-note">{previous ? 'Pages observed in both the ' + previous.createdAt.slice(0, 10) + ' and ' + latest.createdAt.slice(0, 10) + ' investigations (observed evidence).' : 'Run a second investigation of this client to see what changed.'}</p></div>
      {previous && (changes.length ? <div className="pulse-changes">{kinds.map(k => { const list = changes.filter(c => c.kind === k); return <details key={k} open={['status', 'noindex', 'decay'].includes(k)}><summary>{changeLabel[k]} <em>{list.length}</em></summary><ul>{list.slice(0, 25).map(c => <li key={k + c.url}><a href={c.url} target="_blank" rel="noopener noreferrer nofollow">{short(c.url)}</a><span>{c.before}</span><span aria-hidden="true">→</span><span>{c.after}</span></li>)}</ul></details>; })}</div> : <p className="rec-note">No changes detected on the pages observed in both investigations.</p>)}
      {rivals.length > 0 && <><h4 className="index-h">Competitor website changes</h4><div className="pulse-changes">{rivals.map(r => <details key={r.website}><summary>{r.name} <em>{r.changed.length}</em></summary><ul>{r.changed.slice(0, 15).map(c => <li key={c.kind + c.url}><a href={c.url} target="_blank" rel="noopener noreferrer nofollow">{short(c.url)}</a><span>{changeLabel[c.kind]}: {c.before}</span><span aria-hidden="true">→</span><span>{c.after}</span></li>)}</ul></details>)}</div></>}
    </section>
  </>;
}
