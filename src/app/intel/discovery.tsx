'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCheck, Rocket, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import { assessCompetitor, offeringVocabulary } from '@/lib/intel/discovery-competitors';
import { discoveryCharts } from '@/lib/intel/discovery-charts';
import { discoveryProgress, newDiscovery, type DiscoveryRun } from '@/lib/intel/discovery-model';
import { resetFrom, runDiscovery } from '@/lib/intel/discovery-runner';
import { briefFromDiscovery, recommendScope } from '@/lib/intel/discovery-scope';
import { auditModes, type AiObservation, type Brief } from '@/lib/intel/model';
import type { Discovery } from '@/lib/intel/crawl';
import { listDiscoveries, saveDiscovery } from '@/lib/intel/store';
import type { Project } from '@/lib/workspace';
import IntelligencePulse from './intelligence-pulse';
import VistaChart from './vista-chart';
import { CompetitorSection, KeywordSection, PagesSection, ProfileSection, PromptSection, RegenerateMenu, ScopeSection } from './discovery-sections';
import type { Capabilities } from './studio';

type Props = {
  project?: Project;
  member: boolean;
  owner: boolean;
  organisationId: string | null;
  capabilities: Capabilities;
  busy: boolean;
  autoStart?: { website: string; nonce: number } | null;
  onEnsureProject: (website: string) => Project | null;
  onBrand: (projectId: string, brand: string, website: string) => void;
  onLaunch: (brief: Brief, automatedAi: boolean, observations: AiObservation[], projectId: string) => void;
  onCustom: (brief: Brief) => void;
};

const normalise = (raw: string) => { const v = raw.trim(); if (!v) return null; try { const u = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); if (!u.hostname.includes('.') || u.username || u.password) return null; return u.origin + '/'; } catch { return null; } };

/** Intelligent Discovery: the website address is enough to recommend the complete investigation scope. */
export default function IntelligentDiscovery(props: Props) {
  const { project, capabilities } = props;
  const [website, setWebsite] = useState(project?.url || '');
  const [run, setRun] = useState<DiscoveryRun | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [useAi, setUseAi] = useState(true);
  const [samples, setSamples] = useState(4);
  const [notice, setNotice] = useState('');
  const controller = useRef<AbortController | null>(null);
  const runRef = useRef<DiscoveryRun | null>(null);
  useEffect(() => { runRef.current = run; }, [run]);
  const aiMode = capabilities?.discoveryAi || 'off';
  const aiAllowed = aiMode === 'public' || (aiMode === 'members' && props.member);

  useEffect(() => {
    let cancelled = false;
    if (!project) { setRun(null); return; }
    listDiscoveries(project.id).then(list => {
      if (cancelled || running) return;
      const latest = list[0] || null;
      if (latest && latest.status === 'running') { latest.status = 'cancelled'; latest.activity = 'Interrupted when the page closed. Resume to continue from the last completed stage.'; }
      setRun(latest);
      setWebsite(latest?.website || project.url || '');
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const update = useCallback((next: DiscoveryRun) => { setRun(next); saveDiscovery(next).catch(() => {}); }, []);

  const execute = useCallback(async (target: DiscoveryRun) => {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setRunning(true); setError(''); setNotice('');
    try {
      const result = await runDiscovery(target, { signal: c.signal, onUpdate: setRun, save: saveDiscovery, capabilities: { discoveryAi: aiAllowed && target.settings.useAi ? aiMode : 'off', search: capabilities?.search || null }, organisationId: props.owner ? props.organisationId : null });
      setRun(result);
      if (result.profile) props.onBrand(result.projectId, result.profile.brand.value, result.website);
    } finally { setRunning(false); }
  }, [aiAllowed, aiMode, capabilities?.search, props]);

  function discover(raw = website) {
    const url = normalise(raw);
    if (!url) { setError('Enter a public website address, for example labmedexpert.com.'); return; }
    const target = props.onEnsureProject(url);
    if (!target) { setError('The client could not be created in this browser workspace.'); return; }
    setWebsite(url);
    const fresh = newDiscovery(target.id, url, { geoSamples: aiAllowed && useAi ? samples : 0, useAi: aiAllowed && useAi, member: props.member, render: Boolean(capabilities?.render), pagespeedKey: Boolean(capabilities?.pagespeedKey) });
    setRun(fresh);
    execute(fresh);
  }

  // Conversational start from VisTa BoT.
  const lastNonce = useRef(0);
  useEffect(() => {
    if (!props.autoStart || props.autoStart.nonce === lastNonce.current || running) return;
    lastNonce.current = props.autoStart.nonce;
    setWebsite(props.autoStart.website);
    discover(props.autoStart.website);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoStart]);

  const ready = Boolean(run && run.scope && run.profile && ['complete', 'partial'].includes(run.status));
  const launch = useCallback(() => {
    const r = runRef.current;
    if (!r || !r.scope || !r.profile) { setNotice('Run Intelligent Discovery first; the recommended scope appears when it completes.'); return; }
    props.onLaunch(briefFromDiscovery(r, r.scope, 'prospect'), props.owner, r.samples, r.projectId);
  }, [props]);
  useEffect(() => { const h = () => launch(); window.addEventListener('vista-discovery-launch', h); return () => window.removeEventListener('vista-discovery-launch', h); }, [launch]);

  function acceptAll() {
    if (!run?.profile) return;
    const p = run.profile;
    const on = <T extends { selected: boolean; confidence?: string }>(list: T[]) => list.map(x => ({ ...x, selected: x.confidence !== 'low' || x.selected }));
    const profile = { ...p, aliases: on(p.aliases), subsectors: on(p.subsectors), offerings: on(p.offerings), markets: on(p.markets), segments: on(p.segments), differentiators: on(p.differentiators), objectives: p.objectives.map(o => ({ ...o, selected: true })) };
    const next: DiscoveryRun = { ...run, profile, competitors: run.competitors.map(c => ({ ...c, selected: c.recommended })), keywords: run.keywords.map(k => ({ ...k, selected: k.selected || k.groups.includes('primary') || k.groups.includes('secondary') })), prompts: run.prompts.map(x => ({ ...x, selected: true })), priorityPages: run.priorityPages.map(x => ({ ...x, selected: true })) };
    next.scope = { ...recommendScope(next, profile.model.value), aiPromptBudget: run.scope?.aiPromptBudget ?? auditModes[run.scope?.mode || 'deep'].aiPrompts };
    update(next);
    setNotice('All recommendations accepted. Review anything you want to change, then launch the investigation.');
  }

  async function addCompetitor(raw: string, replaceId?: string) {
    if (!run?.profile) return;
    const url = normalise(raw);
    if (!url) { setNotice('Enter a valid competitor website.'); return; }
    setNotice('Verifying ' + url.replace(/^https?:\/\//, '') + '…');
    let home = null, failure: string | null = null;
    try {
      const r = await fetch('/api/intel/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const d = await r.json() as Discovery & { error?: string };
      if (!r.ok) failure = d.error || 'HTTP ' + r.status; else { home = d.home; failure = d.homeFailure?.message || null; }
    } catch (e) { failure = (e as Error).message; }
    const assessed = assessCompetitor(run.profile, offeringVocabulary(run.profile, run.pages), { name: url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), website: url, reason: 'Added by you', offerings: [], markets: [], sources: [] }, ['commercial'], home, failure);
    const current = runRef.current || run;
    const competitors = [...current.competitors.filter(c => c.website !== url).map(c => c.id === replaceId ? { ...c, selected: false } : c), { ...assessed, selected: assessed.verified, recommended: assessed.recommended }];
    update({ ...current, competitors, competitorHomes: home ? { ...current.competitorHomes, [url]: home } : current.competitorHomes });
    setNotice(assessed.verified ? assessed.name + ' verified and added (' + assessed.confidence + ' confidence). ' + (assessed.confidence === 'low' ? 'Its home page shows little overlap with the client offering.' : '') : 'Could not verify ' + url + ': ' + assessed.verification);
  }

  const progress = run ? discoveryProgress(run) : { percent: 0, determinate: true };
  const charts = useMemo(() => (run && !running && run.profile ? discoveryCharts(run) : []), [run, running]);
  const summary = run?.scope && run.profile ? [auditModes[run.scope.mode].label, run.scope.pageLimit + ' pages', run.competitors.filter(c => c.selected).length + ' competitors', Math.min(25, run.keywords.filter(k => k.selected).length) + ' keywords', run.prompts.filter(p => p.selected).length + ' prompts', run.priorityPages.filter(p => p.selected).length + ' priority pages'].join(' · ') : '';

  return <div className="discovery" aria-label="Intelligent Discovery">
    <form className="discovery-entry studio-section" onSubmit={e => { e.preventDefault(); if (!running) discover(); }}>
      <div className="discovery-entry-copy"><span className="eyebrow"><Sparkles size={14}/> INTELLIGENT DISCOVERY · RECOMMENDED</span><h3>Enter a website. VisTa does the research.</h3><p>VisTa reads the website, identifies the business, its offerings, audiences and markets, discovers and verifies competitors, builds keyword and AI-prompt intelligence, selects priority pages and recommends the investigation scope, with evidence behind every recommendation.</p></div>
      <div className="discovery-field"><label htmlFor="discovery-website">Client website</label><div><Search size={18} aria-hidden="true"/><input id="discovery-website" value={website} onChange={e => setWebsite(e.target.value)} placeholder="clientwebsite.com" inputMode="url" autoComplete="url" disabled={running}/><button className="mint-button" disabled={running || props.busy}>{running ? 'Discovering…' : 'Discover intelligence'}<ArrowRight size={16}/></button></div></div>
      <div className="discovery-options">
        <label className="check"><input type="checkbox" checked={aiAllowed && useAi} disabled={!aiAllowed || running} onChange={e => setUseAi(e.target.checked)}/> AI-assisted research (OpenAI web search){!aiAllowed && <small>{aiMode === 'members' ? ' — sign in to enable' : ' — not configured on this deployment'}</small>}</label>
        <label>AI answers to sample <select value={samples} disabled={!aiAllowed || !useAi || running} onChange={e => setSamples(Number(e.target.value))}>{[0, 2, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <span className="discovery-note">Search data provider: {capabilities?.search || 'not configured (search volumes, difficulty and rankings are not measured)'}</span>
      </div>
      {error && <p className="error-banner" role="alert">{error}</p>}
    </form>

    {run && run.status !== 'idle' && <IntelligencePulse title={'Intelligent Discovery · ' + run.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} status={run.status} stages={run.stages} activity={run.activity} elapsedMs={run.elapsedMs} percent={progress.percent} determinate={progress.determinate}
      counts={[{ label: 'pages sampled', value: run.pages.length }, { label: 'competitors verified', value: run.competitors.filter(c => c.verified).length }, { label: 'keywords', value: run.keywords.length }, { label: 'prompts', value: run.prompts.length }, { label: 'AI calls', value: run.ai.calls }]}
      gaps={run.gaps} gapsTitle="Discovery completed with limitations" onCancel={() => controller.current?.abort()} onResume={() => execute(run)} onRetry={() => execute(run)}/>}
    {notice && <p className="discovery-notice" role="status">{notice}</p>}

    {run?.profile && <>
      {ready && <div className="discovery-actions" role="toolbar" aria-label="Recommended scope actions">
        <div><strong>Recommended scope</strong><span>{summary}</span></div>
        <button className="ghost-button" onClick={acceptAll} disabled={running}><CheckCheck size={15}/>Accept all recommendations</button>
        <RegenerateMenu disabled={running} onRegenerate={stage => execute(resetFrom({ ...run, settings: { ...run.settings, geoSamples: aiAllowed && useAi ? samples : 0, useAi: aiAllowed && useAi } }, stage))}/>
        <button className="ghost-button" onClick={() => run.scope && props.onCustom(briefFromDiscovery(run, run.scope, 'prospect'))} disabled={running}><SlidersHorizontal size={15}/>Edit in custom form</button>
        <button className="mint-button" onClick={launch} disabled={running || props.busy}><Rocket size={15}/>Launch investigation</button>
      </div>}
      {run.gaps.length > 0 && !running && <section className="partial-banner" role="note"><div><strong>Limitations of this discovery</strong><ul>{run.gaps.map(g => <li key={g}>{g}</li>)}</ul></div></section>}
      <ProfileSection profile={run.profile} onChange={profile => update({ ...run, profile })}/>
      {(run.competitors.length > 0 || ['complete', 'partial'].includes(run.stages.find(s => s.id === 'competitors')!.status)) && <CompetitorSection run={run} busy={running} onChange={competitors => update({ ...run, competitors })} onAdd={addCompetitor}/>}
      {run.keywords.length > 0 && <KeywordSection run={run} onChange={keywords => update({ ...run, keywords })}/>}
      {run.prompts.length > 0 && <PromptSection run={run} onChange={prompts => update({ ...run, prompts })} budget={run.scope?.aiPromptBudget ?? auditModes.deep.aiPrompts} maxBudget={auditModes[run.scope?.mode || 'deep'].aiPrompts} onBudget={n => run.scope && update({ ...run, scope: { ...run.scope, aiPromptBudget: n } })}/>}
      {run.priorityPages.length > 0 && <PagesSection run={run} onChange={priorityPages => update({ ...run, priorityPages })}/>}
      {run.scope && <ScopeSection scope={run.scope} member={props.member} recommended={recommendScope(run, run.profile.model.value).mode} onChange={scope => update({ ...run, scope })}/>}
      {charts.length > 0 && <section className="studio-section" aria-label="Discovery visual intelligence"><div className="discovery-head"><h3>Visual intelligence</h3><p className="section-note">Drawn from the evidence above; each chart has a data table and export.</p></div><div className="studio-charts">{charts.map(spec => <VistaChart key={spec.id} spec={spec} height={spec.id === 'discovery-network' ? 380 : 320}/>)}</div></section>}
      {ready && <div className="discovery-launch"><p>{summary}</p><button className="mint-button" onClick={launch} disabled={running || props.busy}><Rocket size={16}/>Launch investigation with this scope</button></div>}
    </>}
  </div>;
}
