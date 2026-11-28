'use client';
import { useMemo, useState } from 'react';
import { Check, ExternalLink, Pencil, Plus, RefreshCcw, Replace, X } from 'lucide-react';
import { basisLabel, competitorKindLabel, keywordGroupLabel, pageRoleLabel, recId, type Basis, type BusinessProfile, type CompetitorRec, type DiscoveryRun, type EvidenceRef, type KeywordGroup, type PageRole, type PromptRec, type Rec, type ScopeRec } from '@/lib/intel/discovery-model';
import { promptCategories } from '@/lib/intel/geo';
import { auditModes, tierCap, type AuditMode, type PromptCategory } from '@/lib/intel/model';

const shortBasis: Record<Basis, string> = { observed: 'Stated', inferred: 'Inference', model: 'AI interpretation', measured: 'Measured', 'first-party': 'First-party', provider: 'Provider data', user: 'Added by you' };
export function BasisTag({ basis }: { basis: Basis }) { return <span className={'basis-tag basis-' + basis} title={basisLabel[basis]}>{shortBasis[basis]}</span>; }
const confidenceLabel = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };
export function Confidence({ level }: { level: 'high' | 'medium' | 'low' }) { return <span className={'conf conf-' + level}>{confidenceLabel[level]}</span>; }
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70);

export function Evidence({ items, label = 'evidence' }: { items: EvidenceRef[]; label?: string }) {
  if (!items.length) return <span className="rec-noevidence">No direct evidence</span>;
  return <details className="rec-evidence"><summary>{items.length} {label}</summary><ul>{items.map((e, i) => <li key={i}><a href={e.url} target="_blank" rel="noopener noreferrer nofollow">{shortUrl(e.url)}<ExternalLink size={11}/></a><span>{e.detail}</span>{e.excerpt && <q className="rec-excerpt">{e.excerpt.slice(0, 220)}</q>}{(e.method || e.at) && <small className="rec-method">{[e.method, e.at ? 'collected ' + e.at.slice(0, 10) : ''].filter(Boolean).join(' · ')}</small>}</li>)}</ul></details>;
}

/** Editable list of recommendations: include/exclude, edit, add your own; basis, confidence and evidence shown for each. */
export function RecList({ label, items, onChange, single = false, addLabel, prefix }: { label: string; items: Rec[]; onChange: (items: Rec[]) => void; single?: boolean; addLabel?: string; prefix: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState('');
  const save = (id: string) => { const v = draft.trim(); if (v) onChange(items.map(r => r.id === id ? { ...r, value: v.slice(0, 200), basis: r.value === v ? r.basis : 'user', note: r.value === v ? r.note : 'Edited by you (was: ' + r.value.slice(0, 80) + ')' } : r)); setEditing(null); };
  return <div className="rec-field"><h4>{label}</h4>
    <ul className="rec-list">{items.map(r => <li key={r.id} className={r.selected ? 'on' : 'off'}>
      {!single && <label className="rec-check"><input type="checkbox" checked={r.selected} onChange={e => onChange(items.map(x => x.id === r.id ? { ...x, selected: e.target.checked } : x))} aria-label={(r.selected ? 'Exclude ' : 'Include ') + r.value}/></label>}
      <div className="rec-body">
        {editing === r.id ? <form onSubmit={e => { e.preventDefault(); save(r.id); }} className="rec-edit"><input autoFocus value={draft} onChange={e => setDraft(e.target.value)} aria-label={'Edit ' + label}/><button className="rec-icon" aria-label="Save"><Check size={14}/></button><button type="button" className="rec-icon" aria-label="Cancel" onClick={() => setEditing(null)}><X size={14}/></button></form>
          : <span className="rec-value">{r.value}</span>}
        <span className="rec-meta">{r.tag && <span className="rec-tag">{r.tag}</span>}<BasisTag basis={r.basis}/><Confidence level={r.confidence}/><Evidence items={r.evidence}/>{editing !== r.id && <button className="rec-icon" aria-label={'Edit ' + r.value} onClick={() => { setEditing(r.id); setDraft(r.value); }}><Pencil size={13}/></button>}</span>
        {r.note && <small className="rec-note">{r.note}</small>}
      </div></li>)}</ul>
    {!single && addLabel && <form className="rec-add" onSubmit={e => { e.preventDefault(); const v = adding.trim(); if (!v) return; onChange([...items, { id: recId(prefix, v) + '-' + items.length, value: v.slice(0, 200), basis: 'user', confidence: 'high', evidence: [], selected: true, note: 'Added by you.' }]); setAdding(''); }}><input value={adding} onChange={e => setAdding(e.target.value)} placeholder={addLabel} aria-label={addLabel}/><button className="ghost-button" disabled={!adding.trim()}><Plus size={14}/>Add</button></form>}
  </div>;
}

export function ProfileSection({ profile, onChange }: { profile: BusinessProfile; onChange: (p: BusinessProfile) => void }) {
  const set = <K extends keyof BusinessProfile>(key: K) => (v: Rec[]) => onChange({ ...profile, [key]: (['brand', 'industry', 'model', 'valueProposition'] as string[]).includes(key) ? v[0] : v });
  return <section className="studio-section discovery-profile" aria-label="Business profile"><div className="discovery-head"><h3>Business profile</h3><p className="section-note">Recommended from the website's own pages. Each item shows how it is known: <strong>Stated</strong> on the website, a VisTa <strong>Inference</strong> from observed signals, or an <strong>AI interpretation</strong> kept only where it cites pages VisTa fetched.</p></div>
    <div className="rec-grid">
      <RecList label="Brand name" items={[profile.brand]} onChange={set('brand')} single prefix="brand"/>
      <RecList label="Industry" items={[profile.industry]} onChange={set('industry')} single prefix="industry"/>
      <RecList label="Business model" items={[profile.model]} onChange={set('model')} single prefix="model"/>
      <RecList label="Value proposition" items={[profile.valueProposition]} onChange={set('valueProposition')} single prefix="vp"/>
      <RecList label="Brand aliases" items={profile.aliases} onChange={set('aliases')} addLabel="Add an alias" prefix="alias"/>
      <RecList label="Industry subsectors" items={profile.subsectors} onChange={set('subsectors')} addLabel="Add a subsector" prefix="subsector"/>
      <RecList label="Products and services" items={profile.offerings} onChange={set('offerings')} addLabel="Add a product or service" prefix="offering"/>
      <RecList label="Geographic markets" items={profile.markets} onChange={set('markets')} addLabel="Add a market" prefix="market"/>
      <RecList label="Customer segments" items={profile.segments} onChange={set('segments')} addLabel="Add a segment" prefix="segment"/>
      <RecList label="Commercial differentiators" items={profile.differentiators} onChange={set('differentiators')} addLabel="Add a differentiator" prefix="diff"/>
      <RecList label="Potential growth objectives" items={profile.objectives} onChange={set('objectives')} addLabel="Add an objective" prefix="objective"/>
    </div></section>;
}

export function CompetitorSection({ run, onChange, onAdd, busy }: { run: DiscoveryRun; onChange: (list: CompetitorRec[]) => void; onAdd: (website: string, replaceId?: string) => void; busy: boolean }) {
  const [website, setWebsite] = useState('');
  const [replacing, setReplacing] = useState<string | null>(null);
  const toggle = (id: string, selected: boolean) => onChange(run.competitors.map(c => c.id === id ? { ...c, selected } : c));
  const samples = run.samples.length;
  return <section className="studio-section" aria-label="Recommended competitors"><div className="discovery-head"><h3>Competitor intelligence</h3><p className="section-note">Commercial competitors come from AI web search; organic competitors from a search data provider; GEO competitors from sampled AI answers. Every website is fetched and compared with the client's offering vocabulary, markets and audiences before it is recommended. {run.search.note}</p></div>
    {!run.competitors.length && <p className="empty-copy">No competitors were verified. {run.stages.find(s => s.id === 'competitors')?.note}</p>}
    <div className="competitor-cards">{run.competitors.map(c => <article key={c.id} className={'competitor-card' + (c.selected ? ' on' : '') + (c.verified ? '' : ' unverified')}>
      <header><label className="rec-check"><input type="checkbox" checked={c.selected} disabled={!c.verified} onChange={e => toggle(c.id, e.target.checked)} aria-label={(c.selected ? 'Exclude ' : 'Include ') + c.name}/></label>
        <div><strong>{c.name}</strong><a href={c.website} target="_blank" rel="noopener noreferrer nofollow">{shortUrl(c.website)}<ExternalLink size={11}/></a></div>
        <span className="kind-chips">{c.kinds.map(k => <span key={k} className={'kind-chip kind-' + k}>{competitorKindLabel[k]}</span>)}</span></header>
      <dl className="overlap-grid">
        <div><dt>Product and service overlap</dt><dd>{c.overlap.offerings ? c.overlap.offerings.matched.length + ' of ' + c.overlap.offerings.total + ' offering terms' : '—'}{c.overlap.offerings?.matched.length ? <small>{c.overlap.offerings.matched.slice(0, 8).join(', ')}</small> : null}</dd></div>
        <div><dt>Market overlap</dt><dd>{c.overlap.markets ? (c.overlap.markets.shared.length ? c.overlap.markets.shared.join(', ') : c.overlap.markets.theirs.length ? 'Different: ' + c.overlap.markets.theirs.join(', ') : 'Not stated on their site') : '—'}</dd></div>
        <div><dt>Audience overlap</dt><dd>{c.overlap.audiences?.shared.length ? c.overlap.audiences.shared.join(', ') : 'None observed'}</dd></div>
        <div><dt>Search overlap</dt><dd>{c.overlap.search ? c.overlap.search.shared + ' sampled keyword' + (c.overlap.search.shared === 1 ? '' : 's') : 'Not measured'}{c.overlap.search ? <small>{c.overlap.search.keywords.slice(0, 4).join(', ')}</small> : <small>Needs a search data provider</small>}</dd></div>
        <div><dt>AI answers</dt><dd>{samples ? (c.overlap.geo ? c.overlap.geo.mentions + ' of ' + samples + ' mention' + (c.overlap.geo.citations ? ' · ' + c.overlap.geo.citations + ' citation' + (c.overlap.geo.citations === 1 ? '' : 's') : '') : '0 of ' + samples) : 'Not sampled'}</dd></div>
        <div><dt>Assessment</dt><dd><Confidence level={c.confidence}/><small>{c.verification}</small></dd></div>
      </dl>
      {c.checks && <ul className="competitor-checks" aria-label={'Verification of ' + c.name}>
        <li className={'check-' + c.checks.retrieval.status}><strong>Website</strong>{c.checks.retrieval.status === 'ok' ? 'Retrieved' : 'Not retrieved'}<small>{c.checks.retrieval.detail}</small></li>
        <li className={'check-' + c.checks.identity.status}><strong>Identity</strong>{{ verified: 'Verified', unverified: 'Not confirmed', mismatch: 'Mismatch' }[c.checks.identity.status]}<small>{c.checks.identity.detail}</small></li>
        <li className={'check-' + c.checks.relevance.status}><strong>Relevance</strong>{c.checks.relevance.status === 'measured' ? 'Measured' : 'Unknown'}<small>{c.checks.relevance.detail}</small></li>
      </ul>}
      <p className="competitor-reason">{c.reason}</p>
      <footer><Evidence items={c.evidence} label="sources"/><button className="link-button" onClick={() => { setReplacing(c.id); setWebsite(''); }}><Replace size={13}/> Replace</button></footer>
    </article>)}</div>
    <form className="rec-add competitor-add" onSubmit={e => { e.preventDefault(); if (website.trim()) { onAdd(website.trim(), replacing || undefined); setWebsite(''); setReplacing(null); } }}>
      <input value={website} onChange={e => setWebsite(e.target.value)} placeholder={replacing ? 'Replacement competitor website' : 'Add a competitor website, e.g. competitor.co.uk'} aria-label={replacing ? 'Replacement competitor website' : 'Add a competitor website'}/>
      <button className="ghost-button" disabled={busy || !website.trim()}><Plus size={14}/>{replacing ? 'Verify and replace' : 'Verify and add'}</button>{replacing && <button type="button" className="link-button" onClick={() => setReplacing(null)}>Cancel</button>}
    </form>
    {run.citationSources.length > 0 && <details className="citation-sources"><summary>{run.citationSources.length} sources cited in AI answers (not competitors)</summary><ul>{run.citationSources.map(s => <li key={s.domain}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.domain}</a> — {s.note}</li>)}</ul><p className="section-note">Earning mentions on these sources can improve AI visibility.</p></details>}
  </section>;
}

const groups = Object.keys(keywordGroupLabel) as KeywordGroup[];
export function KeywordSection({ run, onChange }: { run: DiscoveryRun; onChange: (list: DiscoveryRun['keywords']) => void }) {
  const [group, setGroup] = useState<KeywordGroup | 'all' | 'selected'>('all');
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const shown = useMemo(() => run.keywords.filter(k => (group === 'all' || (group === 'selected' ? k.selected : k.groups.includes(group))) && (!query || k.keyword.includes(query.toLowerCase()))), [run.keywords, group, query]);
  const measured = run.keywords.some(k => k.metrics);
  const bulk = (selected: boolean) => { const ids = new Set(shown.map(k => k.id)); onChange(run.keywords.map(k => ids.has(k.id) ? { ...k, selected } : k)); };
  const metric = (v: number | undefined, f: (n: number) => string = n => n.toLocaleString('en-GB')) => v === undefined ? <span className="not-measured" title="Not measured: requires Search Console or a search data provider">—</span> : f(v);
  return <section className="studio-section" aria-label="Keyword intelligence"><div className="discovery-head"><h3>Keyword intelligence</h3><p className="section-note">{run.keywords.length} keywords (variants merged) from the site's offerings, structured data, headings and navigation, competitor pages and industry vocabulary. Preselected: up to 8 primary and 20 secondary non-branded commercial or transactional keywords ranked by priority (source strength, intent, evidence and, when available, measured demand), plus the brand name; informational, branded and emerging keywords are listed for selection. The top 25 selected keywords guide page analysis. {measured ? 'Volumes, difficulty, CPC and rankings are shown where Search Console or the search data provider measured them.' : 'Search volume, difficulty, CPC and rankings are not shown because no search data provider or Search Console connection supplied them; nothing is estimated.'}</p></div>
    <div className="kw-filters" role="toolbar" aria-label="Keyword filters">{(['all', 'selected', ...groups] as const).map(g => <button key={g} className={'filter-chip' + (group === g ? ' active' : '')} aria-pressed={group === g} onClick={() => setGroup(g)}>{g === 'all' ? 'All' : g === 'selected' ? 'Selected' : keywordGroupLabel[g]} <em>{g === 'all' ? run.keywords.length : g === 'selected' ? run.keywords.filter(k => k.selected).length : run.keywords.filter(k => k.groups.includes(g)).length}</em></button>)}</div>
    <div className="kw-actions"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter keywords" aria-label="Filter keywords"/><button className="ghost-button" onClick={() => bulk(true)}>Select shown ({shown.length})</button><button className="ghost-button" onClick={() => bulk(false)}>Clear shown</button><span>{run.keywords.filter(k => k.selected).length} selected · the top 25 by priority guide page analysis</span></div>
    <div className="table-scroll"><table className="studio-table kw-table"><thead><tr><th scope="col"><span className="sr-only">Selected</span></th><th scope="col">Keyword</th><th scope="col">Groups</th><th scope="col">Intent</th><th scope="col">Priority</th><th scope="col">Volume</th><th scope="col">Difficulty</th><th scope="col">CPC</th><th scope="col">Ranking</th><th scope="col">Source</th></tr></thead>
      <tbody>{shown.slice(0, all ? 400 : 60).map(k => <tr key={k.id}><td><input type="checkbox" checked={k.selected} onChange={e => onChange(run.keywords.map(x => x.id === k.id ? { ...x, selected: e.target.checked } : x))} aria-label={'Select ' + k.keyword}/></td><th scope="row">{k.keyword}</th><td className="kw-groups">{k.groups.filter(g => g !== 'non-branded').map(g => <span key={g} className={'group-chip group-' + g}>{keywordGroupLabel[g]}</span>)}</td><td>{k.intent}</td><td><span className="priority-bar"><i style={{ width: k.priority + '%' }}/></span>{k.priority}</td><td>{metric(k.metrics?.volume ?? k.metrics?.impressions)}</td><td>{metric(k.metrics?.difficulty)}</td><td>{metric(k.metrics?.cpc, n => n.toFixed(2))}</td><td>{metric(k.metrics?.position)}</td><td><small>{k.metrics ? k.metrics.source : k.sources[0]}</small><BasisTag basis={k.basis}/></td></tr>)}</tbody></table></div>
    {shown.length > 60 && !all && <button className="link-button" onClick={() => setAll(true)}>Show all {shown.length} keywords</button>}
  </section>;
}

export function PromptSection({ run, onChange, budget, maxBudget, onBudget }: { run: DiscoveryRun; onChange: (list: PromptRec[]) => void; budget: number; maxBudget: number; onBudget: (n: number) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState({ prompt: '', category: 'discovery' as PromptCategory });
  const approved = run.prompts.filter(p => p.selected).length;
  return <section className="studio-section" aria-label="GEO prompt bank"><div className="discovery-head"><h3>GEO prompt bank</h3><p className="section-note">{run.prompts.length} questions prospective customers ask AI assistants, prioritised by commercial relevance. Approved prompts are sampled in the investigation (owner accounts) and tracked across investigations in the GEO tab.</p>
    {run.samples.length > 0 && <p className="sample-summary" role="note"><strong>Brand mentioned in {run.samples.filter(x => x.brandMentioned).length} of {run.samples.length} sampled answers</strong> · {[...new Set(run.samples.map(x => x.provider + ' API · ' + x.model))].join(', ')} · web search · {run.samples[0].collectedAt.slice(0, 10)} · {run.samples.reduce((n, x) => n + x.citations.length, 0)} citations. A sample of {run.samples.length} is indicative only: it is not a measure of AI visibility across the market, and consumer AI products may answer differently.</p>}</div>
    <label className="budget-slider">AI prompts sampled per investigation: <strong>{Math.min(budget, approved)}</strong> of {approved} approved<input type="range" min={0} max={Math.max(1, Math.min(maxBudget, approved))} value={Math.min(budget, approved)} onChange={e => onBudget(Number(e.target.value))}/></label>
    <div className="prompt-groups">{promptCategories.filter(c => run.prompts.some(p => p.category === c.id)).map(c => <div key={c.id} className="prompt-group"><h4>{c.label} <em>{run.prompts.filter(p => p.category === c.id).length}</em></h4><ul>{run.prompts.filter(p => p.category === c.id).map(p => {
      const sample = p.sample ? run.samples.find(s => s.id === p.sample!.observationId) : null;
      return <li key={p.id} className={p.selected ? 'on' : 'off'}>
        <label className="rec-check"><input type="checkbox" checked={p.selected} onChange={e => onChange(run.prompts.map(x => x.id === p.id ? { ...x, selected: e.target.checked } : x))} aria-label={(p.selected ? 'Remove ' : 'Approve ') + p.prompt}/></label>
        <div className="rec-body">{editing === p.id ? <form className="rec-edit" onSubmit={e => { e.preventDefault(); const v = draft.trim(); if (v.length >= 12) onChange(run.prompts.map(x => x.id === p.id ? { ...x, prompt: v.slice(0, 300), basis: 'user', template: undefined } : x)); setEditing(null); }}><input autoFocus value={draft} onChange={e => setDraft(e.target.value)} aria-label="Edit prompt"/><button className="rec-icon" aria-label="Save"><Check size={14}/></button></form> : <span className="rec-value">{p.prompt}</span>}
          <span className="rec-meta"><span className="priority-pill" title="Commercial relevance">{p.priority}</span><BasisTag basis={p.basis}/>{editing !== p.id && <button className="rec-icon" aria-label={'Edit prompt ' + p.prompt} onClick={() => { setEditing(p.id); setDraft(p.prompt); }}><Pencil size={13}/></button>}
            {p.sample && <span className={'sample-chip ' + (p.sample.brandMentioned ? 'good' : 'bad')}>{p.sample.brandMentioned ? 'Brand mentioned' : 'Brand absent'}{p.sample.competitors.length ? ' · ' + p.sample.competitors.join(', ') : ''}</span>}</span>
          <small className="rec-note">{p.rationale}</small>
          {sample && <details className="rec-evidence"><summary>Sampled answer ({sample.model}, {sample.collectedAt.slice(0, 10)})</summary><p className="sample-text">{sample.response.slice(0, 1200)}{sample.response.length > 1200 ? '…' : ''}</p>{sample.citations.length > 0 && <ul>{sample.citations.slice(0, 8).map(c => <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer nofollow">{shortUrl(c.url)}</a></li>)}</ul>}<small>{sample.limitations}</small></details>}
        </div></li>; })}</ul></div>)}</div>
    <form className="rec-add" onSubmit={e => { e.preventDefault(); const v = adding.prompt.trim(); if (v.length < 12) return; onChange([...run.prompts, { id: recId('prompt', v) + '-u', prompt: v.slice(0, 300), category: adding.category, market: run.prompts[0]?.market || '', priority: 80, rationale: 'Added by you.', basis: 'user', selected: true }]); setAdding({ ...adding, prompt: '' }); }}>
      <input value={adding.prompt} onChange={e => setAdding({ ...adding, prompt: e.target.value })} placeholder="Add your own prompt (at least 12 characters)" aria-label="Add a prompt"/><select value={adding.category} onChange={e => setAdding({ ...adding, category: e.target.value as PromptCategory })} aria-label="Prompt category">{promptCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select><button className="ghost-button" disabled={adding.prompt.trim().length < 12}><Plus size={14}/>Add</button></form>
  </section>;
}

export function PagesSection({ run, onChange }: { run: DiscoveryRun; onChange: (list: DiscoveryRun['priorityPages']) => void }) {
  const roles = [...new Set(run.priorityPages.map(p => p.role))] as PageRole[];
  return <section className="studio-section" aria-label="Priority pages"><div className="discovery-head"><h3>Priority pages</h3><p className="section-note">Identified from navigation, the sitemap, page types, internal links, calls to action and structured data{run.priorityPages.some(p => p.basis === 'first-party') ? ', plus Search Console traffic' : '. High-performing content needs Search Console or GA4 (connected-client mode)'}. Selected pages are crawled first in the investigation.</p></div>
    <div className="pages-grid">{roles.map(role => <div key={role} className="page-role"><h4>{pageRoleLabel[role]}</h4><ul>{run.priorityPages.filter(p => p.role === role).map(p => <li key={role + p.url} className={p.selected ? 'on' : 'off'}><label className="rec-check"><input type="checkbox" checked={p.selected} onChange={e => onChange(run.priorityPages.map(x => x.url === p.url && x.role === p.role ? { ...x, selected: e.target.checked } : x))} aria-label={(p.selected ? 'Exclude ' : 'Include ') + p.url}/></label><div className="rec-body"><a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="rec-value">{p.title.slice(0, 80)}</a><small>{shortUrl(p.url)}</small><small className="rec-note">{p.reasons.join(' · ')}</small></div></li>)}</ul></div>)}</div>
  </section>;
}

export function ScopeSection({ scope, onChange, member, recommended }: { scope: ScopeRec; onChange: (s: ScopeRec) => void; member: boolean; recommended: AuditMode }) {
  const num = (key: keyof ScopeRec, label: string, min: number, max: number, step = 1) => <label>{label}<input type="number" min={min} max={max} step={step} value={scope[key] as number} onChange={e => onChange({ ...scope, [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })}/></label>;
  return <section className="studio-section" aria-label="Recommended investigation scope"><div className="discovery-head"><h3>Recommended investigation scope</h3><p className="section-note">Based on the site's size and structure, JavaScript dependence, commercial model and your entitlement.</p></div>
    <div className="brief-depths" role="radiogroup" aria-label="Audit mode">{(Object.keys(auditModes) as AuditMode[]).map(mode => <label key={mode} className={'brief-depth' + (scope.mode === mode ? ' selected' : '')}>
      <input type="radio" name="scope-mode" checked={scope.mode === mode} disabled={mode === 'enterprise' && !member} onChange={() => onChange({ ...scope, mode, pageLimit: Math.min(scope.pageLimit, tierCap(mode, member)), linkCheckLimit: Math.min(scope.linkCheckLimit, auditModes[mode].linkChecks), competitorPages: auditModes[mode].competitorPages, aiPromptBudget: Math.min(scope.aiPromptBudget, auditModes[mode].aiPrompts) })}/>
      <strong>{auditModes[mode].label}{mode === recommended && <span className="recommended-badge">Recommended</span>}</strong><small>{auditModes[mode].purpose}</small><em>Up to {tierCap(mode, member).toLocaleString('en-GB')} pages{mode === 'enterprise' && !member ? ' · sign in to unlock' : ''}</em></label>)}</div>
    <div className="brief-grid scope-grid">{num('pageLimit', 'Page budget', 5, tierCap(scope.mode, member), 5)}{num('maxDepth', 'Crawl depth (clicks from home)', 1, 12)}{num('linkCheckLimit', 'Link-check budget', 0, auditModes[scope.mode].linkChecks, 10)}{num('competitorPages', 'Pages per competitor', 1, 12)}{num('performancePages', 'PageSpeed templates', 0, 8)}
      <label className="check"><input type="checkbox" checked={scope.renderJs} onChange={e => onChange({ ...scope, renderJs: e.target.checked })}/> Render JavaScript-dependent pages</label></div>
    <ul className="scope-rationale">{scope.rationale.map(r => <li key={r}>{r}</li>)}</ul>
    <div className="scope-tables"><div><h4>Data sources</h4><div className="table-scroll"><table className="studio-table"><tbody>{scope.sources.map(s => <tr key={s.name}><th scope="row">{s.name}</th><td><span className={'source-status status-' + s.status}>{{ active: 'Active', available: 'Available', 'requires-sign-in': 'Owner sign-in', 'not-configured': 'Not configured' }[s.status]}</span></td><td><small>{s.note}</small></td></tr>)}</tbody></table></div></div>
      <div><h4>Resources and cost</h4><div className="table-scroll"><table className="studio-table"><tbody>{scope.resources.map(r => <tr key={r.label}><th scope="row">{r.label}</th><td>{r.value}</td><td><small>{r.note}</small></td></tr>)}</tbody></table></div></div></div>
  </section>;
}

export function RegenerateMenu({ onRegenerate, disabled }: { onRegenerate: (stage: string) => void; disabled: boolean }) {
  return <details className="regen-menu"><summary className="ghost-button" aria-disabled={disabled}><RefreshCcw size={15}/>Regenerate</summary><div>{[['identify', 'Everything (re-read the website)'], ['competitors', 'Competitors, keywords, prompts and scope'], ['keywords', 'Keywords, prompts and scope'], ['prompts', 'Prompts and AI answer samples'], ['scope', 'Scope only']].map(([id, label]) => <button key={id} disabled={disabled} onClick={e => { (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; onRegenerate(id); }}>{label}</button>)}</div></details>;
}
