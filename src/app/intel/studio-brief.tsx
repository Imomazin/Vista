'use client';
import { useState } from 'react';
import { Gauge, Radar, Rocket, ShieldCheck, Sparkles } from 'lucide-react';
import { auditModes, type AuditMode, type Brief } from '@/lib/intel/model';
import type { Project } from '@/lib/workspace';

const split = (v: string, max: number) => v.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0, max);
const lines = (v: string, max: number) => v.split(/\n/).map(s => s.trim()).filter(Boolean).slice(0, max);

export function defaultBrief(project?: Project, previous?: Brief): Brief {
  if (previous) return { ...previous };
  return { website: project?.url || '', brand: project?.name || '', aliases: [], industry: '', markets: ['United Kingdom'], audience: project?.audience || '', offerings: [], objectives: project?.goal ? [project.goal] : [], competitors: [], keywords: [], prompts: [], mode: 'quick', assessment: 'prospect', pageLimit: auditModes.quick.pages, linkCheckLimit: auditModes.quick.linkChecks, performancePages: auditModes.quick.performancePages, aiPromptBudget: auditModes.quick.aiPrompts, includeExternalLinks: true };
}

type Props = { project?: Project; initial: Brief; canSampleAi: boolean; canConnect: boolean; busy: boolean; onStart: (brief: Brief, automatedAi: boolean) => void };

export default function BriefForm({ project, initial, canSampleAi, canConnect, busy, onStart }: Props) {
  const [brief, setBrief] = useState<Brief>(initial);
  const [text, setText] = useState({ aliases: initial.aliases.join(', '), markets: initial.markets.join(', '), offerings: initial.offerings.join(', '), objectives: initial.objectives.join('\n'), competitors: initial.competitors.join('\n'), keywords: initial.keywords.join(', '), prompts: initial.prompts.join('\n') });
  const [ai, setAi] = useState(canSampleAi);
  const [error, setError] = useState('');
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => setBrief(b => ({ ...b, [key]: value }));
  const chooseMode = (mode: AuditMode) => setBrief(b => ({ ...b, mode, pageLimit: auditModes[mode].pages, linkCheckLimit: auditModes[mode].linkChecks, performancePages: auditModes[mode].performancePages, aiPromptBudget: auditModes[mode].aiPrompts }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    let website = brief.website.trim();
    if (!/^https?:\/\//i.test(website)) website = 'https://' + website;
    try { const u = new URL(website); if (!u.hostname.includes('.')) throw new Error(); } catch { setError('Enter a valid public website address, for example https://example.com.'); return; }
    const competitors = lines(text.competitors, 5).map(c => /^https?:\/\//i.test(c) ? c : 'https://' + c).filter(c => { try { return new URL(c).hostname.includes('.'); } catch { return false; } });
    onStart({ ...brief, website, aliases: split(text.aliases, 8), markets: split(text.markets, 6), offerings: split(text.offerings, 8), objectives: lines(text.objectives, 6), competitors, keywords: split(text.keywords, 25), prompts: lines(text.prompts, 20).filter(p => p.length >= 12 && p.length <= 900) }, ai && canSampleAi);
  }

  return <form className="studio-brief" onSubmit={submit} aria-label="Investigation brief">
    <div className="brief-modes" role="radiogroup" aria-label="Assessment type">
      {(['prospect', 'connected'] as const).map(kind => <label key={kind} className={'brief-mode' + (brief.assessment === kind ? ' selected' : '')}>
        <input type="radio" name="assessment" checked={brief.assessment === kind} onChange={() => set('assessment', kind)} disabled={kind === 'connected' && !canConnect}/>
        {kind === 'prospect' ? <Radar size={20}/> : <ShieldCheck size={20}/>}
        <span><strong>{kind === 'prospect' ? 'Prospect intelligence' : 'Connected client intelligence'}</strong><small>{kind === 'prospect' ? 'Public-data assessment of any website. No client credentials required.' : canConnect ? 'Adds authorised Search Console and GA4 evidence for this organisation.' : 'Requires signing in as an authorised organisation owner with connected sources.'}</small></span>
      </label>)}
    </div>
    <fieldset className="brief-grid">
      <legend>Client and market</legend>
      <label>Client website<input required value={brief.website} onChange={e => set('website', e.target.value)} placeholder="https://clientwebsite.com" inputMode="url"/></label>
      <label>Brand name<input required value={brief.brand} onChange={e => set('brand', e.target.value)} placeholder={project?.name || 'Brand'}/></label>
      <label>Known aliases<input value={text.aliases} onChange={e => setText({ ...text, aliases: e.target.value })} placeholder="Comma separated"/></label>
      <label>Industry<input value={brief.industry} onChange={e => set('industry', e.target.value)} placeholder="e.g. corporate training"/></label>
      <label>Target markets<input value={text.markets} onChange={e => setText({ ...text, markets: e.target.value })} placeholder="United Kingdom, Ireland"/></label>
      <label>Target audience<input value={brief.audience} onChange={e => set('audience', e.target.value)} placeholder="e.g. HR directors at mid-size firms"/></label>
      <label className="span-2">Primary products and services<input value={text.offerings} onChange={e => setText({ ...text, offerings: e.target.value })} placeholder="Comma separated"/></label>
      <label className="span-2">Commercial objectives<textarea rows={2} value={text.objectives} onChange={e => setText({ ...text, objectives: e.target.value })} placeholder="One per line, e.g. Increase qualified enquiries by 20%"/></label>
    </fieldset>
    <fieldset className="brief-grid">
      <legend>Competitive and search scope</legend>
      <label className="span-2">Competitor websites<textarea rows={3} value={text.competitors} onChange={e => setText({ ...text, competitors: e.target.value })} placeholder="One per line (up to five)"/></label>
      <label className="span-2">Target keywords<input value={text.keywords} onChange={e => setText({ ...text, keywords: e.target.value })} placeholder="Comma separated (up to 25)"/></label>
      <label className="span-2">AI search prompts to monitor<textarea rows={3} value={text.prompts} onChange={e => setText({ ...text, prompts: e.target.value })} placeholder="One question per line. A prompt bank is generated from the brief as well."/></label>
    </fieldset>
    <fieldset>
      <legend>Audit depth</legend>
      <div className="brief-depths" role="radiogroup" aria-label="Audit mode">
        {(Object.keys(auditModes) as AuditMode[]).map((mode, i) => <label key={mode} className={'brief-depth' + (brief.mode === mode ? ' selected' : '')}>
          <input type="radio" name="mode" checked={brief.mode === mode} onChange={() => chooseMode(mode)}/>
          {[<Gauge key="g" size={20}/>, <Sparkles key="s" size={20}/>, <Rocket key="r" size={20}/>][i]}
          <strong>{auditModes[mode].label}</strong><small>{auditModes[mode].purpose}</small>
          <em>Up to {auditModes[mode].pages} pages · {auditModes[mode].linkChecks} link checks · {auditModes[mode].competitorPages} pages per competitor</em>
        </label>)}
      </div>
      <details className="brief-advanced">
        <summary>Crawl limits, sources and budget</summary>
        <div className="brief-grid">
          <label>Page limit ({brief.pageLimit})<input type="range" min={5} max={200} step={5} value={brief.pageLimit} onChange={e => set('pageLimit', Number(e.target.value))}/></label>
          <label>Link destination checks ({brief.linkCheckLimit})<input type="range" min={0} max={500} step={10} value={brief.linkCheckLimit} onChange={e => set('linkCheckLimit', Number(e.target.value))}/></label>
          <label>PageSpeed tests ({brief.performancePages} pages)<input type="range" min={0} max={8} value={brief.performancePages} onChange={e => set('performancePages', Number(e.target.value))}/></label>
          <label>AI prompt budget ({brief.aiPromptBudget})<input type="range" min={0} max={60} step={2} value={brief.aiPromptBudget} onChange={e => set('aiPromptBudget', Number(e.target.value))}/></label>
          <label className="check"><input type="checkbox" checked={brief.includeExternalLinks} onChange={e => set('includeExternalLinks', e.target.checked)}/> Check outbound links</label>
          <label className="check"><input type="checkbox" checked={ai && canSampleAi} disabled={!canSampleAi} onChange={e => setAi(e.target.checked)}/> Automated AI sampling (OpenAI API){!canSampleAi && <small> — sign in as an authorised owner to enable</small>}</label>
        </div>
        <p className="brief-note">PageSpeed Insights and AI sampling use external quotas. AI API answers are labelled as API observations and are not equal to consumer AI products.</p>
      </details>
    </fieldset>
    {error && <p className="error-banner" role="alert">{error}</p>}
    <div className="brief-actions"><button className="mint-button" disabled={busy}>{busy ? 'Investigation running…' : 'Start intelligence investigation'}</button><span>robots.txt is respected. Only public pages are fetched. Results are stored in this browser.</span></div>
  </form>;
}
