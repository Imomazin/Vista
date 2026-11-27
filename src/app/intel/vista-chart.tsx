'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Expand, ImageDown, Minimize2, Table2, BarChart3 } from 'lucide-react';
import { palettes, type ChartSpec } from '@/lib/intel/charts';
import { currentTheme, download, loadEcharts, reducedMotion, renderChartSvg, slug, svgToPng } from './chart-engine';

type Props = { spec: ChartSpec; height?: number; onDrill?: (target: string) => void };

/**
 * Interactive analytical chart: hover intelligence, interactive legends, drill-down,
 * full-screen exploration, an accessible table alternative and SVG/PNG export.
 */
export default function VistaChart({ spec, height = 320, onDrill }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  const [table, setTable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (table) return;
    let disposed = false;
    let chart: { setOption: (o: unknown, notMerge?: boolean) => void; resize: () => void; dispose: () => void; on: (e: string, h: (p: { name?: string; data?: { id?: string; name?: string } }) => void) => void } | null = null;
    let resize: ResizeObserver | null = null;
    let themeWatch: MutationObserver | null = null;
    loadEcharts().then(echarts => {
      if (disposed || !host.current) return;
      chart = echarts.init(host.current, null, { renderer: 'svg' }) as unknown as typeof chart;
      const apply = () => chart?.setOption({ ...spec.option(palettes[currentTheme()]), animation: !reducedMotion() }, true);
      apply();
      chart!.on('click', params => {
        const key = params.data?.id || params.data?.name || params.name || '';
        const target = spec.drill ? spec.drill(key) : key;
        if (target && onDrill) onDrill(target);
      });
      resize = new ResizeObserver(() => chart?.resize());
      resize.observe(host.current);
      themeWatch = new MutationObserver(apply);
      themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-appearance'] });
    }).catch(() => setError('The chart library could not load. The data table below is available.'));
    return () => { disposed = true; resize?.disconnect(); themeWatch?.disconnect(); chart?.dispose(); };
  }, [spec, table, full, onDrill]);

  useEffect(() => {
    if (!full) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [full]);

  async function exportImage(kind: 'svg' | 'png') {
    const theme = currentTheme();
    const width = 1600, h = Math.round(1600 * (height / 560));
    const svg = await renderChartSvg(spec, theme, width, h);
    if (kind === 'svg') download(new Blob([svg], { type: 'image/svg+xml' }), slug(spec.title) + '.svg');
    else download(await svgToPng(svg, width, h, 2, theme === 'dark' ? '#121A20' : '#FFFFFF'), slug(spec.title) + '.png');
  }

  const rows = spec.table.rows.slice(0, 150);
  return <figure className={'vchart' + (full ? ' vchart-full' : '')} role={full ? 'dialog' : undefined} aria-modal={full || undefined} aria-label={full ? spec.title : undefined}>
    <figcaption>
      <div><span className="vchart-kind">{spec.kind}</span><h4>{spec.title}</h4><p>{spec.question}</p></div>
      <div className="vchart-tools" role="toolbar" aria-label={spec.title + ' tools'}>
        <button type="button" onClick={() => setTable(t => !t)} aria-pressed={table} title={table ? 'Show chart' : 'Show data table'}>{table ? <BarChart3 size={15}/> : <Table2 size={15}/>}<span className="sr-only">{table ? 'Show chart' : 'Show data table'}</span></button>
        <button type="button" onClick={() => setFull(f => !f)} title={full ? 'Exit full screen' : 'Full screen'}>{full ? <Minimize2 size={15}/> : <Expand size={15}/>}<span className="sr-only">{full ? 'Exit full screen' : 'Full screen'}</span></button>
        <button type="button" onClick={() => exportImage('svg')} title="Download SVG"><Download size={15}/><span className="sr-only">Download SVG</span></button>
        <button type="button" onClick={() => exportImage('png')} title="Download high-resolution PNG"><ImageDown size={15}/><span className="sr-only">Download PNG</span></button>
      </div>
    </figcaption>
    {error && <p className="vchart-error" role="status">{error}</p>}
    {!table && !error && <div ref={host} className="vchart-canvas" style={{ height: full ? 'calc(100vh - 170px)' : height }} role="img" aria-label={spec.title + '. ' + spec.question + ' Use the table button for the underlying data.'}/>}
    <div className={table || error ? 'vchart-table' : 'sr-only'}>
      <table>
        <caption className="sr-only">{spec.title} data</caption>
        <thead><tr>{spec.table.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} scope="row">{String(c)}</th> : <td key={j}>{typeof c === 'number' ? c.toLocaleString('en-GB') : c}</td>)}</tr>)}</tbody>
      </table>
      {spec.table.rows.length > rows.length && <p className="vchart-note">Showing {rows.length} of {spec.table.rows.length} rows. Export the evidence workbook for all rows.</p>}
    </div>
    {full && <button type="button" className="vchart-close" onClick={() => setFull(false)}>Close full screen</button>}
  </figure>;
}
