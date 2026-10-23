import type { AuditReport } from './audit';

export function eligiblePages(base: string, hrefs: string[]): string[] {
  const root = new URL(base); root.hash = '';
  const seen = new Set<string>([root.href]);
  for (const href of hrefs) {
    try {
      const url = new URL(href, root); url.hash = '';
      if (url.origin !== root.origin || url.protocol !== 'https:' || url.username || url.password || url.search || /\.(pdf|zip|jpg|png|webp|svg|mp4|xml)$/i.test(url.pathname) || /\/(logout|signout|cart|checkout)(\/|$)/i.test(url.pathname)) continue;
      seen.add(url.href);
      if (seen.size === 21) break;
    } catch { /* Ignore malformed links. */ }
  }
  return [...seen].slice(1);
}
export function investigationFindings(reports: AuditReport[]) {
  const unique = [...new Map(reports.map(r => [r.url, r])).values()];
  const groups = new Map<string, {id:string;name:string;recommendation:string;issues:number;pages:{url:string;detail:string;status:string}[]}>();
  for (const report of unique) for (const signal of report.signals) {
    if (signal.status === 'pass') continue;
    const group = groups.get(signal.id) || {id:signal.id,name:signal.name,recommendation:signal.recommendation,issues:0,pages:[]};
    group.issues += signal.status === 'issue' ? 1 : 0;
    group.pages.push({url:report.url,detail:signal.detail,status:signal.status});
    groups.set(signal.id,group);
  }
  return [...groups.values()].sort((a,b)=>b.issues-a.issues || b.pages.length-a.pages.length || a.name.localeCompare(b.name));
}
