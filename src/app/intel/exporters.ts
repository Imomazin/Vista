'use client';
/**
 * Executive Studio file generation. Everything runs in the browser from the investigation
 * evidence: presentation-native PowerPoint (editable native charts where supported), vector
 * PDFs (16:9 deck and A4 analytical report), an Excel evidence workbook, CSV and JSON.
 */
import type { Analysis } from '@/lib/intel/analysis';
import type { ChartSpec } from '@/lib/intel/charts';
import type { Investigation } from '@/lib/intel/model';
import { reportProducts, type ReportConfig, type Slide } from '@/lib/intel/report';
import { geoReadiness } from '@/lib/intel/site';
import { buildXlsx, toCsv } from '@/lib/intel/xlsx';
import { renderChartSvg, svgToPng } from './chart-engine';

export type Assets = { svg: Record<number, string>; png: Record<number, string>; photos: Record<string, string>; logos: { client?: string; agency?: string } };
export type Progress = (stage: number, done: number, total: number, activity: string) => void;

const ink = '19332D', sub = '526F64', paper = 'F8F7F2', night = '0B1117';
const hex = (c: string) => c.replace('#', '').toUpperCase();
const CHART_W = 960, CHART_H = 544;

export async function loadJpeg(url: string, maxWidth = 1400): Promise<string> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  await image.decode();
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.86);
}

async function toPngData(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith('data:image/png') || dataUrl.startsWith('data:image/jpeg')) return dataUrl;
  const image = new Image(); image.src = dataUrl; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  canvas.getContext('2d')!.drawImage(image, 0, 0); return canvas.toDataURL('image/png');
}

/** Render every slide chart (SVG for PDF, PNG for slides) and convert photography for embedding. */
export async function prepareAssets(slides: Slide[], config: ReportConfig, photoUrls: Record<string, string>, progress: Progress): Promise<Assets> {
  const assets: Assets = { svg: {}, png: {}, photos: {}, logos: {} };
  const withCharts = slides.filter(s => s.chart);
  let done = 0;
  for (const slide of withCharts) {
    progress(1, done, withCharts.length, 'Rendering chart: ' + slide.chart!.title);
    const svg = await renderChartSvg(slide.chart!, 'light', CHART_W, CHART_H);
    assets.svg[slide.number] = svg;
    if (!slide.chart!.native) assets.png[slide.number] = await svgToPng(svg, CHART_W, CHART_H, 2, '#FFFFFF');
    done += 1;
  }
  progress(1, done, withCharts.length, 'Charts rendered.');
  if (config.photography) for (const [key, url] of Object.entries(photoUrls)) { try { assets.photos[key] = await loadJpeg(url); } catch { /* Photography is optional. */ } }
  if (config.clientLogo) assets.logos.client = await toPngData(config.clientLogo);
  if (config.agencyLogo) assets.logos.agency = await toPngData(config.agencyLogo);
  return assets;
}

const brandLine = (config: ReportConfig) => config.whiteLabel ? (config.agencyName || 'Prepared by your agency') : 'VisTa · Marketing Superior Intelligence';

export async function exportPptx(slides: Slide[], config: ReportConfig, assets: Assets, progress: Progress): Promise<Blob> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = reportProducts[config.product].label + ' · ' + config.clientName;
  pptx.company = config.whiteLabel ? config.agencyName : 'Ambidexters';
  pptx.author = config.whiteLabel ? config.agencyName : 'VisTa';
  const primary = hex(config.primary), accent = hex(config.accent);
  const colors = [primary, accent, '276A8D', '87571C', 'B23A45', '3E8C77'];
  slides.forEach((s, index) => {
    progress(2, index, slides.length, 'Composing slide ' + s.number + ': ' + s.kicker.toLowerCase());
    const slide = pptx.addSlide();
    if (s.kind === 'cover') {
      slide.background = { color: night };
      if (s.photo && assets.photos.cover) { slide.addImage({ data: assets.photos.cover, x: 6.9, y: 0, w: 6.433, h: 7.5, sizing: { type: 'cover', w: 6.433, h: 7.5 } }); slide.addShape(pptx.ShapeType.rect, { x: 6.9, y: 0, w: 6.433, h: 7.5, fill: { color: night, transparency: 45 }, line: { color: night, transparency: 100 } }); }
      slide.addShape(pptx.ShapeType.rect, { x: 0.6, y: 2.3, w: 0.08, h: 2.2, fill: { color: primary }, line: { color: primary } });
      slide.addText(s.kicker, { x: 0.9, y: 2.2, w: 5.8, h: 0.4, fontFace: 'Arial', fontSize: 12, bold: true, color: 'A7E9CF', charSpacing: 4 });
      slide.addText(s.title, { x: 0.9, y: 2.65, w: 5.9, h: 1.5, fontFace: 'Georgia', fontSize: 42, color: 'FFFFFF', valign: 'top', fit: 'shrink' });
      slide.addText(s.lead || '', { x: 0.9, y: 4.2, w: 5.8, h: 0.5, fontFace: 'Arial', fontSize: 15, color: 'C9D6D2' });
      slide.addText(s.bullets.join('\n'), { x: 0.9, y: 4.75, w: 5.8, h: 0.8, fontFace: 'Arial', fontSize: 12, color: '9FB3AE', valign: 'top' });
      if (assets.logos.client) slide.addImage({ data: assets.logos.client, x: 0.6, y: 0.5, w: 1.6, h: 0.8, sizing: { type: 'contain', w: 1.6, h: 0.8 } });
      if (assets.logos.agency) slide.addImage({ data: assets.logos.agency, x: 4.6, y: 0.5, w: 1.6, h: 0.8, sizing: { type: 'contain', w: 1.6, h: 0.8 } });
      slide.addText(s.source, { x: 0.9, y: 6.6, w: 5.8, h: 0.35, fontFace: 'Arial', fontSize: 10, color: '9FB3AE' });
      return;
    }
    slide.background = { color: paper };
    slide.addText(s.kicker, { x: 0.6, y: 0.35, w: 9, h: 0.3, fontFace: 'Arial', fontSize: 10.5, bold: true, color: accent, charSpacing: 3 });
    slide.addShape(pptx.ShapeType.line, { x: 0.6, y: 0.7, w: 0.9, h: 0, line: { color: primary, width: 2 } });
    slide.addText(s.title, { x: 0.6, y: 0.8, w: 12.1, h: 1.0, fontFace: 'Georgia', fontSize: 26, color: ink, valign: 'top', fit: 'shrink' });
    let top = 1.85;
    if (s.lead) { slide.addText(s.lead, { x: 0.6, y: 1.8, w: 12.1, h: 0.45, fontFace: 'Arial', fontSize: 13, color: sub }); top = 2.35; }
    const hasSide = s.bullets.length > 0 || s.metrics.length > 0;
    if (s.gap && !s.chart && !s.table) {
      slide.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: top + 0.2, w: 7.4, h: 1.5, fill: { color: 'FFFFFF' }, line: { color: 'D9C9A3', width: 1 }, rectRadius: 0.08 });
      slide.addText([{ text: 'Evidence gap\n', options: { bold: true, color: '87571C', fontSize: 13 } }, { text: s.gap, options: { color: ink, fontSize: 13 } }], { x: 0.85, y: top + 0.3, w: 7.0, h: 1.3, fontFace: 'Arial', valign: 'top' });
      top += 1.9;
    }
    if (s.chart) {
      const w = hasSide ? 7.6 : 12.1, h = Math.min(4.3, 6.55 - top);
      const n = s.chart.native;
      if (n) {
        const type = n.type === 'bar' ? pptx.ChartType.bar : n.type === 'radar' ? pptx.ChartType.radar : n.type === 'line' ? pptx.ChartType.line : n.type === 'doughnut' ? pptx.ChartType.doughnut : pptx.ChartType.scatter;
        const longLabels = n.labels.some(l => l.length > 12);
        slide.addChart(type, n.series.map(x => ({ name: x.name, labels: n.labels, values: x.values })), {
          x: 0.6, y: top, w, h, chartColors: colors, barDir: longLabels ? 'bar' : 'col', catAxisLabelColor: sub, valAxisLabelColor: sub, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, catAxisLabelFontFace: 'Arial', valAxisLabelFontFace: 'Arial',
          showLegend: n.series.length > 1, legendPos: 'b', legendFontSize: 10, legendColor: sub, showValue: n.series.length === 1 && n.type !== 'radar' && n.type !== 'line', dataLabelColor: ink, dataLabelFontSize: 9, valGridLine: { color: 'E3E8E4', size: 0.5 }, catGridLine: { style: 'none' },
          showTitle: true, title: s.chart.title, titleFontSize: 12, titleColor: ink, titleFontFace: 'Arial', radarStyle: 'marker', lineSize: 2, lineDataSymbolSize: 6,
        });
      } else if (assets.png[s.number]) slide.addImage({ data: assets.png[s.number], x: 0.6, y: top, w, h, sizing: { type: 'contain', w, h } });
      slide.addText(s.chart.question, { x: 0.6, y: top + h, w, h: 0.3, fontFace: 'Arial', fontSize: 9, italic: true, color: sub });
    } else if (s.table) {
      const rows = [s.table.columns.map(c => ({ text: c, options: { bold: true, color: 'FFFFFF', fill: { color: primary } } })), ...s.table.rows.map((r, i) => r.map(c => ({ text: String(c), options: { color: ink, fill: { color: i % 2 ? 'FFFFFF' : 'F0F2ED' } } })))];
      slide.addTable(rows, { x: 0.6, y: top, w: hasSide ? 7.6 : 12.1, fontFace: 'Arial', fontSize: s.table.columns.length > 4 ? 9.5 : 11, border: { type: 'solid', color: 'DDE3DF', pt: 0.5 }, valign: 'middle', autoPage: false, rowH: 0.34 });
    } else if (s.photo && assets.photos[photoKey(s)]) {
      slide.addImage({ data: assets.photos[photoKey(s)], x: 8.4, y: top, w: 4.3, h: 4.2, sizing: { type: 'cover', w: 4.3, h: 4.2 } });
    }
    if (hasSide) {
      const x = s.chart || s.table ? 8.5 : 0.6, w = s.chart || s.table ? 4.2 : (s.photo ? 7.4 : 12.1);
      let y = top;
      if (s.metrics.length) {
        const cols = s.chart || s.table ? 2 : Math.min(4, s.metrics.length);
        const tileW = (w - (cols - 1) * 0.15) / cols;
        s.metrics.forEach((m, i) => {
          const tx = x + (i % cols) * (tileW + 0.15), ty = y + Math.floor(i / cols) * 1.0;
          slide.addShape(pptx.ShapeType.roundRect, { x: tx, y: ty, w: tileW, h: 0.88, fill: { color: 'FFFFFF' }, line: { color: 'DDE3DF', width: 0.75 }, rectRadius: 0.06 });
          slide.addText([{ text: m.value + '\n', options: { fontFace: 'Georgia', fontSize: 20, color: primary } }, { text: m.label + (m.note ? ' · ' + m.note : ''), options: { fontFace: 'Arial', fontSize: 9, color: sub } }], { x: tx + 0.1, y: ty + 0.05, w: tileW - 0.2, h: 0.8, valign: 'middle' });
        });
        y += Math.ceil(s.metrics.length / cols) * 1.0 + 0.1;
      }
      if (s.bullets.length) slide.addText(s.bullets.map(b => ({ text: b, options: { bullet: { indent: 14 }, paraSpaceAfter: 6 } })), { x, y, w, h: Math.max(0.6, 6.6 - y), fontFace: 'Arial', fontSize: s.chart || s.table ? 11.5 : 14, color: ink, valign: 'top', fit: 'shrink' });
    }
    slide.addText(s.source, { x: 0.6, y: 6.78, w: 10.5, h: 0.3, fontFace: 'Arial', fontSize: 8.5, italic: true, color: sub, fit: 'shrink' });
    slide.addText(config.clientName + ' · ' + reportProducts[config.product].label + '   |   ' + brandLine(config), { x: 0.6, y: 7.08, w: 10, h: 0.25, fontFace: 'Arial', fontSize: 8.5, color: sub });
    slide.addText(String(s.number).padStart(2, '0'), { x: 12.1, y: 7.02, w: 0.6, h: 0.3, fontFace: 'Arial', fontSize: 10, bold: true, color: primary, align: 'right' });
  });
  progress(3, 0, 1, 'Packaging PowerPoint file…');
  return await pptx.write({ outputType: 'blob' }) as Blob;
}

const photoKey = (s: Slide) => s.kind === 'content' ? 'content' : s.kind === 'competitive' ? 'competitive' : s.kind === 'roadmap' ? 'roadmap' : 'cover';

async function vectorChart(doc: import('jspdf').jsPDF, svg: string, x: number, y: number, w: number, h: number) {
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + CHART_W + 'px;height:' + CHART_H + 'px;';
  holder.innerHTML = svg;
  document.body.appendChild(holder);
  try { await doc.svg(holder.querySelector('svg')!, { x, y, width: w, height: h }); }
  finally { holder.remove(); }
}

function rgb(c: string): [number, number, number] { const h = hex(c); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

export async function exportPdfDeck(slides: Slide[], config: ReportConfig, assets: Assets, progress: Progress): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  await import('svg2pdf.js');
  const autoTable = (await import('jspdf-autotable')).default;
  const W = 960, H = 540, M = 43;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [W, H], compress: true });
  doc.setProperties({ title: reportProducts[config.product].label + ' · ' + config.clientName, creator: config.whiteLabel ? config.agencyName : 'VisTa' });
  const primary = rgb(config.primary), accent = rgb(config.accent);
  for (const [i, s] of slides.entries()) {
    progress(2, i, slides.length, 'Typesetting page ' + s.number + ' of ' + slides.length);
    if (i) doc.addPage([W, H], 'landscape');
    if (s.kind === 'cover') {
      doc.setFillColor(11, 17, 23); doc.rect(0, 0, W, H, 'F');
      if (assets.photos.cover) { doc.addImage(assets.photos.cover, 'JPEG', 497, 0, 463, H, undefined, 'MEDIUM'); doc.setFillColor(11, 17, 23); doc.setGState(new (doc as unknown as { GState: new (o: Record<string, number>) => unknown }).GState({ opacity: 0.45 }) as never); doc.rect(497, 0, 463, H, 'F'); doc.setGState(new (doc as unknown as { GState: new (o: Record<string, number>) => unknown }).GState({ opacity: 1 }) as never); }
      doc.setFillColor(...primary); doc.rect(M, 166, 5, 158, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(167, 233, 207); doc.text(s.kicker, 65, 172, { charSpace: 2 });
      doc.setFont('times', 'normal'); doc.setFontSize(40); doc.setTextColor(255, 255, 255); doc.text(doc.splitTextToSize(s.title, 420), 65, 222);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(14); doc.setTextColor(201, 214, 210); doc.text(doc.splitTextToSize(s.lead || '', 420), 65, 304);
      doc.setFontSize(11); doc.setTextColor(159, 179, 174); doc.text(s.bullets, 65, 336);
      if (assets.logos.client) doc.addImage(assets.logos.client, 'PNG', M, 36, 110, 55, undefined, 'FAST');
      if (assets.logos.agency) doc.addImage(assets.logos.agency, 'PNG', 330, 36, 110, 55, undefined, 'FAST');
      doc.text(s.source, 65, 488);
      continue;
    }
    doc.setFillColor(248, 247, 242); doc.rect(0, 0, W, H, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...accent); doc.text(s.kicker, M, 34, { charSpace: 1.6 });
    doc.setDrawColor(...primary); doc.setLineWidth(2); doc.line(M, 44, M + 64, 44);
    doc.setFont('times', 'normal'); doc.setFontSize(25); doc.setTextColor(25, 51, 45);
    const title = doc.splitTextToSize(s.title, W - 2 * M).slice(0, 2);
    doc.text(title, M, 76);
    let top = 76 + title.length * 26;
    if (s.lead) { doc.setFont('helvetica', 'normal'); doc.setFontSize(12.5); doc.setTextColor(82, 111, 100); const lead = doc.splitTextToSize(s.lead, W - 2 * M).slice(0, 2); doc.text(lead, M, top + 2); top += lead.length * 16 + 8; }
    top += 6;
    const hasSide = s.bullets.length > 0 || s.metrics.length > 0;
    const mainW = hasSide ? 548 : W - 2 * M;
    const bottom = 484;
    if (s.gap && !s.chart && !s.table) {
      doc.setFillColor(255, 255, 255); doc.setDrawColor(217, 201, 163); doc.setLineWidth(1); doc.roundedRect(M, top, 532, 92, 6, 6, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(135, 87, 28); doc.text('Evidence gap', M + 16, top + 26);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 51, 45); doc.text(doc.splitTextToSize(s.gap, 500), M + 16, top + 48);
      top += 110;
    }
    if (s.chart && assets.svg[s.number]) {
      const h = Math.min(bottom - top - 16, mainW * CHART_H / CHART_W);
      progress(2, i, slides.length, 'Drawing vector chart: ' + s.chart.title);
      await vectorChart(doc, assets.svg[s.number], M, top, h * CHART_W / CHART_H, h);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(82, 111, 100); doc.text(doc.splitTextToSize(s.chart.question, mainW)[0], M, top + h + 12);
    } else if (s.table) {
      autoTable(doc, { startY: top, margin: { left: M, right: hasSide ? W - M - mainW : M }, head: [s.table.columns], body: s.table.rows.map(r => r.map(String)), styles: { font: 'helvetica', fontSize: s.table.columns.length > 4 ? 8.5 : 10, textColor: [25, 51, 45], cellPadding: 5, lineColor: [221, 227, 223], lineWidth: 0.5 }, headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [240, 242, 237] }, theme: 'grid', pageBreak: 'avoid', rowPageBreak: 'avoid' });
    } else if (s.photo && assets.photos[photoKey(s)]) {
      doc.addImage(assets.photos[photoKey(s)], 'JPEG', 610, top, 307, 300, undefined, 'MEDIUM');
    }
    if (hasSide) {
      const x = s.chart || s.table ? 612 : M, w = s.chart || s.table ? W - M - 612 : (s.photo ? 532 : W - 2 * M);
      let y = top;
      if (s.metrics.length) {
        const cols = s.chart || s.table ? 2 : Math.min(4, s.metrics.length);
        const tileW = (w - (cols - 1) * 10) / cols;
        s.metrics.forEach((m, k) => {
          const tx = x + (k % cols) * (tileW + 10), ty = y + Math.floor(k / cols) * 70;
          doc.setFillColor(255, 255, 255); doc.setDrawColor(221, 227, 223); doc.setLineWidth(0.75); doc.roundedRect(tx, ty, tileW, 62, 5, 5, 'FD');
          doc.setFont('times', 'normal'); doc.setFontSize(20); doc.setTextColor(...primary); doc.text(m.value, tx + 10, ty + 28);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(82, 111, 100); doc.text(doc.splitTextToSize(m.label + (m.note ? ' · ' + m.note : ''), tileW - 20).slice(0, 2), tx + 10, ty + 44);
        });
        y += Math.ceil(s.metrics.length / cols) * 70 + 8;
      }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(s.chart || s.table ? 11 : 13); doc.setTextColor(25, 51, 45);
      for (const b of s.bullets) {
        const lines = doc.splitTextToSize(b, w - 14);
        if (y + lines.length * 15 > bottom) break;
        doc.setFillColor(...primary); doc.circle(x + 3, y - 3.5, 2.2, 'F');
        doc.text(lines, x + 12, y); y += lines.length * (s.chart || s.table ? 14 : 16.5) + 7;
      }
    }
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(82, 111, 100); doc.text(doc.splitTextToSize(s.source, 760)[0], M, 500);
    doc.setFont('helvetica', 'normal'); doc.text(config.clientName + ' · ' + reportProducts[config.product].label + '   |   ' + brandLine(config), M, 522);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...primary); doc.text(String(s.number).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0'), W - M, 522, { align: 'right' });
  }
  progress(3, 0, 1, 'Packaging PDF…');
  return doc.output('blob');
}

export async function exportPdfReport(inv: Investigation, a: Analysis, slides: Slide[], config: ReportConfig, assets: Assets, progress: Progress): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  await import('svg2pdf.js');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  const W = 595.28, H = 841.89, M = 50, CW = W - 2 * M;
  const primary = rgb(config.primary), accent = rgb(config.accent);
  doc.setProperties({ title: 'Analytical report · ' + config.clientName, creator: config.whiteLabel ? config.agencyName : 'VisTa' });
  let y = M;
  const ensure = (h: number) => { if (y + h > H - 60) { doc.addPage(); y = M; } };
  const heading = (text: string, size = 17) => { ensure(size * 2.4); doc.setFont('times', 'normal'); doc.setFontSize(size); doc.setTextColor(25, 51, 45); const lines = doc.splitTextToSize(text, CW); doc.text(lines, M, y + size); y += lines.length * size * 1.18 + 10; };
  const kicker = (text: string) => { ensure(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...accent); doc.text(text.toUpperCase(), M, y + 8, { charSpace: 1.2 }); y += 16; };
  const para = (text: string, size = 10, color: [number, number, number] = [25, 51, 45]) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size); doc.setTextColor(...color); for (const line of doc.splitTextToSize(text, CW)) { ensure(size * 1.45); doc.text(line, M, y + size); y += size * 1.42; } y += 5; };
  const table = (columns: string[], rows: (string | number)[][], size = 8.5) => { autoTable(doc, { startY: y, margin: { left: M, right: M, bottom: 60 }, head: [columns], body: rows.map(r => r.map(String)), styles: { font: 'helvetica', fontSize: size, cellPadding: 4, textColor: [25, 51, 45], lineColor: [221, 227, 223], lineWidth: 0.5, overflow: 'linebreak' }, headStyles: { fillColor: primary, textColor: [255, 255, 255] }, alternateRowStyles: { fillColor: [244, 246, 242] }, theme: 'grid' }); y = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY) + 16; };

  // Cover.
  progress(2, 0, 10, 'Composing cover and summary…');
  doc.setFillColor(11, 17, 23); doc.rect(0, 0, W, 330, 'F');
  if (assets.photos.cover) { doc.addImage(assets.photos.cover, 'JPEG', 0, 0, W, 330, undefined, 'MEDIUM'); doc.setGState(new (doc as unknown as { GState: new (o: Record<string, number>) => unknown }).GState({ opacity: 0.6 }) as never); doc.setFillColor(11, 17, 23); doc.rect(0, 0, W, 330, 'F'); doc.setGState(new (doc as unknown as { GState: new (o: Record<string, number>) => unknown }).GState({ opacity: 1 }) as never); }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(167, 233, 207); doc.text('DETAILED ANALYTICAL REPORT · ' + reportProducts[config.product].label.toUpperCase(), M, 210, { charSpace: 1.2 });
  doc.setFont('times', 'normal'); doc.setFontSize(34); doc.setTextColor(255, 255, 255); doc.text(doc.splitTextToSize(config.clientName, CW), M, 252);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(201, 214, 210); doc.text(inv.brief.website + ' · ' + (inv.discovery?.collectedAt || inv.updatedAt).slice(0, 10) + ' · ' + brandLine(config), M, 300);
  if (assets.logos.client) doc.addImage(assets.logos.client, 'PNG', M, 40, 100, 50, undefined, 'FAST');
  y = 360;
  kicker('Executive summary');
  const summary = slides.find(s => s.kind === 'summary');
  if (summary) { heading(summary.title, 18); if (summary.lead) para(summary.lead, 10.5, [82, 111, 100]); for (const b of summary.bullets) para('• ' + b); }
  kicker('Intelligence Index');
  table(['Dimension', 'Score', 'Coverage', 'Evidence class', 'Basis'], a.index.dimensions.map(d => [d.label, d.score ?? '—', Math.round(d.coverage * 100) + '%', d.evidenceClass, d.basis]));
  para(a.index.index !== null ? 'Overall index ' + a.index.index + ' (range ' + a.index.range!.join('–') + '). ' + a.index.method : a.index.reason + ' ' + a.index.method, 9, [82, 111, 100]);

  // Chart sections.
  const charted = slides.filter(s => s.chart && assets.svg[s.number] && s.kind !== 'cover');
  for (const [k, s] of charted.entries()) {
    progress(2, k + 1, charted.length + 4, 'Placing chart ' + (k + 1) + ' of ' + charted.length);
    const h = CW * CHART_H / CHART_W;
    ensure(h + 90);
    kicker(s.kicker); heading(s.title, 14);
    await vectorChart(doc, assets.svg[s.number], M, y, CW, h);
    y += h + 6; para(s.chart!.question + ' ' + s.source, 8.5, [82, 111, 100]);
    for (const b of s.bullets.slice(0, 4)) para('• ' + b, 9.5);
  }

  // Findings in depth.
  doc.addPage(); y = M;
  kicker('Findings in depth'); heading(a.findings.length + ' evidence-backed findings', 18);
  for (const f of a.findings.filter(x => config.depth === 'detailed' || x.severity !== 'low' && x.severity !== 'info')) {
    ensure(120);
    doc.setFillColor(...(f.severity === 'critical' || f.severity === 'high' ? [178, 58, 69] as [number, number, number] : f.severity === 'medium' ? [135, 87, 28] as [number, number, number] : [39, 106, 141] as [number, number, number]));
    doc.roundedRect(M, y + 2, 58, 14, 3, 3, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(255, 255, 255); doc.text(f.severity.toUpperCase(), M + 29, y + 12, { align: 'center' });
    doc.setTextColor(...accent); doc.text(f.evidenceId + ' · ' + f.module + ' · engine ' + f.engine, M + 66, y + 12); y += 20;
    heading(f.title, 13);
    para(f.summary);
    para('Evidence: ' + f.evidence.join('; '), 9, [82, 111, 100]);
    para('Implication: ' + f.implication, 9.5);
    para('Recommendation: ' + f.recommendation, 9.5);
    para('Success metric: ' + f.metric + ' · Source: ' + f.source + ', ' + f.collectedAt.slice(0, 10) + ' · Confidence: ' + f.confidence, 8.5, [82, 111, 100]);
    if (f.affected.length) table(['Affected location', 'Detail'], f.affected.slice(0, config.depth === 'detailed' ? 15 : 6).map(x => [x.url, x.detail]), 7.5);
  }

  progress(2, charted.length + 2, charted.length + 4, 'Adding interventions and roadmap…');
  doc.addPage(); y = M;
  kicker('Interventions and roadmap'); heading('Prioritised interventions', 18);
  table(['Intervention', 'Evidence', 'Phase', 'Effort', 'Cost range', 'Owner', 'Success metric', 'Review'], a.interventions.map(i => [i.action, i.evidenceId, i.phase + ' days', i.effortDays.join('–') + ' d', (inv.settings?.currency || 'GBP') + ' ' + i.cost.join('–'), i.owner, i.metric, i.reviewDate]), 7.5);
  for (const p of a.phases) { kicker(p.label); para(p.items.map(i => '• ' + i.finding).join('\n') || 'Nothing scheduled.', 9.5); }
  if (inv.observations.length) { kicker('AI search observations'); table(['Provider', 'Surface', 'Prompt', 'Brand', 'Competitors', 'Citations', 'Date'], inv.observations.map(o => [o.provider + ' ' + o.model, o.surface, o.prompt, o.brandMentioned ? 'Yes' : 'No', o.competitorMentions.join(', '), o.citations.length, o.collectedAt.slice(0, 10)]), 7.5); }
  kicker('Page inventory'); table(['Page', 'Type', 'Status', 'Indexable', 'Words', 'GEO'], inv.pages.slice(0, config.depth === 'detailed' ? 200 : 60).map(p => [p.finalUrl, p.pageType, p.status, p.indexable ? 'Yes' : 'No', p.content.words, geoReadiness(p).score]), 7.5);
  kicker('Methodology and limitations');
  for (const line of ['Pages were retrieved by VisTa\'s public crawler, respecting robots.txt, without executing JavaScript.', 'Technical indexability is not confirmed indexing; Search Console evidence is required for that.', 'AI visibility rates use Wilson 95% intervals; API answers differ from consumer AI products.', 'Competitor comparisons use small equal samples and are indicative.', 'No metric is substituted when a provider is unavailable; such dimensions are marked unavailable.']) para('• ' + line, 9.5);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    if (i > 1) { doc.setDrawColor(221, 227, 223); doc.setLineWidth(0.5); doc.line(M, H - 40, W - M, H - 40); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(82, 111, 100);
    if (i > 1) doc.text(config.clientName + ' · ' + brandLine(config), M, H - 26);
    doc.text('Page ' + i + ' of ' + pages, W - M, H - 26, { align: 'right' });
  }
  progress(3, 0, 1, 'Packaging PDF…');
  return doc.output('blob');
}

export function evidenceSheets(inv: Investigation, a: Analysis) {
  return [
    { name: 'Summary', columns: ['Field', 'Value'], rows: [['Client website', inv.brief.website], ['Brand', inv.brief.brand], ['Assessment', inv.brief.assessment], ['Audit mode', inv.brief.mode], ['Collected', inv.discovery?.collectedAt || ''], ['Pages analysed', inv.pages.length], ['Pages failed or restricted', inv.failures.length], ['Intelligence Index', a.index.index ?? 'Not calculated'], ['Index coverage', Math.round(a.index.coverage * 100) + '%'], ['Index method', a.index.method], ['Findings', a.findings.length], ['Interventions', a.interventions.length]] as (string | number)[][] },
    { name: 'Index dimensions', columns: ['Dimension', 'Score', 'Coverage', 'Evidence class', 'Basis', 'Measured', 'Assumptions'], rows: a.index.dimensions.map(d => [d.label, d.score ?? '', Math.round(d.coverage * 100) / 100, d.evidenceClass, d.basis, d.measuredAt || '', d.assumptions]) },
    { name: 'Findings', columns: ['Evidence ID', 'Title', 'Severity', 'Module', 'Engine', 'Confidence', 'Evidence class', 'Affected', 'Summary', 'Evidence', 'Implication', 'Recommendation', 'Success metric', 'Source', 'Collected', 'Methodology'], rows: a.findings.map(f => [f.evidenceId, f.title, f.severity, f.module, f.engine, f.confidence, f.evidenceClass, f.affectedCount, f.summary, f.evidence.join(' | '), f.implication, f.recommendation, f.metric, f.source, f.collectedAt, f.methodology]) },
    { name: 'Affected locations', columns: ['Evidence ID', 'Finding', 'URL', 'Detail'], rows: a.findings.flatMap(f => f.affected.map(x => [f.evidenceId, f.title, x.url, x.detail])) },
    { name: 'Interventions', columns: ['ID', 'Evidence ID', 'Finding', 'Objective', 'Action', 'Expected outcome', 'Effort days (low)', 'Effort days (high)', 'Cost low', 'Cost high', 'Owner', 'Success metric', 'Review date', 'Priority', 'Phase', 'Depends on'], rows: a.interventions.map(i => [i.id, i.evidenceId, i.finding, i.objective, i.action, i.outcome, i.effortDays[0], i.effortDays[1], i.cost[0], i.cost[1], i.owner, i.metric, i.reviewDate, i.priority, i.phase, i.dependsOn.join(', ')]) },
    { name: 'Pages', columns: ['URL', 'Final URL', 'Status', 'Depth', 'Type', 'Intent', 'Indexable', 'Index reasons', 'Title', 'Title length', 'Description', 'H1', 'Canonical', 'Words', 'GEO readiness', 'Schema types', 'Images', 'Missing alt', 'Internal links', 'External links', 'Render-blocking scripts', 'HTML KB', 'Fetched at'], rows: inv.pages.map(p => [p.url, p.finalUrl, p.status, p.depth, p.pageType, p.intent, p.indexable ? 'Yes' : 'No', p.indexReasons.join(' '), p.title || '', p.title?.length || 0, p.description || '', p.h1.join(' | '), p.canonical || '', p.content.words, geoReadiness(p).score, p.schema.types.join(', '), p.images.count, p.images.missingAlt, p.links.internalCount, p.links.externalCount, p.performance.renderBlockingScripts, Math.round(p.performance.htmlBytes / 1024), p.fetchedAt]) },
    { name: 'Failures', columns: ['URL', 'Depth', 'Kind', 'Status', 'Explanation', 'Redirect chain'], rows: inv.failures.map(f => [f.url, f.depth, f.kind, f.status ?? '', f.message, f.chain.map(h => h.status + ' ' + h.url).join(' → ')]) },
    { name: 'Link checks', columns: ['URL', 'Status', 'Final URL', 'Redirects', 'Problem'], rows: inv.links.map(l => [l.url, l.status ?? '', l.finalUrl || '', l.redirects, l.message || '']) },
    { name: 'Performance', columns: ['URL', 'Strategy', 'Lab score', 'Lab LCP ms', 'Lab CLS', 'Lab TBT ms', 'Field scope', 'Field LCP p75', 'Field INP p75', 'Field CLS p75', 'Collected'], rows: inv.performance.map(r => [r.url, r.strategy, r.lab.score ?? '', r.lab.lcpMs ?? '', r.lab.cls ?? '', r.lab.tbtMs ?? '', r.field.scope, r.field.lcp?.percentile ?? '', r.field.inp?.percentile ?? '', r.field.cls?.percentile ?? '', r.collectedAt]) },
    { name: 'Competitors', columns: ['Website', 'Pages sampled', 'URL', 'Title', 'Words', 'Schema types', 'GEO readiness'], rows: inv.competitors.flatMap(c => c.pages.map(p => [c.website, c.pages.length, p.finalUrl, p.title || '', p.content.words, p.schema.types.join(', '), geoReadiness(p).score])) },
    { name: 'AI observations', columns: ['ID', 'Provider', 'Model', 'Surface', 'Method', 'Prompt', 'Category', 'Market', 'Language', 'Collected', 'Brand mentioned', 'Competitors', 'Position', 'Citations', 'Inaccurate', 'Accuracy note', 'Methodology', 'Limitations', 'Response'], rows: inv.observations.map(o => [o.id, o.provider, o.model, o.surface, o.method, o.prompt, o.category, o.market, o.language, o.collectedAt, o.brandMentioned ? 'Yes' : 'No', o.competitorMentions.join(', '), o.position ?? '', o.citations.map(c => c.url).join(' '), o.inaccurate === null ? '' : o.inaccurate ? 'Yes' : 'No', o.accuracyNote, o.methodology, o.limitations, o.response]) },
    { name: 'GEO metrics', columns: ['Metric', 'Value', 'Numerator', 'Sample size', '95% low', '95% high'], rows: ([['AI brand mention rate', a.geo.mentionRate], ['AI citation rate', a.geo.citationRate], ['Recommendation rate', a.geo.recommendationRate], ['Competitive mention share', a.geo.competitiveShare], ['Brand information accuracy', a.geo.accuracy]] as const).map(([n, r]) => [n, Math.round(r.value * 1000) / 1000, r.numerator, r.n, Math.round(r.low * 1000) / 1000, Math.round(r.high * 1000) / 1000]) },
  ];
}

export async function exportWorkbook(inv: Investigation, a: Analysis): Promise<Blob> {
  return buildXlsx(evidenceSheets(inv, a), 'VisTa evidence workbook · ' + inv.brief.brand);
}

export function exportCsv(inv: Investigation, a: Analysis, which: 'findings' | 'pages' | 'interventions'): Blob {
  const sheet = evidenceSheets(inv, a).find(s => s.name === (which === 'findings' ? 'Findings' : which === 'pages' ? 'Pages' : 'Interventions'))!;
  return new Blob(['﻿' + toCsv(sheet.columns, sheet.rows)], { type: 'text/csv;charset=utf-8' });
}

export function exportJson(inv: Investigation, a: Analysis): Blob {
  return new Blob([JSON.stringify({ format: 'vista-investigation/1', exportedAt: new Date().toISOString(), investigation: inv, analysis: { index: a.index, findings: a.findings, interventions: a.interventions, geo: a.geo, opportunities: a.opportunities, upside: a.upside } }, null, 2)], { type: 'application/json' });
}

export async function exportChartsZip(specs: ChartSpec[], progress: Progress): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const [i, spec] of specs.entries()) {
    progress(1, i, specs.length, 'Rendering ' + spec.title);
    const svg = await renderChartSvg(spec, 'light', 1600, 900);
    const name = String(i + 1).padStart(2, '0') + '-' + spec.id;
    zip.file(name + '.svg', svg);
    const png = await svgToPng(svg, 1600, 900, 2, '#FFFFFF');
    zip.file(name + '.png', png.split(',')[1], { base64: true });
  }
  progress(3, 0, 1, 'Packaging charts…');
  return zip.generateAsync({ type: 'blob' });
}
