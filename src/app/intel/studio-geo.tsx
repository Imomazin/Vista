'use client';
import { useMemo, useState } from 'react';
import { Bot, ClipboardPen, Loader2, Play } from 'lucide-react';
import type { Analysis } from '@/lib/intel/analysis';
import * as charts from '@/lib/intel/charts';
import { analyseResponse, competitorNames, promptBank, promptCategories, type Rate } from '@/lib/intel/geo';
import type { AiObservation, Investigation, PromptCategory } from '@/lib/intel/model';
import VistaChart from './vista-chart';
import { Metric } from './studio-ui';

const providers = [
  { name: 'ChatGPT', automation: 'OpenAI Responses API (authorised owners) — API answers differ from the ChatGPT app' },
  { name: 'Google AI Overviews', automation: 'No public API — verified manual capture' },
  { name: 'Google AI Mode', automation: 'No public API — verified manual capture' },
  { name: 'Gemini', automation: 'Manual capture (Gemini API not configured)' },
  { name: 'Perplexity', automation: 'Manual capture (Perplexity API key not configured)' },
  { name: 'Claude', automation: 'Manual capture (Anthropic API key not configured)' },
  { name: 'Microsoft Copilot', automation: 'No public consumer API — verified manual capture' },
];
const fmt = (r: Rate) => r.n ? Math.round(r.value * 100) + '%' : '—';
const ci = (r: Rate) => r.n ? 'n=' + r.n + ' · 95% CI ' + Math.round(r.low * 100) + '–' + Math.round(r.high * 100) + '%' : 'No samples';

type Props = { inv: Investigation; analysis: Analysis; canSample: boolean; organisationId: string | null; onChange: (inv: Investigation) => void };

export default function GeoPanel({ inv, analysis, canSample, organisationId, onChange }: Props) {
  const bank = useMemo(() => promptBank(inv.brief, inv.competitors), [inv.brief, inv.competitors]);
  const names = useMemo(() => competitorNames(inv.brief, inv.competitors), [inv.brief, inv.competitors]);
  const [custom, setCustom] = useState('');
  const [sampling, setSampling] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ provider: 'Google AI Overviews', model: '', surface: 'consumer' as 'consumer' | 'api', prompt: bank[0]?.prompt || '', category: (bank[0]?.category || 'discovery') as PromptCategory, market: inv.brief.markets[0] || '', language: 'en', collectedAt: new Date().toISOString().slice(0, 16), response: '', citations: '', inaccurate: '' as '' | 'yes' | 'no', note: '' });
  const m = analysis.geo;

  function save(observation: AiObservation) { onChange({ ...inv, observations: [...inv.observations, observation] }); }

  async function sample(prompt: string, category: PromptCategory) {
    if (!organisationId) return;
    setSampling(prompt); setMessage('');
    try {
      const r = await fetch('/api/intel/ai-sample', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organisationId, prompt, webSearch: true }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Sampling failed.');
      save({ id: crypto.randomUUID(), provider: data.provider, model: data.model, surface: 'api', method: 'automated', prompt, category, market: inv.brief.markets[0] || '', language: 'en', collectedAt: data.collectedAt, response: data.response, ...analyseResponse(data.response, inv.brief, data.citations, names), citations: data.citations, inaccurate: null, accuracyNote: '', methodology: data.methodology, limitations: data.limitations });
      setMessage('Observation saved from ' + data.provider + ' · ' + data.model + '.');
    } catch (e) { setMessage((e as Error).message); } finally { setSampling(null); }
  }

  function record(e: React.FormEvent) {
    e.preventDefault();
    const citations = form.citations.split(/\s+/).filter(u => /^https?:\/\//.test(u)).slice(0, 30).map(url => ({ url, title: '' }));
    if (form.response.trim().length < 20 || form.prompt.trim().length < 6) { setMessage('Paste the exact prompt and the full AI response (at least 20 characters).'); return; }
    save({ id: crypto.randomUUID(), provider: form.provider, model: form.model || 'not specified', surface: form.surface, method: 'manual', prompt: form.prompt.trim(), category: form.category, market: form.market, language: form.language, collectedAt: new Date(form.collectedAt).toISOString(), response: form.response.trim().slice(0, 20000), ...analyseResponse(form.response, inv.brief, citations, names), citations, inaccurate: form.inaccurate === '' ? null : form.inaccurate === 'yes', accuracyNote: form.note, methodology: 'Manual capture from ' + form.provider + ' (' + form.surface + ') by a VisTa user; exact prompt and response pasted.', limitations: 'Single observation; consumer AI answers vary by account, location, time and personalisation.' });
    setForm(f => ({ ...f, response: '', citations: '', note: '', inaccurate: '' }));
    setMessage('Manual observation recorded.');
  }

  function review(id: string, inaccurate: boolean | null) { onChange({ ...inv, observations: inv.observations.map(o => o.id === id ? { ...o, inaccurate } : o) }); }
  function remove(id: string) { onChange({ ...inv, observations: inv.observations.filter(o => o.id !== id) }); }

  return <div className="studio-panel">
    <div className="metric-row">
      <Metric label="AI brand mention rate" value={m.n ? Math.round(m.mentionRate.value * 100) : null} suffix="%" note={ci(m.mentionRate)}/>
      <Metric label="AI citation rate" value={m.n ? Math.round(m.citationRate.value * 100) : null} suffix="%" note={ci(m.citationRate)}/>
      <Metric label="Recommendation rate" value={m.recommendationRate.n ? Math.round(m.recommendationRate.value * 100) : null} suffix="%" note={ci(m.recommendationRate)}/>
      <Metric label="Competitive mention share" value={m.competitiveShare.n ? Math.round(m.competitiveShare.value * 100) : null} suffix="%" note={ci(m.competitiveShare)}/>
      <Metric label="Prompt category coverage" value={m.categoryCoverage.covered} note={'of ' + m.categoryCoverage.total + ' categories'}/>
      <Metric label="Source diversity" value={m.sourceDiversity.domains} note="unique cited domains"/>
      <Metric label="Information accuracy" value={m.accuracy.n ? Math.round(m.accuracy.value * 100) : null} suffix="%" note={m.accuracy.n ? 'reviewed n=' + m.accuracy.n : 'No reviewed answers'}/>
    </div>
    <p className="section-note">Rates are numerator ÷ sample size with Wilson 95% intervals. {m.n ? Math.round(m.apiShare * 100) + '% of observations are API-generated; the rest are manual captures from consumer AI products.' : 'No observations yet.'} Small samples are directional, not rankings.</p>
    <div className="studio-charts">
      {[charts.geoCategoryChart(inv), charts.geoShareChart(inv), charts.geoOpportunityHeatmap(inv), charts.geoTrend(inv), charts.observationCalendar(inv)].filter(Boolean).map(s => <VistaChart key={s!.id} spec={s!} height={300}/>)}
    </div>
    <section className="studio-section"><h3>Provider coverage</h3><div className="table-scroll"><table className="studio-table"><thead><tr><th>Provider</th><th>Collection method</th><th>Observations</th></tr></thead><tbody>{providers.map(p => <tr key={p.name}><th scope="row">{p.name}</th><td>{p.automation}</td><td>{inv.observations.filter(o => o.provider.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()) || (p.name === 'ChatGPT' && o.provider === 'OpenAI')).length}</td></tr>)}</tbody></table></div></section>
    <section className="studio-section"><h3>GEO Opportunity Map</h3>
      {analysis.opportunities.length ? <ul className="opportunity-map">{analysis.opportunities.map((o, i) => <li key={i}><span className="pill">{promptCategories.find(c => c.id === o.category)?.label}</span><strong>{o.prompt}</strong><small>Competitors present: {o.competitors.join(', ')} · {o.provider} · {o.collectedAt.slice(0, 10)}</small><p>{o.intervention}</p>{o.citedSources.length > 0 && <small>Sources cited in that answer: {o.citedSources.map(s => s.replace(/^https?:\/\//, '').slice(0, 50)).join(', ')}</small>}</li>)}</ul> : <p className="empty-copy">The map lists prompts where competitors appear and the client does not. It fills as observations are sampled or recorded.</p>}
    </section>
    <section className="studio-section"><h3>Prompt bank</h3><p className="section-note">Generated from the brief across nine commercial categories. Sampling uses the authorised API; other providers require verified manual capture.</p>
      <ul className="prompt-bank">{bank.map(b => { const done = inv.observations.filter(o => o.prompt === b.prompt); return <li key={b.prompt}><span className="pill">{promptCategories.find(c => c.id === b.category)?.label}</span><span>{b.prompt}</span><small>{done.length ? done.length + ' observation(s) · mentioned in ' + done.filter(o => o.brandMentioned).length : 'Not yet observed'}</small>
        <span className="prompt-actions">{canSample && <button onClick={() => sample(b.prompt, b.category)} disabled={!!sampling}>{sampling === b.prompt ? <Loader2 size={13} className="ipulse-spin"/> : <Play size={13}/>}Sample via API</button>}<button onClick={() => setForm(f => ({ ...f, prompt: b.prompt, category: b.category }))}><ClipboardPen size={13}/>Record manually</button></span></li>; })}</ul>
      <form className="inline-form" onSubmit={e => { e.preventDefault(); if (custom.trim().length >= 12) { onChange({ ...inv, brief: { ...inv.brief, prompts: [...inv.brief.prompts, custom.trim()] } }); setCustom(''); } }}><label className="sr-only" htmlFor="custom-prompt">Add a prompt</label><input id="custom-prompt" value={custom} onChange={e => setCustom(e.target.value)} placeholder="Add a custom prompt (12+ characters)"/><button className="ghost-button">Add prompt</button></form>
      {!canSample && <p className="dependency-note"><Bot size={14}/> Automated sampling requires signing in as an authorised organisation owner with a funded OpenAI API key. Manual capture is always available.</p>}
      {message && <p role="status" className="status-line">{message}</p>}
    </section>
    <section className="studio-section"><h3>Record a verified observation</h3>
      <form className="studio-brief observation-form" onSubmit={record}>
        <div className="brief-grid">
          <label>Provider<select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}>{providers.map(p => <option key={p.name}>{p.name}</option>)}<option>Other</option></select></label>
          <label>Model or version<input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} placeholder="If shown"/></label>
          <label>Surface<select value={form.surface} onChange={e => setForm({ ...form, surface: e.target.value as 'consumer' | 'api' })}><option value="consumer">Consumer product</option><option value="api">API</option></select></label>
          <label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as PromptCategory })}>{promptCategories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label>Market<input value={form.market} onChange={e => setForm({ ...form, market: e.target.value })}/></label>
          <label>Language<input value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}/></label>
          <label>Observed at<input type="datetime-local" value={form.collectedAt} onChange={e => setForm({ ...form, collectedAt: e.target.value })}/></label>
          <label>Incorrect brand information?<select value={form.inaccurate} onChange={e => setForm({ ...form, inaccurate: e.target.value as '' | 'yes' | 'no' })}><option value="">Not reviewed</option><option value="no">No — accurate</option><option value="yes">Yes — inaccurate</option></select></label>
          <label className="span-2">Exact prompt<input value={form.prompt} onChange={e => setForm({ ...form, prompt: e.target.value })} required/></label>
          <label className="span-2">Full response (pasted)<textarea rows={5} value={form.response} onChange={e => setForm({ ...form, response: e.target.value })} required/></label>
          <label className="span-2">Cited source URLs<textarea rows={2} value={form.citations} onChange={e => setForm({ ...form, citations: e.target.value })} placeholder="One URL per line"/></label>
          <label className="span-2">Accuracy note<input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="What is incorrect, if anything"/></label>
        </div>
        <button className="mint-button">Save observation</button>
      </form>
    </section>
    <section className="studio-section"><h3>Observation register ({inv.observations.length})</h3>
      {inv.observations.length ? <div className="table-scroll"><table className="studio-table"><thead><tr><th>Prompt</th><th>Provider</th><th>Surface</th><th>Date</th><th>Brand</th><th>Competitors</th><th>Position</th><th>Citations</th><th>Accuracy</th><th></th></tr></thead><tbody>
        {[...inv.observations].reverse().map(o => <tr key={o.id}><th scope="row"><details><summary>{o.prompt.slice(0, 70)}</summary><p className="response-text">{o.response.slice(0, 2500)}</p><small>{o.methodology} {o.limitations}</small></details></th><td>{o.provider} · {o.model}</td><td>{o.surface === 'api' ? 'API' : 'Consumer'} / {o.method}</td><td>{o.collectedAt.slice(0, 10)}</td><td>{o.brandMentioned ? 'Mentioned' : 'Absent'}</td><td>{o.competitorMentions.join(', ') || '—'}</td><td>{o.position ?? '—'}</td><td>{o.citations.length}</td><td><select aria-label="Accuracy review" value={o.inaccurate === null ? '' : o.inaccurate ? 'yes' : 'no'} onChange={e => review(o.id, e.target.value === '' ? null : e.target.value === 'yes')}><option value="">Not reviewed</option><option value="no">Accurate</option><option value="yes">Inaccurate</option></select></td><td><button className="link-button" onClick={() => remove(o.id)}>Remove</button></td></tr>)}
      </tbody></table></div> : <p className="empty-copy">No observations recorded.</p>}
    </section>
  </div>;
}
