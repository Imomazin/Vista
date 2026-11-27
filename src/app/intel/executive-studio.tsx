'use client';
import { useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText, Images, Presentation, Braces, Table } from 'lucide-react';
import type { Analysis } from '@/lib/intel/analysis';
import * as charts from '@/lib/intel/charts';
import { auditModes, type EngineId, type Investigation, type StageState } from '@/lib/intel/model';
import { buildSlides, reportProducts, type ReportConfig, type ReportProduct, type Slide } from '@/lib/intel/report';
import { premiumPhotography } from '@/lib/premium-photography';
import { download, renderChartSvg, slug } from './chart-engine';
import { exportChartsZip, exportCsv, exportJson, exportPdfDeck, exportPdfReport, exportPptx, exportWorkbook, prepareAssets, type Progress } from './exporters';
import IntelligencePulse from './intelligence-pulse';

const engineNames: Record<EngineId, string> = { 1: 'Search Visibility', 2: 'Impact Intelligence', 3: 'Site Intelligence', 4: 'Content Studio', 5: 'Authority Graph', 6: 'Reputation Intelligence', 7: 'Agency Operations', 8: 'Analytics Intelligence', 9: 'AI Exposure / GEO' };
const photo = (id: string) => premiumPhotography.find(p => p.id === id)?.path || '';
export const reportPhotos = { cover: photo('pricing-team-strategy-session'), content: photo('content-recording-desk-setup'), competitive: photo('benchmark-data-reporting-monitor'), roadmap: photo('workspace-focused-project-work') };
const stageTemplate: [string, string][] = [['prepare', 'Preparing report content'], ['charts', 'Rendering charts'], ['compose', 'Composing the document'], ['package', 'Packaging the file']];
type Job = { status: 'running' | 'complete' | 'failed'; stages: StageState[]; activity: string; started: number; elapsed: number; title: string };

export default function ExecutiveStudio({ inv, analysis, projectName }: { inv: Investigation; analysis: Analysis; projectName: string }) {
  const [config, setConfig] = useState<ReportConfig>({ product: 'board', audience: reportProducts.board.audience, depth: 'standard', engines: [1, 2, 3, 4, 5, 6, 7, 8, 9], clientName: inv.brief.brand || projectName, whiteLabel: false, agencyName: '', primary: '#136C50', accent: '#5E3FB0', photography: true, appendix: true });
  const [job, setJob] = useState<Job | null>(null);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const slides = useMemo(() => buildSlides(inv, analysis, config, reportPhotos), [inv, analysis, config]);
  const set = <K extends keyof ReportConfig>(k: K, v: ReportConfig[K]) => setConfig(c => ({ ...c, [k]: v }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<number, string> = {};
      for (const s of slides) if (s.chart) { try { const svg = await renderChartSvg(s.chart, 'light', 720, 400); out[s.number] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); } catch { /* Preview only. */ } }
      if (!cancelled) setPreviews(out);
    })();
    return () => { cancelled = true; };
  }, [slides]);

  async function logo(file: File | undefined, key: 'clientLogo' | 'agencyLogo') {
    if (!file) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(file.type) || file.size > 1_000_000) { alert('Use a PNG, JPEG, SVG or WebP logo under 1 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => set(key, String(reader.result));
    reader.readAsDataURL(file);
  }

  async function generate(title: string, build: (progress: Progress) => Promise<Blob>, filename: string) {
    const started = Date.now();
    const stages: StageState[] = stageTemplate.map(([id, label]) => ({ id, label, status: 'pending', done: 0, total: null, note: '', errors: [] }));
    stages[0].status = 'complete';
    const update = (patch: Partial<Job>) => setJob(j => ({ ...(j || { status: 'running', stages, activity: '', started, elapsed: 0, title }), ...patch, elapsed: Date.now() - started }));
    update({ status: 'running', stages: [...stages], activity: 'Preparing ' + slides.length + ' pages of evidence-backed content…', title });
    const progress: Progress = (stage, done, total, activity) => {
      for (let i = 0; i < stages.length; i += 1) { if (i < stage) { if (stages[i].status !== 'complete') stages[i].status = 'complete'; } else if (i === stage) { stages[i] = { ...stages[i], status: 'active', done, total }; } }
      update({ stages: stages.map(s => ({ ...s })), activity });
    };
    try {
      const blob = await build(progress);
      stages.forEach(s => { s.status = 'complete'; });
      update({ status: 'complete', stages: stages.map(s => ({ ...s })), activity: filename + ' generated (' + Math.round(blob.size / 1024) + ' KB).' });
      download(blob, filename);
    } catch (error) {
      const active = stages.find(s => s.status === 'active') || stages[1];
      active.status = 'failed'; active.errors.push({ source: title, message: (error as Error).message || 'Generation failed.', retryable: true });
      update({ status: 'failed', stages: stages.map(s => ({ ...s })), activity: 'Generation failed: ' + (error as Error).message });
    }
  }

  const base = slug(config.clientName) + '-' + slug(reportProducts[config.product].label) + '-' + new Date().toISOString().slice(0, 10);
  const withAssets = (fn: (assets: Awaited<ReturnType<typeof prepareAssets>>, p: Progress) => Promise<Blob>) => async (p: Progress) => fn(await prepareAssets(slides, config, config.photography ? reportPhotos : {}, p), p);
  const allCharts = [charts.capabilityRadar(analysis.index), charts.kpiBullets(inv, analysis.site), charts.crawlFunnel(inv, analysis.site), charts.responseSankey(inv), charts.architectureSunburst(analysis.site), charts.issueHeatmap(inv), charts.linkNetwork(analysis.site), charts.severityMatrix(analysis.findings), charts.contentTreemap(analysis.site), charts.readinessScatter(inv, analysis.site), charts.competitorRadar(inv), charts.entityNetwork(inv), charts.geoCategoryChart(inv), charts.geoShareChart(inv), charts.geoOpportunityHeatmap(inv), charts.opportunityBubbles(analysis.interventions, analysis.findings), charts.quadrant(analysis.interventions, 'impact-effort'), charts.performanceComparison(inv), charts.gscOpportunity(inv), charts.ga4Channels(inv)].filter((s): s is charts.ChartSpec => !!s);
  const busy = job?.status === 'running';

  return <div className="studio-panel executive">
    <section className="studio-section exec-config">
      <h3>VisTa Executive Studio</h3>
      <p className="section-note">Presentation-native reports generated from this investigation ({auditModes[inv.brief.mode].label}, {inv.pages.length} pages, {analysis.findings.length} findings). Charts are rebuilt as native or vector graphics, not screenshots.</p>
      <div className="brief-grid">
        <label>Report<select value={config.product} onChange={e => { const product = e.target.value as ReportProduct; setConfig(c => ({ ...c, product, audience: reportProducts[product].audience })); }}>{(Object.keys(reportProducts) as ReportProduct[]).map(p => <option key={p} value={p}>{reportProducts[p].label}</option>)}</select></label>
        <label>Audience<input value={config.audience} onChange={e => set('audience', e.target.value)}/></label>
        <label>Depth<select value={config.depth} onChange={e => set('depth', e.target.value as ReportConfig['depth'])}><option value="summary">Summary (omit evidence gaps)</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
        <label>Client name<input value={config.clientName} onChange={e => set('clientName', e.target.value)}/></label>
        <label>Primary colour<input type="color" value={config.primary} onChange={e => set('primary', e.target.value)}/></label>
        <label>Accent colour<input type="color" value={config.accent} onChange={e => set('accent', e.target.value)}/></label>
        <label>Client logo<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e => logo(e.target.files?.[0], 'clientLogo')}/></label>
        <label className="check"><input type="checkbox" checked={config.whiteLabel} onChange={e => set('whiteLabel', e.target.checked)}/> White-label for an authorised agency</label>
        {config.whiteLabel && <><label>Agency name<input value={config.agencyName} onChange={e => set('agencyName', e.target.value)}/></label><label>Agency logo<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e => logo(e.target.files?.[0], 'agencyLogo')}/></label></>}
        <label className="check"><input type="checkbox" checked={config.photography} onChange={e => set('photography', e.target.checked)}/> Include editorial photography</label>
        <label className="check"><input type="checkbox" checked={config.appendix} onChange={e => set('appendix', e.target.checked)}/> Methodology and evidence appendices</label>
      </div>
      <fieldset className="engine-picks"><legend>Included engines</legend>{([1, 2, 3, 4, 5, 6, 7, 8, 9] as EngineId[]).map(id => <label key={id} className="check"><input type="checkbox" checked={config.engines.includes(id)} onChange={e => set('engines', e.target.checked ? [...config.engines, id].sort() : config.engines.filter(x => x !== id))}/> {id}. {engineNames[id]}</label>)}</fieldset>
      <div className="export-grid">
        <button disabled={busy} onClick={() => generate('Editable PowerPoint', withAssets((a, p) => exportPptx(slides, config, a, p)), base + '.pptx')}><Presentation size={18}/><span><strong>PowerPoint (.pptx)</strong><small>Editable, native charts</small></span></button>
        <button disabled={busy} onClick={() => generate('Presentation PDF', withAssets((a, p) => exportPdfDeck(slides, config, a, p)), base + '-16x9.pdf')}><FileDown size={18}/><span><strong>Presentation PDF</strong><small>16:9 landscape, vector charts</small></span></button>
        <button disabled={busy} onClick={() => generate('A4 analytical PDF', withAssets((a, p) => exportPdfReport(inv, analysis, slides, config, a, p)), base + '-a4-report.pdf')}><FileText size={18}/><span><strong>A4 analytical PDF</strong><small>Detailed findings and evidence</small></span></button>
        <button disabled={busy} onClick={() => generate('Excel evidence workbook', async p => { p(2, 0, 1, 'Writing evidence sheets…'); return exportWorkbook(inv, analysis); }, base + '-evidence.xlsx')}><FileSpreadsheet size={18}/><span><strong>Excel workbook</strong><small>Full evidence register</small></span></button>
        <button disabled={busy} onClick={() => generate('Findings CSV', async () => exportCsv(inv, analysis, 'findings'), base + '-findings.csv')}><Table size={18}/><span><strong>CSV</strong><small>Findings</small></span></button>
        <button disabled={busy} onClick={() => generate('Pages CSV', async () => exportCsv(inv, analysis, 'pages'), base + '-pages.csv')}><Table size={18}/><span><strong>CSV</strong><small>Page inventory</small></span></button>
        <button disabled={busy} onClick={() => generate('JSON export', async () => exportJson(inv, analysis), base + '.json')}><Braces size={18}/><span><strong>JSON</strong><small>Investigation and analysis</small></span></button>
        <button disabled={busy || !allCharts.length} onClick={() => generate('Chart pack', p => exportChartsZip(allCharts, p), base + '-charts.zip')}><Images size={18}/><span><strong>Chart pack</strong><small>{allCharts.length} charts · SVG + high-res PNG</small></span></button>
      </div>
    </section>
    {job && <IntelligencePulse compact title={job.title} status={job.status} stages={job.stages} activity={job.activity} elapsedMs={job.elapsed} percent={Math.round(job.stages.reduce((s, x) => s + (x.status === 'complete' ? 1 : x.status === 'active' && x.total ? x.done / x.total : 0), 0) / job.stages.length * 100)} determinate={job.stages.find(s => s.status === 'active')?.total !== null} counts={[{ label: 'pages', value: slides.length }]}/>}
    <section className="studio-section"><h3>Interactive preview · {reportProducts[config.product].label} · {slides.length} pages</h3>
      <div className="slide-preview-grid">{slides.map(s => <SlidePreview key={s.number} slide={s} chart={previews[s.number]} config={config} total={slides.length}/>)}</div>
    </section>
  </div>;
}

function SlidePreview({ slide: s, chart, config, total }: { slide: Slide; chart?: string; config: ReportConfig; total: number }) {
  const style = { '--slide-primary': config.primary, '--slide-accent': config.accent } as React.CSSProperties;
  if (s.kind === 'cover') return <article className="slide-preview cover" style={style} aria-label={'Slide ' + s.number + ': cover'}>
    {config.photography && reportPhotos.cover && <img src={reportPhotos.cover} alt="" className="slide-photo"/>}
    <div className="slide-cover-copy"><span>{s.kicker}</span><h4>{s.title}</h4><p>{s.lead}</p><small>{s.bullets.join(' · ')}</small></div>
    {config.clientLogo && <img className="slide-logo" src={config.clientLogo} alt="Client logo"/>}
    <footer>{s.source}</footer>
  </article>;
  return <article className="slide-preview" style={style} aria-label={'Slide ' + s.number + ': ' + s.title}>
    <span className="slide-kicker">{s.kicker}</span>
    <h4>{s.title}</h4>
    {s.lead && <p className="slide-lead">{s.lead}</p>}
    <div className={'slide-body' + (s.chart || s.table ? ' split' : '')}>
      {s.gap && !s.chart && !s.table && <div className="slide-gap"><strong>Evidence gap</strong>{s.gap}</div>}
      {s.chart && (chart ? <img src={chart} alt={s.chart.title}/> : <div className="slide-chart-loading">Rendering {s.chart.kind.toLowerCase()}…</div>)}
      {!s.chart && s.table && <table><thead><tr>{s.table.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{s.table.rows.slice(0, 7).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}</tbody></table>}
      {(s.bullets.length > 0 || s.metrics.length > 0) && <div className="slide-side">{s.metrics.map(m => <div key={m.label} className="slide-metric"><strong>{m.value}</strong><small>{m.label}{m.note ? ' · ' + m.note : ''}</small></div>)}<ul>{s.bullets.slice(0, 5).map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
    </div>
    <footer><span>{s.source}</span><b>{String(s.number).padStart(2, '0')} / {String(total).padStart(2, '0')}</b></footer>
  </article>;
}
