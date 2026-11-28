'use client';
import { useMemo, useState } from 'react';
import { Check, ExternalLink, Pencil, Plus, RefreshCcw, Replace, X } from 'lucide-react';
import { basisLabel, competitorKindLabel, keywordGroupLabel, pageRoleLabel, recId, type Basis, type BusinessProfile, type CompetitorRec, type DiscoveryRun, type EvidenceRef, type KeywordGroup, type PageRole, type PromptRec, type Rec, type ScopeRec } from '@/lib/intel/discovery-model';
import { promptCategories } from '@/lib/intel/geo';
import { lexiconDiff, type Coverage, type FactorBasis, type Lexicon } from '@/lib/intel/lexicon';
import type { DiscoveryIndex } from '@/lib/intel/discovery-index';
import type { Comparison } from '@/lib/intel/observations';
import type { VistaGraph } from '@/lib/intel/graph';
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
const coverageLabel: Record<Coverage, string> = { targeted: 'Targeted', headings: 'In headings', body: 'In body text', none: 'Content gap' };
const factorBasisLabel: Record<FactorBasis, string> = { observed: 'Observed', estimate: 'Estimate', measured: 'Measured', unavailable: 'Unavailable' };

export function KeywordSection({ run, onChange, previous }: { run: DiscoveryRun; onChange: (list: DiscoveryRun['keywords']) => void; previous?: Lexicon | null }) {
  const [group, setGroup] = useState<KeywordGroup | 'all' | 'selected' | 'gaps'>('all');
  const [topic, setTopic] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const lex = run.lexicon;
  const entries = useMemo(() => new Map((lex?.entries || []).map(e => [e.id, e])), [lex]);
  const topics = useMemo(() => new Map((lex?.topics || []).map(t => [t.id, t])), [lex]);
  const shown = useMemo(() => run.keywords.filter(k => {
    const e = entries.get(k.id);
    if (topic && e?.topic !== topic) return false;
    if (group === 'gaps') return e?.coverage === 'none' && e.action.kind === 'create';
    return (group === 'all' || (group === 'selected' ? k.selected : k.groups.includes(group))) && (!query || k.keyword.includes(query.toLowerCase()));
  }).sort((a, b) => (entries.get(b.id)?.score ?? b.priority) - (entries.get(a.id)?.score ?? a.priority) || a.keyword.localeCompare(b.keyword)), [run.keywords, entries, group, topic, query]);
  const diff = useMemo(() => (previous && lex ? lexiconDiff(previous, lex) : null), [previous, lex]);
  const bulk = (selected: boolean) => { const ids = new Set(shown.map(k => k.id)); onChange(run.keywords.map(k => ids.has(k.id) ? { ...k, selected } : k)); };
  const demand = (k: DiscoveryRun['keywords'][number]) => k.metrics?.impressions !== undefined ? <span title={k.metrics.source + (k.metrics.collectedAt ? ', ' + k.metrics.collectedAt.slice(0, 10) : '')}>{k.metrics.impressions.toLocaleString('en-GB')} impr.{k.metrics.position !== undefined ? ' · pos ' + k.metrics.position : ''}</span>
    : k.metrics?.volume !== undefined ? <span title={k.metrics.source}>{k.metrics.volume.toLocaleString('en-GB')}/mo</span>
    : <span className="not-measured" title="Not measured: connect Search Console (impressions and positions) or an authorised Google Ads Keyword Planner account. VisTa does not estimate search volume.">Unavailable</span>;
  const gapCount = lex ? lex.entries.filter(e => e.coverage === 'none' && e.action.kind === 'create').length : 0;
  return <section className="studio-section" aria-label="Keyword intelligence"><div className="discovery-head"><h3>Keyword intelligence <small className="lex-badge">VisTa Lexicon</small></h3><p className="section-note">{run.keywords.length} keywords (variants merged) from the site's offerings, structured data, headings and navigation, competitor pages and questions, and industry vocabulary.{lex ? ' Each keyword is mapped to the client page that targets it (or marked as a content gap), grouped into ' + lex.topics.length + ' topics and given a VisTa opportunity score: a transparent estimate built from observed site and competitor evidence, not a Google search volume or ranking. Open a score to see its factors.' : ''} The top 25 selected keywords guide page analysis.</p>
    {lex && <p className="lex-coverage" role="note">Computed from {lex.coverage.clientPages} client page{lex.coverage.clientPages === 1 ? '' : 's'} and {lex.coverage.competitorPages} page{lex.coverage.competitorPages === 1 ? '' : 's'} from {lex.coverage.competitorSites} verified competitor{lex.coverage.competitorSites === 1 ? '' : 's'}{lex.coverage.observedFrom ? ', observed ' + lex.coverage.observedFrom.slice(0, 10) + (lex.coverage.observedTo.slice(0, 10) !== lex.coverage.observedFrom.slice(0, 10) ? ' to ' + lex.coverage.observedTo.slice(0, 10) : '') : ''}. {lex.unavailable.join('. ')}.</p>}
    {diff && <p className="lex-history" role="note">Since the discovery of {diff.since.slice(0, 10)}: {diff.added.length} new, {diff.removed.length} no longer found, {diff.changed.length} re-scored by 5 points or more{diff.coverageGained.length ? ', ' + diff.coverageGained.length + ' gaps now covered' : ''}.</p>}</div>
    {lex && <div className="topic-chips" role="toolbar" aria-label="Keyword topics"><button className={'filter-chip' + (!topic ? ' active' : '')} aria-pressed={!topic} onClick={() => setTopic(null)}>All topics <em>{lex.topics.length}</em></button>{lex.topics.slice(0, 24).map(t => <button key={t.id} className={'filter-chip' + (topic === t.id ? ' active' : '')} aria-pressed={topic === t.id} title={'Top score ' + t.score + (t.gaps ? ' · ' + t.gaps + ' content gap' + (t.gaps === 1 ? '' : 's') : '') + (t.related.length ? ' · related: ' + t.related.map(r => r.label + ' (' + r.reason + ')').join('; ') : '')} onClick={() => setTopic(topic === t.id ? null : t.id)}>{t.label} <em>{t.keywords.length}</em></button>)}</div>}
    {topic && topics.get(topic)?.related.length ? <p className="topic-related">Related topics: {topics.get(topic)!.related.map(r => <button key={r.id} className="link-button" onClick={() => setTopic(r.id)}>{r.label}</button>).reduce<React.ReactNode[]>((a, b, i) => i ? [...a, ', ', b] : [b], [])} <small>({topics.get(topic)!.related.map(r => r.reason).join('; ')})</small></p> : null}
    <div className="kw-filters" role="toolbar" aria-label="Keyword filters">{(['all', 'selected', ...(lex ? ['gaps'] as const : []), ...groups] as const).map(g => <button key={g} className={'filter-chip' + (group === g ? ' active' : '')} aria-pressed={group === g} onClick={() => setGroup(g)}>{g === 'all' ? 'All' : g === 'selected' ? 'Selected' : g === 'gaps' ? 'Content gaps' : keywordGroupLabel[g]} <em>{g === 'all' ? run.keywords.length : g === 'selected' ? run.keywords.filter(k => k.selected).length : g === 'gaps' ? gapCount : run.keywords.filter(k => k.groups.includes(g)).length}</em></button>)}</div>
    <div className="kw-actions"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter keywords" aria-label="Filter keywords"/><button className="ghost-button" onClick={() => bulk(true)}>Select shown ({shown.length})</button><button className="ghost-button" onClick={() => bulk(false)}>Clear shown</button><span>{run.keywords.filter(k => k.selected).length} selected · the top 25 by priority guide page analysis</span></div>
    <div className="table-scroll"><table className="studio-table kw-table"><thead><tr><th scope="col"><span className="sr-only">Selected</span></th><th scope="col">Keyword</th><th scope="col">Topic</th><th scope="col">Intent</th><th scope="col" title="VisTa opportunity score: an estimate, not a Google metric">Opportunity <small>(estimate)</small></th><th scope="col">Client page</th><th scope="col">Competitors</th><th scope="col">Measured demand</th><th scope="col">Source</th></tr></thead>
      <tbody>{shown.slice(0, all ? 400 : 60).map(k => { const e = entries.get(k.id); return <tr key={k.id}><td><input type="checkbox" checked={k.selected} onChange={ev => onChange(run.keywords.map(x => x.id === k.id ? { ...x, selected: ev.target.checked } : x))} aria-label={'Select ' + k.keyword}/></td><th scope="row">{k.keyword}<span className="kw-groups">{k.groups.filter(g => g !== 'non-branded').map(g => <span key={g} className={'group-chip group-' + g}>{keywordGroupLabel[g]}</span>)}{e?.longTail && <span className="group-chip group-long-tail-opportunity">Long-tail opportunity</span>}</span></th>
        <td><small>{e ? topics.get(e.topic)?.label : k.cluster}</small></td><td>{k.intent}</td>
        <td>{e ? <details className="lex-score"><summary aria-label={'Opportunity score ' + e.score + ': show factors'}><span className="priority-bar"><i style={{ width: e.score + '%' }}/></span>{e.score}</summary><ul className="lex-factors">{e.factors.map(f => <li key={f.id}><span>{f.label}</span><strong>{f.points}/{f.max}</strong><small className={'factor-basis basis-' + f.basis}>{factorBasisLabel[f.basis]}</small><small className="factor-detail">{f.detail}</small></li>)}</ul></details> : <><span className="priority-bar"><i style={{ width: k.priority + '%' }}/></span>{k.priority}</>}</td>
        <td>{e ? <><span className={'coverage-chip coverage-' + e.coverage}>{coverageLabel[e.coverage]}</span>{e.target && <a href={e.target.url} target="_blank" rel="noopener noreferrer nofollow" className="kw-target">{shortUrl(e.target.url)}</a>}<small className="kw-action">{e.action.label}</small></> : <small>—</small>}</td>
        <td>{e && e.competitorUse.of ? <span title={e.competitorUse.sites.map(shortUrl).join(', ')}>{e.competitorUse.sites.length} of {e.competitorUse.of}</span> : <span className="not-measured" title="No verified competitor pages were sampled">—</span>}</td>
        <td>{demand(k)}</td><td><small>{k.metrics ? k.metrics.source : k.sources[0]}</small><BasisTag basis={k.basis}/></td></tr>; })}</tbody></table></div>
    {shown.length > 60 && !all && <button className="link-button" onClick={() => setAll(true)}>Show all {shown.length} keywords</button>}
    {lex && <p className="lex-method"><small>{lex.method}</small></p>}
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

const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'date unknown';
function ComparisonCard({ c, beforeLabel }: { c: Comparison; beforeLabel: string }) {
  const failed = c.changes.some(x => x.field === 'error');
  return <li className={'index-compare' + (c.unchanged ? ' same' : '')}>
    <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="rec-value">{shortUrl(c.url)}</a>
    <small>{beforeLabel}{c.before.crawl ? ' ' + c.before.crawl : ''}, {fmtDate(c.before.at)} → live, {fmtDate(c.after.at)}{c.similarity !== null ? ' · content similarity ' + Math.round(c.similarity * 100) + '%' : ''}</small>
    {c.limitation && <small className="rec-note">{c.limitation}</small>}
    {failed ? <small className="rec-note">{c.changes[0].after}</small> : c.unchanged ? <small className="index-same">No change detected</small> :
      <ul>{c.changes.slice().sort((a, b) => Number(b.major) - Number(a.major)).map(x => <li key={x.field}><strong className={x.major ? 'major' : ''}>{x.label}</strong><span>{x.before.slice(0, 140)}</span><span aria-hidden="true">→</span><span>{x.after.slice(0, 140)}</span></li>)}</ul>}
  </li>;
}

export function IndexSection({ index, history, stored }: { index: DiscoveryIndex; history: Comparison[]; stored: number }) {
  const a = index.archive;
  return <section className="studio-section" aria-label="Website history"><div className="discovery-head"><h3>Website history <small className="lex-badge">VisTa Index</small></h3><p className="section-note">Dated observations of the website from VisTa's crawler and the Common Crawl open web archive. VisTa keeps derived observations only (titles, headings, word counts, links, structured data types and content fingerprints), never copies of pages. Archived evidence is historical and dated by its capture.</p></div>
    {a.skipped ? <p className="rec-note">{a.skipped}</p> : a.error ? <p className="rec-note">Web archive unavailable: {a.error}</p> :
      <div className="table-scroll"><table className="studio-table"><thead><tr><th scope="col">Common Crawl crawl</th><th scope="col">Archived URLs</th><th scope="col">Captured</th></tr></thead><tbody>{a.crawls.map(c => <tr key={c.crawl}><th scope="row">{c.crawl}</th><td>{c.error ? <span className="not-measured">{c.error}</span> : c.capturedUrls.toLocaleString('en-GB') + (c.truncated ? '+ (bounded sample)' : '')}</td><td>{c.first ? fmtDate(c.first) + (c.last.slice(0, 10) !== c.first.slice(0, 10) ? ' to ' + fmtDate(c.last) : '') : '—'}</td></tr>)}</tbody></table></div>}
    {a.notInInventory.length > 0 && <details className="rec-evidence"><summary>{a.notInInventory.length} archived URL{a.notInInventory.length === 1 ? '' : 's'} not found in the sitemap or the sampled links</summary><ul>{a.notInInventory.map(u => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer nofollow">{shortUrl(u)}</a></li>)}</ul></details>}
    {index.comparisons.length > 0 && <><h4 className="index-h">Archived versus live</h4><ul className="index-compares">{index.comparisons.map(c => <ComparisonCard key={c.url} c={c} beforeLabel="Common Crawl"/>)}</ul></>}
    {!a.skipped && !a.error && !index.comparisons.length && <p className="rec-note">None of the priority pages has an archived HTML capture in these crawls, so no archived-versus-live comparison was possible.</p>}
    {history.length > 0 && <><h4 className="index-h">Since VisTa last observed these pages</h4><ul className="index-compares">{history.map(c => <ComparisonCard key={'h' + c.url} c={c} beforeLabel="VisTa"/>)}</ul></>}
    <p className="lex-coverage">{a.limitation || 'Common Crawl is a sample of the public web.'} {stored ? stored + ' page observations are kept in this browser for future comparisons.' : ''} <a href={a.terms} target="_blank" rel="noopener noreferrer">Common Crawl terms of use</a>.</p>
  </section>;
}

const kindLabel: Record<string, string> = { client: 'Client', competitor: 'Competitor', source: 'Cited source', linked: 'Linked' };
export function GraphSection({ graph, brand }: { graph: VistaGraph; brand: string }) {
  const sector = graph.domains.filter(d => !d.platform && d.kind !== 'client').slice(0, 12);
  const platforms = graph.domains.filter(d => d.platform).slice(0, 8);
  const internal = graph.internal.filter(p => p.sampled || p.priority).slice(0, 10);
  const c = graph.coverage;
  return <section className="studio-section" aria-label="Authority and relationships"><div className="discovery-head"><h3>Authority and relationships <small className="lex-badge">VisTa Graph</small></h3><p className="section-note">Links VisTa observed on the client's pages, the verified competitors' pages and pages cited in sampled AI answers, with organisations and profiles from structured data. Authority values are VisTa estimates relative to this graph, not third-party metrics.</p>
    <p className="lex-coverage" role="note"><strong>{c.statement}</strong>{c.observedFrom ? ' Observed ' + fmtDate(c.observedFrom) + (c.observedTo.slice(0, 10) !== c.observedFrom.slice(0, 10) ? ' to ' + fmtDate(c.observedTo) : '') + '.' : ''}</p></div>
    <div className="graph-grid">
      <div><h4 className="index-h">Internal link authority</h4><div className="table-scroll"><table className="studio-table"><thead><tr><th scope="col">Page</th><th scope="col">Authority <small>(estimate)</small></th><th scope="col">Linked from</th></tr></thead><tbody>{internal.map(p => <tr key={p.url}><th scope="row"><a href={p.url} target="_blank" rel="noopener noreferrer nofollow">{shortUrl(p.url)}</a>{p.priority && <span className="group-chip group-primary">Priority</span>}</th><td><span className="priority-bar"><i style={{ width: p.authority + '%' }}/></span>{p.authority}</td><td>{p.inlinks} page{p.inlinks === 1 ? '' : 's'}</td></tr>)}</tbody></table></div>
        {graph.weakPriority.length > 0 ? <p className="rec-note">No internal links were observed to {graph.weakPriority.length} priority page{graph.weakPriority.length === 1 ? '' : 's'} from the sampled pages: {graph.weakPriority.slice(0, 4).map(shortUrl).join(', ')}.</p> : <p className="rec-note">Every priority page is linked from at least one sampled page.</p>}</div>
      <div><h4 className="index-h">Observed links to {brand}</h4>{graph.referringToClient.length ? <ul className="graph-list">{graph.referringToClient.map(r => <li key={r.domain}><strong>{r.domain}</strong> <small>{kindLabel[r.kind]} · {r.pages.length} page{r.pages.length === 1 ? '' : 's'}</small><small>{r.pages.slice(0, 2).map(shortUrl).join(', ')}</small></li>)}</ul> : <p className="rec-note">None of the {c.pages - c.clientPages} other pages VisTa crawled links to {brand}. This covers only those pages, not the wider web.</p>}
        <h4 className="index-h">Sector authorities (co-citation)</h4>{graph.coCitation.length ? <ul className="graph-list">{graph.coCitation.slice(0, 10).map(x => <li key={x.domain}><strong>{x.domain}</strong><small>{x.linkedBy.length ? 'Linked by ' + x.linkedBy.map(n => n === 'client' ? brand : n).join(', ') : ''}{x.linkedBy.length && x.citations ? ' · ' : ''}{x.citations ? 'cited ' + x.citations + ' time' + (x.citations === 1 ? '' : 's') + ' in sampled AI answers' : ''}</small></li>)}</ul> : <p className="rec-note">No domain is linked or cited by two or more of the client, its competitors and the sampled AI answers.</p>}</div>
    </div>
    <h4 className="index-h">Domains in the observed graph</h4>
    <div className="table-scroll"><table className="studio-table"><thead><tr><th scope="col">Domain</th><th scope="col">Role</th><th scope="col">Linked from</th><th scope="col">Observed-graph authority <small>(estimate)</small></th></tr></thead><tbody>{sector.map(d => <tr key={d.domain}><th scope="row">{d.domain}</th><td>{kindLabel[d.kind]}</td><td title={d.referringDomains.join(', ')}>{d.referringDomains.length} website{d.referringDomains.length === 1 ? '' : 's'} · {d.linkingPages} page{d.linkingPages === 1 ? '' : 's'}</td><td><span className="priority-bar"><i style={{ width: d.authority + '%' }}/></span>{d.authority}</td></tr>)}</tbody></table></div>
    {platforms.length > 0 && <p className="rec-note">Social and community platforms linked: {platforms.map(d => d.domain + ' (' + d.referringDomains.length + ')').join(', ')}.</p>}
    {(graph.entities.organisations.length > 0 || graph.entities.authors.length > 0) && <details className="rec-evidence"><summary>Organisations, authors and profiles in structured data</summary><ul>{graph.entities.organisations.map(o => <li key={o.name}><span><strong>{o.name}</strong> · {o.site}</span>{o.sameAs.length > 0 && <span>{o.sameAs.map(shortUrl).join(', ')}</span>}</li>)}{graph.entities.authors.length > 0 && <li><span><strong>Authors on the client's pages</strong></span><span>{graph.entities.authors.join(', ')}</span></li>}</ul></details>}
    <p className="lex-method"><small>{graph.method}</small></p>
  </section>;
}

export function RegenerateMenu({ onRegenerate, disabled }: { onRegenerate: (stage: string) => void; disabled: boolean }) {
  return <details className="regen-menu"><summary className="ghost-button" aria-disabled={disabled}><RefreshCcw size={15}/>Regenerate</summary><div>{[['identify', 'Everything (re-read the website)'], ['competitors', 'Competitors, keywords, prompts and scope'], ['keywords', 'Keywords, prompts and scope'], ['prompts', 'Prompts and AI answer samples'], ['scope', 'Scope only']].map(([id, label]) => <button key={id} disabled={disabled} onClick={e => { (e.currentTarget.closest('details') as HTMLDetailsElement).open = false; onRegenerate(id); }}>{label}</button>)}</div></details>;
}
