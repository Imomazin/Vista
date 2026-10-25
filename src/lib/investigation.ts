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
  // Cross-page facts the single-page analysis cannot see.
  const shared=[
    {id:"duplicate-description",name:"Repeated meta description",field:(r:AuditReport)=>r.description,recommendation:"Write distinct page descriptions matching each page's real intent and content."},
    {id:"duplicate-title",name:"Repeated page title",field:(r:AuditReport)=>r.title,recommendation:"Use unique, descriptive page titles across distinct URLs."},
    {id:"shared-canonical",name:"Multiple pages declare the same canonical",field:(r:AuditReport)=>r.canonical,recommendation:"Check that internal pages are not unintentionally declaring the homepage as canonical."}
  ];
  for(const rule of shared){
   const seen=new Map<string,AuditReport[]>();
   for(const report of unique){const value=rule.field(report)?.trim();if(!value)continue;const key=value.toLowerCase();seen.set(key,[...(seen.get(key)||[]),report]);}
   const duplicates=[...seen.values()].filter(items=>items.length>1);
   if(!duplicates.length)continue;
   groups.set(rule.id,{id:rule.id,name:rule.name,recommendation:rule.recommendation,issues:0,pages:duplicates.flatMap(items=>items.map(report=>({url:report.url,detail:"Shared value: "+rule.field(report)?.slice(0,180),status:"warning"})))});
  }
  return [...groups.values()].sort((a,b)=>b.issues-a.issues || b.pages.length-a.pages.length || a.name.localeCompare(b.name));
}
