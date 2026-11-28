'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, History, Plus, RefreshCcw, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { computeAnalysis } from '@/lib/intel/analysis';
import * as charts from '@/lib/intel/charts';
import { jobProgress, newJob, type AiObservation, type Brief, type Investigation } from '@/lib/intel/model';
import { isRetryable, prepareRetry, runInvestigation } from '@/lib/intel/runner';
import { deleteInvestigation, getInvestigation, latestPerProject, listInvestigations, saveInvestigation, storageMode } from '@/lib/intel/store';
import type { Analysis } from '@/lib/intel/analysis';
import { emptyWorkspace, parseWorkspace, preferredProject, publicUrl, rememberProject, storageKey, type Project, type Workspace } from '@/lib/workspace';
import { hostLabel } from '@/lib/intel/geo';
import IntelligentDiscovery from './discovery';
import IntelligencePulse from './intelligence-pulse';
import BriefForm, { defaultBrief } from './studio-brief';
import { Authority, Cockpit, Competitors, Content, SearchAnalytics, Technical } from './studio-views';
import GeoPanel from './studio-geo';
import { DecisionsPanel, FindingsPanel } from './studio-decisions';
import ExecutiveStudio from './executive-studio';
import PulseMonitor from './studio-pulse';
import GoogleConnection from './studio-connections';
import VistaChart from './vista-chart';
import './intel.css';

export const studioTabs = [
  ['brief', 'Brief'], ['cockpit', 'Cockpit'], ['technical', 'Technical SEO'], ['content', 'Content'], ['authority', 'Authority & trust'], ['competitors', 'Competitors'], ['geo', 'GEO & AI search'], ['search', 'Search & analytics'], ['findings', 'Findings'], ['monitoring', 'Monitoring'], ['decisions', 'Decision Room'], ['executive', 'Executive Studio'], ['portfolio', 'Portfolio'],
] as const;
export type StudioTab = typeof studioTabs[number][0];

type Session = { authenticated: boolean; organisationId: string | null; owner: boolean };
export type Capabilities = { render: boolean; pagespeedKey: boolean; policy: { maxHtmlMb: number; maxTransferMb: number; maxDecodedMb: number }; discoveryAi?: string; search?: string | null; spider?: boolean } | null;

export default function Studio({ data, tab, onTab, goMeasurements }: { data: Workspace; tab: StudioTab; onTab: (tab: StudioTab) => void; goMeasurements: () => void }) {
  const [projectId, setProjectId] = useState('');
  const [history, setHistory] = useState<Investigation[]>([]);
  const [inv, setInv] = useState<Investigation | null>(null);
  const [running, setRunning] = useState(false);
  const [session, setSession] = useState<Session>({ authenticated: false, organisationId: null, owner: false });
  const [newBrief, setNewBrief] = useState(false);
  const [portfolio, setPortfolio] = useState<Investigation[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>(null);
  const controller = useRef<AbortController | null>(null);
  const invRef = useRef<Investigation | null>(null);
  useEffect(() => { invRef.current = inv; }, [inv]);
  const [previous, setPrevious] = useState<Analysis | null>(null);
  const [entry, setEntry] = useState<'discovery' | 'custom'>('discovery');
  const [customBrief, setCustomBrief] = useState<Brief | null>(null);
  const [autoStart, setAutoStart] = useState<{ website: string; nonce: number } | null>(null);
  const created = useRef<Project | null>(null);
  const project = data.projects.find(p => p.id === projectId) || (created.current?.id === projectId ? created.current : undefined);

  // Conversational requests from VisTa BoT ("investigate example.com") start Intelligent Discovery.
  useEffect(() => {
    const take = () => { let website: string | null = null; try { website = sessionStorage.getItem('vista-discover-request'); sessionStorage.removeItem('vista-discover-request'); } catch { /* storage unavailable */ } if (website) { setEntry('discovery'); setNewBrief(true); onTab('brief'); setAutoStart({ website, nonce: Date.now() }); } };
    take();
    window.addEventListener('vista-discover', take);
    return () => window.removeEventListener('vista-discover', take);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** The client project for a discovered website: an existing one with the same host, or a new one. */
  function ensureProject(website: string): Project | null {
    const host = new URL(website).hostname.replace(/^www\./, '');
    const same = (p: Project) => { try { return new URL(p.url).hostname.replace(/^www\./, '') === host; } catch { return false; } };
    const existing = (project && same(project) ? project : null) || data.projects.find(same);
    if (existing) { if (existing.id !== projectId) { setProjectId(existing.id); setInv(null); } rememberProject(existing.id); return existing; }
    try {
      const raw = localStorage.getItem(storageKey);
      const w = raw ? parseWorkspace(raw) : emptyWorkspace();
      const fresh: Project = { id: crypto.randomUUID(), name: hostLabel(website), url: publicUrl(website.startsWith('https://') ? website : 'https://' + host + '/'), audience: '', goal: '' };
      w.projects = [...w.projects, fresh];
      localStorage.setItem(storageKey, JSON.stringify(w));
      created.current = fresh;
      rememberProject(fresh.id); setProjectId(fresh.id); setInv(null);
      window.dispatchEvent(new Event('vista-update'));
      return fresh;
    } catch { return null; }
  }

  /** Name an auto-created client after the discovered brand. */
  function nameProject(id: string, brand: string, website: string) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const w = parseWorkspace(raw);
      const p = w.projects.find(x => x.id === id);
      if (!p || p.name !== hostLabel(website) || !brand || brand === p.name) return;
      p.name = brand.slice(0, 80);
      localStorage.setItem(storageKey, JSON.stringify(w));
      if (created.current?.id === id) created.current = { ...created.current, name: p.name };
      window.dispatchEvent(new Event('vista-update'));
    } catch { /* the client keeps its original name */ }
  }

  useEffect(() => { const preferred = preferredProject(); setProjectId(data.projects.some(p => p.id === preferred) ? preferred : data.projects[0]?.id || ''); }, [data.projects]);
  useEffect(() => {
    fetch('/api/cloud/session', { cache: 'no-store' }).then(r => r.json()).then((s: { authenticated?: boolean; memberships?: { organisation_id: string; role: string }[] }) => {
      const owner = s.memberships?.find(m => m.role === 'owner');
      setSession({ authenticated: !!s.authenticated, organisationId: owner?.organisation_id || s.memberships?.[0]?.organisation_id || null, owner: !!owner });
    }).catch(() => {});
    fetch('/api/intel/capabilities', { cache: 'no-store' }).then(r => r.json()).then(setCapabilities).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!projectId) { setHistory([]); setInv(null); return; }
    const list = await listInvestigations(projectId);
    setHistory(list);
    if (running) return;
    const current = invRef.current;
    const target = list.find(i => i.id === current?.id) || list[0];
    if (!target) { setInv(null); return; }
    if (current && current.id === target.id && current.pages.length >= (target.pageCount ?? 0)) return;
    const full = await getInvestigation(target.id);
    if (full && full.job.status === 'running') full.job = { ...full.job, status: 'paused', activity: 'Interrupted when the page closed. Resume to continue from the last saved step.' };
    setInv(full);
  }, [projectId, running]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { latestPerProject(data.projects.map(p => p.id)).then(setPortfolio); }, [history, data.projects]);

  // Dashboards are assembled once processing stops; large crawls stay responsive while running.
  const analysis = useMemo(() => (inv && inv.pages.length && !running ? computeAnalysis(inv) : null), [inv, running]);
  useEffect(() => {
    let cancelled = false;
    const older = inv && !running ? history.find(h => h.id !== inv.id && h.createdAt < inv.createdAt && ['complete', 'partial'].includes(h.job.status)) : undefined;
    if (!older) { setPrevious(null); return; }
    getInvestigation(older.id).then(full => { if (!cancelled) setPrevious(full && full.pages.length ? computeAnalysis(full) : null); });
    return () => { cancelled = true; };
  }, [inv?.id, inv?.createdAt, history, running]);

  async function persist(next: Investigation) { setInv(next); await saveInvestigation(next); }

  async function run(target: Investigation, automatedAi = target.job.stages.find(s => s.id === 'ai')?.status !== 'skipped') {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setRunning(true);
    try {
      const result = await runInvestigation(target, { signal: c.signal, onUpdate: setInv, save: saveInvestigation, organisationId: session.owner ? session.organisationId : null, automatedAi });
      setInv(result);
    } finally { setRunning(false); setHistory(await listInvestigations(projectId)); }
  }

  function start(brief: Brief, automatedAi: boolean, sampled: AiObservation[] = [], target: Project | null | undefined = project) {
    const project = target;
    if (!project) return;
    if (project.id !== projectId) setProjectId(project.id);
    rememberProject(project.id);
    const now = new Date().toISOString();
    const prior = inv && inv.projectId === project.id ? inv : null;
    const fresh: Investigation = { id: crypto.randomUUID(), projectId: project.id, createdAt: now, updatedAt: now, brief, discovery: null, pages: [], failures: [], links: [], performance: [], competitors: [], observations: [...(prior?.observations.filter(o => o.method === 'manual') || []), ...sampled], firstParty: { errors: [] }, job: newJob(), settings: prior?.settings };
    setCustomBrief(null);
    setNewBrief(false);
    onTab('cockpit');
    run(fresh, automatedAi);
  }

  function retry() {
    if (!inv) return;
    const job = { ...inv.job, stages: inv.job.stages.map(s => s.status === 'failed' ? { ...s, status: 'pending' as const, errors: [] } : s) };
    run({ ...inv, job });
  }

  function retryFailed() { if (inv) run(prepareRetry(inv)); }

  async function remove() {
    if (!inv || running || !window.confirm('Delete this investigation from this browser? This cannot be undone.')) return;
    await deleteInvestigation(inv.id);
    setInv(null); setHistory(await listInvestigations(projectId));
  }

  const progress = inv ? jobProgress(inv.job) : { percent: 0, determinate: true };
  const showBrief = !inv || newBrief || tab === 'brief';
  const pulse = inv && <IntelligencePulse title={'Website intelligence · ' + inv.brief.website.replace(/^https?:\/\//, '')} status={inv.job.status} stages={inv.job.stages} activity={inv.job.activity} elapsedMs={inv.job.elapsedMs} percent={progress.percent} determinate={progress.determinate} counts={[{ label: 'discovered', value: inv.job.counts.discovered ?? inv.job.counts.pages }, { label: 'queued', value: inv.job.counts.queued ?? 0 }, { label: 'processed', value: inv.job.counts.processed ?? inv.job.counts.pages }, { label: 'succeeded', value: inv.pages.length }, { label: 'failed', value: inv.job.counts.failed ?? 0 }, ...(inv.job.counts.restricted ? [{ label: 'restricted', value: inv.job.counts.restricted }] : [])]} gaps={inv.job.gaps} retryableCount={inv.failures.filter(isRetryable).length} onRetryFailed={running ? undefined : retryFailed} onCancel={() => controller.current?.abort()} onResume={() => run(inv)} onRetry={retry}/>;

  const discoveryPanel = <IntelligentDiscovery project={project} member={session.authenticated} owner={session.owner} organisationId={session.organisationId} capabilities={capabilities} busy={running} autoStart={autoStart} onEnsureProject={ensureProject} onBrand={nameProject} onLaunch={(brief, ai, sampled, id) => start(brief, ai, sampled, data.projects.find(p => p.id === id) || (created.current?.id === id ? created.current : project))} onCustom={brief => { setCustomBrief(brief); setEntry('custom'); }}/>;
  const entryModes = <div className="entry-modes" role="tablist" aria-label="Investigation entry mode">
    <button role="tab" aria-selected={entry === 'discovery'} className={entry === 'discovery' ? 'active' : ''} onClick={() => setEntry('discovery')}><Sparkles size={16}/><span><strong>Intelligent Discovery</strong><small>Recommended · enter the website and VisTa recommends the complete scope</small></span></button>
    <button role="tab" aria-selected={entry === 'custom'} className={entry === 'custom' ? 'active' : ''} onClick={() => setEntry('custom')}><SlidersHorizontal size={16}/><span><strong>Custom Investigation</strong><small>Advanced · define every investigation parameter yourself</small></span></button>
  </div>;

  const hasProjects = data.projects.length > 0 || Boolean(project);
  // One stable layout: the discovery panel keeps its place (and its live run) when the first client is created.
  return <div className="studio">
    <StudioHeader/>
    {hasProjects && <div className="studio-bar">
      <label>Client<select value={projectId} onChange={e => { setProjectId(e.target.value); rememberProject(e.target.value); setInv(null); }}>{data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label><History size={14}/> Investigation<select value={inv?.id || ''} onChange={e => { getInvestigation(e.target.value).then(setInv); }} disabled={running}>{!history.length && <option value="">None yet</option>}{history.map(h => <option key={h.id} value={h.id}>{h.createdAt.slice(0, 16).replace('T', ' ')} · {h.brief.mode} · {h.job.status} · {h.pageCount ?? h.pages.length} pages</option>)}</select></label>
      <div className="studio-bar-actions">
        <button className="ghost-button" onClick={() => { setNewBrief(true); onTab('brief'); }} disabled={running}><Plus size={15}/>New investigation</button>
        {inv && ['complete', 'partial'].includes(inv.job.status) && <button className="ghost-button" onClick={() => start({ ...inv.brief }, inv.job.stages.find(s => s.id === 'ai')?.status === 'complete')} disabled={running} title="Re-run with the same brief to track improvement"><RefreshCcw size={15}/>Re-run to track improvement</button>}
        {inv && <button className="ghost-button danger" onClick={remove} disabled={running}><Trash2 size={15}/>Delete</button>}
      </div>
    </div>}
    {storageMode() === 'memory' && <p className="dependency-note">This browser blocks IndexedDB, so investigations are kept only until the page is closed.</p>}
    {hasProjects && <nav className="studio-tabs" aria-label="Studio sections">{studioTabs.map(([id, label]) => <button key={id} className={tab === id || (id === 'brief' && showBrief && tab === 'brief') ? 'active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => onTab(id)} disabled={id !== 'brief' && id !== 'portfolio' && !analysis}>{label}</button>)}</nav>}
    {inv && (running || ['paused', 'cancelled', 'failed'].includes(inv.job.status) || tab === 'cockpit') && pulse}
    {inv && !running && inv.job.status === 'partial' && tab !== 'cockpit' && tab !== 'portfolio' && !showBrief && <p className="partial-note" role="note"><AlertTriangle size={15}/><span><strong>Partially complete</strong> · {(inv.job.gaps || []).length} evidence {(inv.job.gaps || []).length === 1 ? 'gap' : 'gaps'}. This view covers the evidence collected; it is not a complete website audit.</span><button className="link-button" onClick={() => onTab('cockpit')}>Review gaps</button></p>}
    {tab === 'portfolio' && hasProjects ? Portfolio() : showBrief ? <>{entryModes}{entry === 'discovery' ? discoveryPanel : <BriefForm key={(project?.id || '') + (inv?.id || 'new') + String(newBrief) + (customBrief ? 'd' : '')} project={project} initial={customBrief || defaultBrief(project, newBrief || !inv ? undefined : inv.brief)} canSampleAi={session.owner} canConnect={session.owner} member={session.authenticated} capabilities={capabilities} busy={running} onStart={(b, ai) => start(b, ai, [], project || ensureProject(new URL(b.website).origin + '/'))}/>}</> :
      inv && analysis ? <>
        {tab === 'cockpit' && <><Cockpit inv={inv} analysis={analysis} goTo={t => onTab(t as StudioTab)}/>{previous && charts.changeWaterfall(previous.index, analysis.index) && <section className="studio-section"><h3>Improvement since the previous investigation</h3><p className="section-note">Resolved findings: {previous.findings.filter(f => !analysis.findings.some(x => x.rule === f.rule)).length} · new findings: {analysis.findings.filter(f => !previous.findings.some(x => x.rule === f.rule)).length}</p><VistaChart spec={charts.changeWaterfall(previous.index, analysis.index)!} height={320}/></section>}</>}
        {tab === 'technical' && <Technical inv={inv} analysis={analysis}/>}
        {tab === 'content' && <Content inv={inv} analysis={analysis} projectId={inv.projectId}/>}
        {tab === 'authority' && <Authority inv={inv} analysis={analysis}/>}
        {tab === 'competitors' && <Competitors inv={inv} analysis={analysis}/>}
        {tab === 'geo' && <GeoPanel inv={inv} analysis={analysis} canSample={session.owner} organisationId={session.owner ? session.organisationId : null} onChange={persist}/>}
        {tab === 'search' && <><GoogleConnection organisationId={session.authenticated ? session.organisationId : null} canManage={session.authenticated}/><SearchAnalytics inv={inv} analysis={analysis} goMeasurements={goMeasurements}/></>}
        {tab === 'findings' && <FindingsPanel inv={inv} analysis={analysis}/>}
        {tab === 'monitoring' && <PulseMonitor history={history} current={inv} scheduling={Boolean(capabilities?.spider)} organisationId={session.authenticated ? session.organisationId : null}/>}
        {tab === 'decisions' && <DecisionsPanel inv={inv} analysis={analysis} onChange={persist}/>}
        {tab === 'executive' && <ExecutiveStudio inv={inv} analysis={analysis} projectName={project?.name || inv.brief.brand}/>}
      </> : inv && !inv.pages.length && !running ? <p className="empty-copy">This investigation has no page evidence yet. Resume or retry it above, or start a new investigation.</p> : null}
    {!hasProjects && <CreateClient/>}
  </div>;

  function Portfolio() {
    const latest = data.projects.map(p => ({ project: p, inv: portfolio.find(i => i.projectId === p.id && i.pages.length) })).filter(x => x.inv);
    const rows = latest.map(x => { const a = computeAnalysis(x.inv!); return { name: x.project.name, index: a.index.index, coverage: a.index.coverage, findings: a.findings.length, critical: a.findings.filter(f => f.severity === 'critical' || f.severity === 'high').length, at: x.inv!.updatedAt, id: x.project.id }; });
    const spec = charts.portfolioChart(rows);
    return <div className="studio-panel">
      <section className="studio-section"><h3>Multi-client portfolio</h3><p className="section-note">Latest evidence-backed investigation per client in this browser workspace. Each client's data remains separate.</p>
        {spec && <VistaChart spec={spec} height={Math.max(220, rows.length * 56)}/>}
        <div className="table-scroll"><table className="studio-table"><thead><tr><th>Client</th><th>Intelligence Index</th><th>Coverage</th><th>Findings</th><th>Critical / high</th><th>Last investigated</th><th></th></tr></thead><tbody>{data.projects.map(p => { const r = rows.find(x => x.id === p.id); return <tr key={p.id}><th scope="row">{p.name}</th><td>{r ? r.index ?? 'Not calculated' : '—'}</td><td>{r ? Math.round(r.coverage * 100) + '%' : '—'}</td><td>{r?.findings ?? '—'}</td><td>{r?.critical ?? '—'}</td><td>{r ? r.at.slice(0, 10) : 'Not investigated'}</td><td><button className="link-button" onClick={() => { setProjectId(p.id); rememberProject(p.id); onTab(r ? 'cockpit' : 'brief'); }}>Open</button></td></tr>; })}</tbody></table></div>
      </section>
      <CreateClient compact/>
    </div>;
  }
}

function StudioHeader() {
  return <div className="page-intro studio-intro"><div><span className="eyebrow">SEO &amp; GEO INTELLIGENCE STUDIO</span><h2>Assess. Diagnose. <em>Decide.</em></h2><p>Prospect or connected-client intelligence across technical SEO, content, authority, competitors and AI search, with evidence behind every finding.</p></div></div>;
}

function CreateClient({ compact = false }: { compact?: boolean }) {
  const [form, setForm] = useState({ name: '', url: '', audience: '', goal: '' });
  const [error, setError] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try {
      const url = publicUrl(/^https?:\/\//i.test(form.url) ? form.url : 'https://' + form.url);
      const raw = localStorage.getItem(storageKey);
      const w = raw ? parseWorkspace(raw) : emptyWorkspace();
      const id = crypto.randomUUID();
      w.projects = [...w.projects, { id, name: form.name.trim().slice(0, 80), url, audience: form.audience.trim().slice(0, 200), goal: form.goal.trim().slice(0, 200) }];
      localStorage.setItem(storageKey, JSON.stringify(w));
      rememberProject(id);
      window.dispatchEvent(new Event('vista-update'));
      setForm({ name: '', url: '', audience: '', goal: '' });
    } catch (err) { setError(err instanceof Error ? err.message : 'The client could not be saved.'); }
  }
  return <form className={'studio-section create-client' + (compact ? ' compact' : '')} onSubmit={submit}><h3>{compact ? 'Add a client' : 'Create your first client'}</h3><p className="section-note">Clients are stored in this browser workspace and can be backed up or synchronised to your organisation cloud checkpoint from My workspace.</p>
    <div className="brief-grid"><label>Client name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label><label>Website<input required value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://client.com"/></label><label>Audience<input value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}/></label><label>Commercial goal<input value={form.goal} onChange={e => setForm({ ...form, goal: e.target.value })}/></label></div>
    {error && <p className="error-banner" role="alert">{error}</p>}<button className="mint-button">Create client</button></form>;
}
