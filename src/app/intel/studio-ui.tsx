'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, X } from 'lucide-react';
import { evidenceClassLabel, type CompetitorSnapshot, type EvidenceClass, type Finding } from '@/lib/intel/model';
import type { PageRecord } from '@/lib/intel/page';
import { geoReadiness } from '@/lib/intel/site';
import { dossier, type Intervention } from '@/lib/intel/strategy';
import { reducedMotion } from './chart-engine';

/** Animated numeric counter that respects reduced-motion preferences. */
export function Counter({ value, suffix = '', decimals = 0 }: { value: number; suffix?: string; decimals?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (reducedMotion()) { setShown(value); return; }
    const start = performance.now(), begin = from.current, change = value - begin;
    let frame = 0;
    const step = (t: number) => { const k = Math.min(1, (t - start) / 900); const eased = 1 - Math.pow(1 - k, 3); setShown(begin + change * eased); if (k < 1) frame = requestAnimationFrame(step); else from.current = value; };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{shown.toLocaleString('en-GB', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</>;
}

export function Metric({ label, value, suffix, note, tone, decimals = 0 }: { label: string; value: number | null; suffix?: string; note?: string; tone?: 'good' | 'warn' | 'bad'; decimals?: number }) {
  return <div className={'ismetric' + (tone ? ' tone-' + tone : '')}>{label && <span>{label}</span>}<strong>{value === null ? '—' : <Counter value={value} suffix={suffix} decimals={decimals}/>}</strong>{note && <small>{note}</small>}</div>;
}

export function EvidenceBadge({ kind }: { kind: EvidenceClass }) {
  return <span className={'evidence-badge ev-' + kind} title={evidenceClassLabel[kind]}>{evidenceClassLabel[kind]}</span>;
}

export function Severity({ level }: { level: Finding['severity'] }) {
  return <span className={'sev sev-' + level}>{level}</span>;
}

export function FindingCard({ finding, intervention, competitors, open: initiallyOpen = false }: { finding: Finding; intervention?: Intervention; competitors: CompetitorSnapshot[]; open?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [mode, setMode] = useState<'evidence' | 'dossier'>('evidence');
  return <article className={'finding-card' + (open ? ' open' : '')} id={'finding-' + finding.evidenceId}>
    <button className="finding-head" onClick={() => setOpen(!open)} aria-expanded={open}>
      <Severity level={finding.severity}/>
      <span className="finding-title"><strong>{finding.title}</strong><small>{finding.evidenceId} · {finding.module} · engine {finding.engine} · {finding.affectedCount} affected · confidence {finding.confidence}</small></span>
      <ChevronDown size={18} className="finding-chevron"/>
    </button>
    {open && <div className="finding-body">
      <div className="finding-tabs" role="tablist"><button role="tab" aria-selected={mode === 'evidence'} onClick={() => setMode('evidence')}>Evidence and recommendation</button><button role="tab" aria-selected={mode === 'dossier'} onClick={() => setMode('dossier')}>Ten-question investigation</button></div>
      {mode === 'evidence' ? <>
        <p className="finding-summary">{finding.summary}</p>
        <div className="finding-grid">
          <section><h5>Evidence</h5><ul>{finding.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul><p className="finding-meta"><EvidenceBadge kind={finding.evidenceClass}/> {finding.source} · collected {finding.collectedAt.slice(0, 16).replace('T', ' ')}</p></section>
          <section><h5>Business implication</h5><p>{finding.implication}</p><h5>Recommendation</h5><p>{finding.recommendation}</p><h5>Success metric</h5><p>{finding.metric}</p></section>
        </div>
        <h5>Affected locations</h5>
        <ul className="finding-affected">{finding.affected.slice(0, 12).map((a, i) => <li key={i}><a href={a.url} target="_blank" rel="noopener noreferrer nofollow">{a.url.replace(/^https?:\/\//, '').slice(0, 80)}<ExternalLink size={11}/></a><span>{a.detail}</span></li>)}</ul>
        {finding.affectedCount > 12 && <p className="finding-meta">{finding.affectedCount - 12} more in the evidence workbook export.</p>}
        <details className="finding-method"><summary>Methodology and limitations</summary><p>{finding.methodology}</p><ul>{finding.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul></details>
      </> : <dl className="dossier">{dossier(finding, competitors, intervention).map(d => <div key={d.q}><dt>{d.q}</dt><dd>{d.a}</dd></div>)}</dl>}
    </div>}
  </article>;
}

export function PageProfile({ page, onClose }: { page: PageRecord; onClose: () => void }) {
  const readiness = geoReadiness(page);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <aside className="page-profile" role="dialog" aria-modal="true" aria-label={'Page profile ' + page.finalUrl}>
    <header><div><span className="eyebrow">PAGE HEALTH PROFILE</span><h3>{page.title || 'Untitled page'}</h3><a href={page.finalUrl} target="_blank" rel="noopener noreferrer nofollow">{page.finalUrl}</a></div><button className="icon-button" onClick={onClose} aria-label="Close page profile"><X size={18}/></button></header>
    <div className="profile-grid">
      <Metric label="HTTP" value={page.status}/><Metric label="Depth" value={page.depth < 0 ? null : page.depth} note={page.depth < 0 ? 'Sitemap only' : undefined}/><Metric label="Words" value={page.content.words}/><Metric label="GEO readiness" value={readiness.score} suffix="/100"/>
    </div>
    <dl className="profile-facts">
      <div><dt>Indexability</dt><dd>{page.indexable ? 'Technically indexable (not confirmed indexing)' : page.indexReasons.join(' ')}</dd></div>
      <div><dt>Page type / intent</dt><dd>{page.pageType} · {page.intent}</dd></div>
      <div><dt>Description</dt><dd>{page.description || 'Missing'}</dd></div>
      <div><dt>H1</dt><dd>{page.h1.join(' | ') || 'Missing'}</dd></div>
      <div><dt>Canonical</dt><dd>{page.canonical || 'Not declared'}</dd></div>
      <div><dt>Redirects</dt><dd>{page.chain.length > 1 ? page.chain.map(h => h.status + ' ' + h.url).join(' → ') : 'None'}</dd></div>
      <div><dt>Structured data</dt><dd>{page.schema.types.join(', ') || 'None'}{page.schema.errors ? ' · ' + page.schema.errors + ' invalid block(s)' : ''}</dd></div>
      <div><dt>Images</dt><dd>{page.images.count} total · {page.images.missingAlt} without alt · {page.images.legacyFormat} legacy formats</dd></div>
      <div><dt>Links</dt><dd>{page.links.internalCount} internal · {page.links.externalCount} external</dd></div>
      <div><dt>Performance indicators</dt><dd>{Math.round(page.performance.htmlBytes / 1024)} KB HTML · {page.performance.renderBlockingScripts} blocking scripts · {page.performance.thirdPartyHosts.length} third-party hosts · fetched in {page.durationMs} ms</dd></div>
      <div><dt>Trust</dt><dd>{[page.trust.https && 'HTTPS', page.trust.hsts && 'HSTS', page.trust.csp && 'CSP', page.trust.contactLink && 'Contact link', page.trust.privacyLink && 'Privacy link', page.trust.authorSignal && 'Author signal'].filter(Boolean).join(' · ') || 'No trust signals observed'}</dd></div>
      <div><dt>Accessibility</dt><dd>{page.accessibility.unlabelledInputs} unlabelled fields · {page.accessibility.unnamedButtons} unnamed buttons · {page.accessibility.vagueLinks} vague links · lang {page.accessibility.langDeclared ? 'declared' : 'missing'}</dd></div>
      {page.headingIssues.length > 0 && <div><dt>Heading issues</dt><dd>{page.headingIssues.join(' ')}</dd></div>}
      {page.keywords.length > 0 && <div><dt>Keyword relevance</dt><dd>{page.keywords.map(k => k.keyword + ': ' + [k.inTitle && 'title', k.inH1 && 'H1', k.inDescription && 'description', k.inUrl && 'URL'].filter(Boolean).join('/') + (k.bodyCount ? ' · ' + k.bodyCount + '× body' : '')).join('; ')}</dd></div>}
      <div><dt>GEO criteria</dt><dd>{readiness.criteria.map(c => (c.met ? '✓ ' : '✗ ') + c.name).join(' · ')}</dd></div>
    </dl>
  </aside>;
}
