'use client';
import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarPlus, CheckCircle2, CircleSlash, FileText, Link2 } from 'lucide-react';
import type { Analysis } from '@/lib/intel/analysis';
import * as charts from '@/lib/intel/charts';
import { evidenceClassLabel, type EvidenceClass, type Investigation } from '@/lib/intel/model';
import { geoReadiness } from '@/lib/intel/site';
import { signalProfile } from '@/lib/intel/scoring';
import { median } from '@/lib/intel/findings';
import { createOutline, emptyWorkspace, parseWorkspace, storageKey } from '@/lib/workspace';
import VistaChart from './vista-chart';
import { EvidenceBadge, FindingCard, Metric, PageProfile } from './studio-ui';

type Panel = { inv: Investigation; analysis: Analysis };
const Grid = ({ children }: { children: React.ReactNode }) => <div className="studio-charts">{children}</div>;
const show = <T,>(spec: T | null, render: (s: T) => React.ReactNode) => (spec ? render(spec) : null);

function Findings({ inv, analysis, modules, empty }: Panel & { modules: string[]; empty: string }) {
  const list = analysis.findings.filter(f => modules.includes(f.module));
  return <section className="studio-section"><h3>Findings ({list.length})</h3>{list.length ? list.map(f => <FindingCard key={f.id} finding={f} competitors={inv.competitors} intervention={analysis.interventions.find(i => i.findingId === f.id)}/>) : <p className="empty-copy">{empty}</p>}</section>;
}

export function Cockpit({ inv, analysis, goTo }: Panel & { goTo: (tab: string) => void }) {
  const { index } = analysis;
  const counts = (['critical', 'high', 'medium', 'low'] as const).map(s => analysis.findings.filter(f => f.severity === s).length);
  const classes = index.dimensions.reduce((acc, d) => ({ ...acc, [d.evidenceClass]: (acc[d.evidenceClass] || 0) + 1 }), {} as Partial<Record<EvidenceClass, number>>);
  return <div className="studio-panel">
    <section className="cockpit-hero">
      <div className="cockpit-index">
        <span className="eyebrow">VisTa INTELLIGENCE INDEX</span>
        {index.index !== null ? <><strong><Metric label="" value={index.index}/></strong><p>Range {index.range![0]}–{index.range![1]} · evidence coverage {Math.round(index.coverage * 100)}%</p></> : <><strong className="not-calculated">Not calculated</strong><p>{index.reason}</p></>}
        <details><summary>Scoring methodology</summary><p>{index.method}</p><p>{index.reason}</p></details>
      </div>
      <div className="cockpit-metrics">
        <Metric label="Pages analysed" value={inv.pages.length} note={inv.failures.length + ' failed or restricted'}/>
        <Metric label="Critical + high findings" value={counts[0] + counts[1]} tone={counts[0] ? 'bad' : counts[1] ? 'warn' : 'good'}/>
        <Metric label="Technically indexable" value={inv.pages.length ? Math.round(analysis.site.indexability.indexable / inv.pages.length * 100) : null} suffix="%"/>
        <Metric label="AI mention rate" value={analysis.geo.n ? Math.round(analysis.geo.mentionRate.value * 100) : null} suffix="%" note={analysis.geo.n ? 'n=' + analysis.geo.n + ' · 95% CI ' + Math.round(analysis.geo.mentionRate.low * 100) + '–' + Math.round(analysis.geo.mentionRate.high * 100) + '%' : 'No observations yet'}/>
        <Metric label="Competitors sampled" value={inv.competitors.filter(c => c.pages.length).length}/>
        <Metric label="Interventions" value={analysis.interventions.length} note={analysis.phases.map(p => p.items.length).join(' / ') + ' across 30/60/90 days'}/>
      </div>
    </section>
    <Grid>{show(charts.capabilityRadar(index), s => <VistaChart spec={s}/>)}{show(charts.kpiBullets(inv, analysis.site, inv.settings?.targets), s => <VistaChart spec={s} height={300}/>)}</Grid>
    <section className="studio-section">
      <h3>Data coverage and confidence</h3>
      <p className="legend-row">{(Object.keys(evidenceClassLabel) as EvidenceClass[]).map(k => <span key={k}><EvidenceBadge kind={k}/> {classes[k] || 0}</span>)}</p>
      <div className="table-scroll"><table className="studio-table"><thead><tr><th>Dimension</th><th>Score</th><th>Coverage</th><th>Evidence</th><th>Basis</th><th>Measured</th><th>Assumptions</th></tr></thead><tbody>
        {index.dimensions.map(d => <tr key={d.id}><th scope="row">{d.label}</th><td>{d.score ?? '—'}</td><td><span className="coverage-bar"><i style={{ width: Math.round(d.coverage * 100) + '%' }}/></span>{Math.round(d.coverage * 100)}%</td><td><EvidenceBadge kind={d.evidenceClass}/></td><td>{d.basis}</td><td>{d.measuredAt ? d.measuredAt.slice(0, 10) : '—'}</td><td>{d.assumptions}</td></tr>)}
      </tbody></table></div>
    </section>
    <section className="studio-section">
      <h3>Priority strategic interventions</h3>
      <ol className="priority-list">{analysis.interventions.slice(0, 6).map(i => <li key={i.id}><span className="priority-score">{i.priority}</span><div><strong>{i.finding}</strong><p>{i.action}</p><small>{i.evidenceId} · {i.phase}-day phase · effort {i.effortDays.join('–')} days · {i.metric}</small></div></li>)}</ol>
      {!analysis.interventions.length && <p className="empty-copy">No interventions yet. Run an investigation to generate evidence-backed priorities.</p>}
      <div className="studio-links"><button onClick={() => goTo('decisions')}>Open the Decision Room</button><button onClick={() => goTo('executive')}>Generate executive report</button></div>
    </section>
  </div>;
}

export function Technical({ inv, analysis }: Panel) {
  const [profile, setProfile] = useState<string | null>(null);
  const [sort, setSort] = useState<'issues' | 'depth' | 'words'>('issues');
  const page = profile ? inv.pages.find(p => p.finalUrl === profile || p.finalUrl.replace(/\/$/, '') === profile.replace(/\/$/, '')) : null;
  const issues = (p: Investigation['pages'][number]) => p.headingIssues.length + (p.indexable ? 0 : 2) + (p.title ? 0 : 2) + (p.description ? 0 : 1) + (p.images.missingAlt ? 1 : 0) + (p.schema.types.length ? 0 : 1) + (p.content.words < 250 ? 1 : 0);
  const rows = useMemo(() => [...inv.pages].sort((a, b) => sort === 'issues' ? issues(b) - issues(a) : sort === 'depth' ? b.depth - a.depth : b.content.words - a.content.words), [inv.pages, sort]);
  const drill = (target: string) => { if (target.startsWith('http')) setProfile(target); };
  const d = inv.discovery;
  return <div className="studio-panel">
    <div className="metric-row">
      <Metric label="Pages crawled" value={inv.pages.length}/><Metric label="Broken internal links" value={analysis.site.brokenInternal.length} tone={analysis.site.brokenInternal.length ? 'bad' : 'good'}/><Metric label="Redirect chains" value={analysis.site.redirects.length}/><Metric label="Non-indexable" value={analysis.site.indexability.nonIndexable}/><Metric label="Sitemap URLs" value={analysis.site.sitemapCoverage.inSitemap}/><Metric label="Orphans" value={analysis.site.orphans.state === 'assessed' ? analysis.site.orphans.urls.length : null} note={analysis.site.orphans.state === 'insufficient' ? 'Insufficient inventory' : undefined}/>
    </div>
    {d && <section className="studio-section source-strip">
      <span>{d.robots.state === 'found' ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>} robots.txt: {d.robots.state}{d.robots.blocksAll ? ' — blocks search engines' : d.robots.blocksVista ? ' — restricts VisTa (respected)' : ''}</span>
      <span><Link2 size={15}/> {d.sitemaps.length ? d.sitemaps.map(s => s.kind + ' (' + s.entries + ')').join(', ') : 'No sitemap found'}</span>
      <span>Home: HTTP {d.home?.status ?? '—'} · {d.home?.durationMs ?? '—'} ms · {d.home?.trust.https ? 'HTTPS' : 'HTTP'}</span>
      <span>Collected {d.collectedAt.slice(0, 16).replace('T', ' ')} UTC</span>
    </section>}
    <Grid>
      {show(charts.crawlFunnel(inv, analysis.site), s => <VistaChart spec={s} height={300}/>)}
      {show(charts.responseSankey(inv), s => <VistaChart spec={s} height={300}/>)}
      {show(charts.architectureSunburst(analysis.site), s => <VistaChart spec={s} height={360}/>)}
      {show(charts.issueHeatmap(inv), s => <VistaChart spec={s} height={360} onDrill={drill}/>)}
      {show(charts.linkNetwork(analysis.site), s => <VistaChart spec={s} height={400} onDrill={drill}/>)}
      {show(charts.severityMatrix(analysis.findings), s => <VistaChart spec={s} height={300}/>)}
      {show(charts.depthBars(analysis.site), s => <VistaChart spec={s} height={260}/>)}
      {show(charts.performanceComparison(inv), s => <VistaChart spec={s} height={300}/>)}
    </Grid>
    {!inv.performance.length && <p className="dependency-note"><CircleSlash size={14}/> Performance measurements were not collected (PageSpeed Insights not run or unavailable). HTML performance indicators are still assessed.</p>}
    <section className="studio-section">
      <div className="section-head"><h3>Page-level health profiles</h3><label>Sort by <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="issues">Most issues</option><option value="depth">Deepest</option><option value="words">Most content</option></select></label></div>
      <div className="table-scroll"><table className="studio-table"><thead><tr><th>Page</th><th>Type</th><th>Depth</th><th>Indexable</th><th>Words</th><th>Issue signals</th><th>GEO</th></tr></thead><tbody>
        {rows.slice(0, 200).map(p => <tr key={p.finalUrl}><th scope="row"><button className="link-button" onClick={() => setProfile(p.finalUrl)}>{new URL(p.finalUrl).pathname.slice(0, 60) || '/'}</button></th><td>{p.pageType}</td><td>{p.depth < 0 ? 'sitemap' : p.depth}</td><td>{p.indexable ? 'Yes' : 'No'}</td><td>{p.content.words}</td><td>{issues(p)}</td><td>{geoReadiness(p).score}</td></tr>)}
      </tbody></table></div>
    </section>
    <Findings inv={inv} analysis={analysis} modules={['architecture', 'indexability', 'on-page', 'performance', 'accessibility']} empty="No technical findings for the crawled pages."/>
    {page && <PageProfile page={page} onClose={() => setProfile(null)}/>}
  </div>;
}

export function Content({ inv, analysis, projectId }: Panel & { projectId: string }) {
  const [created, setCreated] = useState<string[]>([]);
  const content = inv.pages.filter(p => p.indexable);
  const gaps = [...inv.brief.keywords.filter(k => !inv.pages.some(p => p.keywords.find(x => x.keyword === k.toLowerCase())?.inTitle)), ...analysis.opportunities.map(o => o.prompt)].slice(0, 12);
  function createBrief(topic: string) {
    try {
      const raw = localStorage.getItem(storageKey);
      const w = raw ? parseWorkspace(raw) : emptyWorkspace();
      if (!w.projects.some(p => p.id === projectId)) return;
      const intent = /how|why|what|guide/i.test(topic) ? 'Informational' : /best|vs|compare|alternative/i.test(topic) ? 'Commercial investigation' : 'Transactional';
      w.briefs = [{ id: crypto.randomUUID(), projectId, topic: topic.slice(0, 160), intent, audience: inv.brief.audience, outline: createOutline(topic, inv.brief.audience, intent, inv.brief.objectives[0] || ''), status: 'Draft' as const }, ...w.briefs].slice(0, 1000);
      localStorage.setItem(storageKey, JSON.stringify(w));
      window.dispatchEvent(new Event('vista-update'));
      setCreated(c => [...c, topic]);
    } catch { /* Storage may be unavailable. */ }
  }
  const calendar = gaps.slice(0, 8).map((topic, i) => ({ topic, week: new Date(Date.now() + (i + 1) * 7 * 86400000).toISOString().slice(0, 10) }));
  return <div className="studio-panel">
    <div className="metric-row">
      <Metric label="Indexable content pages" value={content.length}/><Metric label="Median words" value={median(content.map(p => p.content.words))}/><Metric label="Average GEO readiness" value={content.length ? Math.round(content.reduce((s, p) => s + geoReadiness(p).score, 0) / content.length) : null} suffix="/100"/><Metric label="Topic clusters" value={analysis.site.clusters.length}/><Metric label="Near-duplicate pairs" value={analysis.site.nearDuplicates.length}/>
    </div>
    <Grid>{show(charts.contentTreemap(analysis.site), s => <VistaChart spec={s} height={340}/>)}{show(charts.readinessScatter(inv, analysis.site), s => <VistaChart spec={s} height={340}/>)}</Grid>
    <section className="studio-section"><h3>Search intent mapping</h3><div className="intent-row">{Object.entries(analysis.site.intents).map(([k, v]) => <span key={k}><strong>{v}</strong>{k}</span>)}{Object.entries(analysis.site.pageTypes).map(([k, v]) => <span key={k} className="muted"><strong>{v}</strong>{k} pages</span>)}</div></section>
    <section className="studio-section"><h3>Content gaps and intelligent briefs</h3><p className="section-note">Gaps come from target keywords without a focused page and from AI prompts where competitors are mentioned but the client is not.</p>
      {gaps.length ? <ul className="gap-list">{gaps.map(g => <li key={g}><span>{g}</span><button onClick={() => createBrief(g)} disabled={created.includes(g)}><FileText size={14}/>{created.includes(g) ? 'Brief created' : 'Create brief'}</button></li>)}</ul> : <p className="empty-copy">No keyword or AI visibility gaps recorded yet. Add target keywords or AI observations.</p>}
      {calendar.length > 0 && <><h4><CalendarPlus size={15}/> Proposed editorial calendar</h4><div className="table-scroll"><table className="studio-table"><thead><tr><th>Week commencing</th><th>Topic</th><th>Source</th></tr></thead><tbody>{calendar.map(c => <tr key={c.topic}><td>{c.week}</td><th scope="row">{c.topic}</th><td>{inv.brief.keywords.includes(c.topic) ? 'Keyword gap' : 'GEO opportunity'}</td></tr>)}</tbody></table></div></>}
    </section>
    <section className="studio-section"><h3>Content inventory</h3><div className="table-scroll"><table className="studio-table"><thead><tr><th>Page</th><th>Type</th><th>Intent</th><th>Words</th><th>GEO readiness</th><th>Dated</th><th>Author</th></tr></thead><tbody>
      {content.slice(0, 200).map(p => <tr key={p.finalUrl}><th scope="row"><a href={p.finalUrl} target="_blank" rel="noopener noreferrer nofollow">{p.title?.slice(0, 70) || new URL(p.finalUrl).pathname}</a></th><td>{p.pageType}</td><td>{p.intent}</td><td>{p.content.words}</td><td>{geoReadiness(p).score}</td><td>{p.dates?.modified?.slice(0, 10) || p.dates?.published?.slice(0, 10) || '—'}</td><td>{p.trust.authorSignal ? 'Yes' : 'No'}</td></tr>)}
    </tbody></table></div></section>
    <Findings inv={inv} analysis={analysis} modules={['content', 'geo']} empty="No content findings."/>
  </div>;
}

export function Authority({ inv, analysis }: Panel) {
  const org = inv.pages.map(p => p.schema.organisation).find(Boolean);
  const ratings = inv.pages.filter(p => p.schema.rating);
  const home = inv.pages.find(p => p.depth === 0) || inv.pages[0];
  const cited = new Map<string, number>();
  for (const p of inv.pages) for (const l of p.links.external) { try { const h = new URL(l.url).hostname.replace(/^www\./, ''); cited.set(h, (cited.get(h) || 0) + 1); } catch { /* skip */ } }
  return <div className="studio-panel">
    <div className="metric-row">
      <Metric label="Organisation entity" value={org ? 1 : 0} note={org?.name || 'Not declared'}/><Metric label="Declared profiles" value={org?.sameAs.length ?? 0}/><Metric label="Named authors" value={new Set(inv.pages.flatMap(p => p.schema.authors)).size}/><Metric label="Cited external domains" value={cited.size}/><Metric label="Pages with review ratings" value={ratings.length}/>
    </div>
    <Grid>{show(charts.entityNetwork(inv), s => <VistaChart spec={s} height={400}/>)}</Grid>
    {home && <section className="studio-section"><h3>Trust and identity checklist</h3><ul className="checklist">{[['HTTPS', home.trust.https], ['HSTS header', home.trust.hsts], ['Content-Security-Policy', home.trust.csp], ['Contact page linked', home.trust.contactLink], ['About page linked', home.trust.aboutLink], ['Privacy policy linked', home.trust.privacyLink], ['Terms linked', home.trust.termsLink], ['Telephone or address published', inv.pages.some(p => p.trust.telephone || p.trust.address)], ['Organization structured data', Boolean(org)], ['Author attribution on articles', inv.pages.filter(p => p.pageType === 'article').every(p => p.trust.authorSignal)]].map(([label, ok]) => <li key={String(label)} className={ok ? 'ok' : 'missing'}>{ok ? <CheckCircle2 size={15}/> : <CircleSlash size={15}/>}{label as string}</li>)}</ul></section>}
    <section className="studio-section"><h3>Reputation signals</h3>
      {ratings.length ? <ul className="gap-list">{ratings.slice(0, 10).map(p => <li key={p.finalUrl}><span>{p.title || p.finalUrl}</span><span>{p.schema.rating!.value} from {p.schema.rating!.count} reviews (self-declared structured data)</span></li>)}</ul> : <p className="empty-copy">No review ratings were declared on the crawled pages.</p>}
      <p className="dependency-note"><CircleSlash size={14}/> Media coverage, brand mentions, sentiment and third-party reviews require a connected media or review monitoring provider. None is connected, so no reputation metrics are shown.</p>
    </section>
    <p className="dependency-note"><CircleSlash size={14}/> Backlink and referring-domain intelligence requires a licensed provider (for example Ahrefs, Semrush or Majestic). VisTa does not estimate backlinks without one.</p>
    <Findings inv={inv} analysis={analysis} modules={['trust', 'authority']} empty="No trust or authority findings."/>
  </div>;
}

export function Competitors({ inv, analysis }: Panel) {
  const rows = [{ name: inv.brief.brand || 'Client', site: inv.brief.website, pages: inv.pages, robots: inv.discovery?.robots.state, sitemap: inv.discovery?.sitemapUrls.length ?? 0 }, ...inv.competitors.map(c => ({ name: c.name, site: c.website, pages: c.pages, robots: c.discovery.robots.state, sitemap: c.discovery.sitemapCount }))];
  return <div className="studio-panel">
    {!inv.competitors.length && <p className="empty-copy">No competitors were included in this investigation. Add up to five competitor websites in the brief.</p>}
    <Grid>{show(charts.competitorRadar(inv), s => <VistaChart spec={s} height={380}/>)}</Grid>
    {inv.competitors.length > 0 && <section className="studio-section"><h3>Competitive benchmark (equal page samples)</h3><div className="table-scroll"><table className="studio-table"><thead><tr><th>Website</th><th>Pages sampled</th><th>Sitemap URLs</th><th>Median words</th><th>Schema %</th><th>GEO readiness</th><th>Trust signals</th><th>Titles in range %</th><th>HSTS</th><th>robots.txt</th></tr></thead><tbody>
      {rows.map(r => { const s = signalProfile(r.pages); return <tr key={r.site}><th scope="row">{r.name}</th><td>{r.pages.length}</td><td>{r.sitemap}</td><td>{Math.round(s.words)}</td><td>{Math.round(s.schema)}</td><td>{Math.round(s.readiness)}</td><td>{Math.round(s.trust)}</td><td>{Math.round(s.titles)}</td><td>{r.pages.some(p => p.trust.hsts) ? 'Yes' : 'No'}</td><td>{r.robots || '—'}</td></tr>; })}
    </tbody></table></div><p className="section-note">Competitor figures come from a small, equal sample of public pages and are indicative. Market share, rankings and traffic require licensed data.</p></section>}
    {inv.competitors.some(c => !c.pages.length) && <p className="dependency-note"><AlertTriangle size={14}/> Not reachable: {inv.competitors.filter(c => !c.pages.length).map(c => c.website + ' (' + (c.failures[0]?.message || 'no pages') + ')').join('; ')}</p>}
    <Findings inv={inv} analysis={analysis} modules={['competitive']} empty="No competitive findings yet."/>
  </div>;
}

export function SearchAnalytics({ inv, analysis, goMeasurements }: Panel & { goMeasurements: () => void }) {
  const gsc = inv.firstParty.gsc, ga4 = inv.firstParty.ga4;
  return <div className="studio-panel">
    {!gsc && !ga4 && <section className="studio-section dependency-card"><h3>Connect first-party evidence</h3><p>Search visibility, organic clicks, rankings and commercial outcomes are only reported from authorised data. Choose <strong>Connected client intelligence</strong> in the brief while signed in as an authorised owner to retrieve Search Console and GA4 data, or import Search Console and GA4 exports in Measurements.</p>
      {inv.firstParty.errors.length > 0 && <ul className="source-errors">{inv.firstParty.errors.map((e, i) => <li key={i}><strong>{e.source}</strong>: {e.message}</li>)}</ul>}
      <button className="ghost-button" onClick={goMeasurements}>Open Measurements (CSV imports)</button></section>}
    {gsc && <><div className="metric-row"><Metric label="Queries returned" value={gsc.rows.length}/><Metric label="Clicks" value={gsc.rows.reduce((s, r) => s + r.clicks, 0)}/><Metric label="Impressions" value={gsc.rows.reduce((s, r) => s + r.impressions, 0)}/><Metric label="Weighted position" value={Math.round(gsc.rows.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(1, gsc.rows.reduce((s, r) => s + r.impressions, 0)) * 10) / 10} decimals={1}/></div><p className="section-note"><EvidenceBadge kind="first-party"/> {gsc.scope} · collected {gsc.collectedAt.slice(0, 16)}</p></>}
    <Grid>{show(charts.gscOpportunity(inv), s => <VistaChart spec={s} height={340}/>)}{show(charts.ga4Channels(inv), s => <VistaChart spec={s} height={320}/>)}</Grid>
    {analysis.upside.available && <section className="studio-section"><h3>Commercial upside scenarios</h3><div className="scenario-row">{analysis.upside.scenarios.map(s => <div key={s.label} className="scenario"><span>{s.label}</span><strong>+{s.monthlyClicks.toLocaleString('en-GB')}</strong><small>clicks per month{s.value !== null ? ' · ≈' + s.value.toLocaleString('en-GB') + ' value' : ''} (+{s.positionGain} positions)</small></div>)}</div><ul className="assumptions">{analysis.upside.assumptions.map(a => <li key={a}>{a}</li>)}</ul></section>}
    <Findings inv={inv} analysis={analysis} modules={['search', 'analytics', 'impact']} empty="No first-party findings. Connect Search Console or GA4 for search and impact evidence."/>
  </div>;
}
