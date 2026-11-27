'use client';
/** Lazily loaded ECharts runtime (SVG renderer) shared by dashboards and report exports. */
import { palettes, type ChartSpec } from '@/lib/intel/charts';

type Echarts = typeof import('echarts/core');
let loading: Promise<Echarts> | null = null;

export function loadEcharts(): Promise<Echarts> {
  loading ||= (async () => {
    const [core, charts, components, renderers] = await Promise.all([import('echarts/core'), import('echarts/charts'), import('echarts/components'), import('echarts/renderers')]);
    core.use([
      charts.BarChart, charts.LineChart, charts.ScatterChart, charts.RadarChart, charts.FunnelChart, charts.SankeyChart, charts.SunburstChart, charts.GraphChart, charts.HeatmapChart, charts.TreemapChart, charts.CustomChart,
      components.GridComponent, components.TooltipComponent, components.LegendComponent, components.VisualMapComponent, components.CalendarComponent, components.MarkLineComponent, components.MarkAreaComponent, components.AriaComponent, components.TitleComponent, components.RadarComponent,
      renderers.SVGRenderer,
    ]);
    return core;
  })();
  return loading;
}

export function currentTheme(): 'dark' | 'light' {
  return typeof document !== 'undefined' && document.documentElement.dataset.appearance === 'light' ? 'light' : 'dark';
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('.motion-off'));
}

/** Render a chart to an SVG string without touching the page (used for PDF and slide exports). */
export async function renderChartSvg(spec: ChartSpec, theme: 'dark' | 'light', width: number, height: number): Promise<string> {
  const echarts = await loadEcharts();
  const chart = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  const option = staticOption(spec.option(palettes[theme]));
  chart.setOption({ ...option, animation: false } as never);
  const svg = chart.renderToSVGString();
  chart.dispose();
  return svg;
}

/** Rasterise SVG to PNG at a device scale (3× by default) for presentation-quality images. */
export function svgToPng(svg: string, width: number, height: number, scale = 3, background?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas unavailable')); return; }
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Chart image could not be rendered')); };
    image.src = url;
  });
}

export function download(data: Blob | string, filename: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'vista';

/** Static exports cannot run iterative force layouts, so network graphs use a deterministic circular layout. */
type Obj = Record<string, unknown>;
const bigger = (o: unknown, size: number): Obj => ({ ...((o as Obj) || {}), fontSize: Math.max(Number((o as Obj | undefined)?.fontSize) || 0, size) });
function staticOption(option: Obj): Obj {
  const series = (Array.isArray(option.series) ? option.series : option.series ? [option.series] : []) as Obj[];
  const axes = (a: unknown) => a === undefined ? undefined : (Array.isArray(a) ? a : [a]).map((x: Obj) => ({ ...x, axisLabel: bigger(x.axisLabel, 14), nameTextStyle: bigger(x.nameTextStyle, 14) }));
  // Presentation exports place charts at roughly half their pixel width, so base type is enlarged.
  return {
    ...option,
    textStyle: { ...bigger(option.textStyle, 15), fontFamily: 'Helvetica, Arial, sans-serif' },
    ...(option.xAxis ? { xAxis: axes(option.xAxis) } : {}),
    ...(option.yAxis ? { yAxis: axes(option.yAxis) } : {}),
    ...(option.radar ? { radar: { ...(option.radar as Obj), axisName: bigger((option.radar as Obj).axisName, 14) } } : {}),
    ...(option.legend ? { legend: { ...(option.legend as Obj), textStyle: bigger((option.legend as Obj).textStyle, 14) } } : {}),
    series: series.map(s => {
      const withLabel = s.label ? { ...s, label: bigger(s.label, 13) } : s;
      return s.type === 'graph' && s.layout === 'force' ? { ...withLabel, layout: 'circular', circular: { rotateLabel: true }, roam: false, label: { show: true, position: 'right', fontSize: 13 } } : withLabel;
    }),
  };
}
