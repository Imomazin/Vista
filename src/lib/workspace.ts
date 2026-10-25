import {validInspection} from "./inspection-schema";
import type { AuditReport } from './audit';
export type Project = { id: string; name: string; url: string; audience: string; goal: string };
export type Snapshot = { id: string; projectId: string; report: AuditReport };
export type Brief = { id: string; projectId: string; topic: string; intent: string; audience: string; outline: string; status: 'Draft' | 'Ready' | 'Published' };
export type Observation = { id: string; projectId: string; provider: string; prompt: string; response: string; source: string; mentioned: boolean; observedAt: string };
export type ActionPlan = { key: string; projectId: string; url: string; signalId: string; owner: string; due: string; notes: string; stage: 'Planned' | 'In progress' | 'Ready for verification'; evidenceAt: string };
export type Workspace = { version: 1; projects: Project[]; snapshots: Snapshot[]; briefs: Brief[]; observations: Observation[]; completed: string[]; actionPlans?: ActionPlan[] };
export const emptyWorkspace = (): Workspace => ({ version: 1, projects: [], snapshots: [], briefs: [], observations: [], completed: [] });
export const storageKey = 'vista-workspace';
export const activeProjectKey = 'vista-active-project';
export function rememberProject(id:string){try{sessionStorage.setItem(activeProjectKey,id);}catch{/* Selection still works without session storage. */}}
export function preferredProject(){try{return sessionStorage.getItem(activeProjectKey)||'';}catch{return '';}}
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const strings = (x: Record<string, unknown>, keys: string[]) => keys.every(k => typeof x[k] === 'string');
export function publicUrl(value: string): string {
  const url = new URL(value.trim());
  url.hash = '';
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS address without credentials.');
  return url.href;
}
export function parseWorkspace(raw: string): Workspace {
  if (raw.length > 4_000_000) throw new Error('Workspace exceeds the 4 MB import limit.');
  const data: unknown = JSON.parse(raw);
  if (!record(data) || data.version !== 1) throw new Error('Unsupported workspace file.');
  for (const key of ['projects', 'snapshots', 'briefs', 'observations', 'completed']) if (!Array.isArray(data[key]) || data[key].length > 1000) throw new Error('Invalid workspace collection.');
  const w = data as unknown as Workspace;
  if (!w.projects.every(p => record(p) && strings(p, ['id','name','url','audience','goal']))) throw new Error('Invalid projects.');
  w.projects.forEach(p => publicUrl(p.url));
  const ids = new Set(w.projects.map(p => p.id));
  if (ids.size !== w.projects.length) throw new Error('Duplicate project identifiers.');
  if (!w.snapshots.every(s => record(s) && strings(s,['id','projectId']) && ids.has(s.projectId) && record(s.report) && validReport(s.report))) throw new Error('Invalid audit history.');
  if (!w.briefs.every(b => record(b) && strings(b,['id','projectId','topic','intent','audience','outline','status']) && ids.has(b.projectId) && ['Draft','Ready','Published'].includes(b.status))) throw new Error('Invalid content briefs.');
  if (!w.observations.every(o => record(o) && strings(o,['id','projectId','provider','prompt','response','source','observedAt']) && ids.has(o.projectId) && typeof o.mentioned === 'boolean' && Number.isFinite(Date.parse(o.observedAt)))) throw new Error('Invalid observations.');
  w.observations.forEach(o => { if (o.source) publicUrl(o.source); });
  if (!w.completed.every(x => typeof x === 'string')) throw new Error('Invalid action states.');
  if (w.actionPlans !== undefined) {
    if (!Array.isArray(w.actionPlans) || w.actionPlans.length > 1000 || !w.actionPlans.every(a => record(a) && strings(a,['key','projectId','url','signalId','owner','due','notes','stage','evidenceAt']) && ids.has(a.projectId) && ['Planned','In progress','Ready for verification'].includes(a.stage) && Number.isFinite(Date.parse(a.evidenceAt)) && (a.due === '' || (/^\d{4}-\d{2}-\d{2}$/.test(a.due) && new Date(a.due).toISOString().slice(0,10) === a.due)))) throw new Error('Invalid action plans.');
    w.actionPlans.forEach(a => { publicUrl(a.url); if (a.key !== actionKey(a.projectId,a.url,a.signalId)) throw new Error('Invalid action key.'); });
    if (new Set(w.actionPlans.map(a=>a.key)).size !== w.actionPlans.length) throw new Error('Duplicate action plans.');
  }
  for (const collection of [w.snapshots,w.briefs,w.observations]) if(new Set(collection.map(item=>item.id)).size!==collection.length) throw new Error('Duplicate record identifiers.');
  return w;
}
export function actionKey(projectId: string, url: string, signalId: string) { return JSON.stringify([projectId,url,signalId]); }
function validReport(r: Record<string, unknown>): boolean {
  try { publicUrl(String(r.url)); } catch { return false; }
  return typeof r.inspectedAt === 'string' && Number.isFinite(Date.parse(r.inspectedAt)) && typeof r.technicalScore === 'number' && r.technicalScore >= 0 && r.technicalScore <= 100 &&
    ['title','description','canonical','language'].every(k => r[k] === null || typeof r[k] === 'string') &&
    ['headingOneCount','headingTwoCount','imageCount','imagesMissingAlt','structuredDataBlocks'].every(k => typeof r[k] === 'number' && Number.isInteger(r[k]) && (r[k] as number) >= 0) &&
    (r.inspection===undefined||validInspection(r.inspection)) && Array.isArray(r.limitations) && r.limitations.every(x => typeof x === 'string') && Array.isArray(r.signals) && r.signals.every(s => record(s) && strings(s,['id','name','status','detail','recommendation']) && ['pass','warning','issue'].includes(String(s.status)));
}
export function addSnapshot(w: Workspace, projectId: string, report: AuditReport): Workspace {
  if (!w.projects.some(p => p.id === projectId)) throw new Error('Select a project before saving an audit.');
  return { ...w, snapshots: [{ id: crypto.randomUUID(), projectId, report }, ...w.snapshots].sort((a,b)=>Date.parse(b.report.inspectedAt)-Date.parse(a.report.inspectedAt)).slice(0, 100) };
}
export function compareReports(current: AuditReport, previous: AuditReport) {
  if (current.url !== previous.url) throw new Error('Choose audits of the same page to compare.');
  const rank = { issue: 0, warning: 1, pass: 2 };
  return current.signals.map(s => { const old = previous.signals.find(p => p.id === s.id); return { ...s, previous: old?.status, change: old ? rank[s.status] - rank[old.status] : null }; });
}
export function createOutline(topic: string, audience: string, intent: string, goal: string) {
  return `# ${topic}\n\nAudience: ${audience || 'Define the intended reader'}\nSearch intent: ${intent}\nBusiness objective: ${goal || 'Define the intended outcome'}\n\n## Answer the reader’s main question\nState the answer clearly and identify the problem this page solves.\n\n## Explain the decision\nCompare relevant options, costs, trade-offs and constraints.\n\n## Demonstrate the evidence\nAdd original examples, first-hand experience and verified sources.\n\n## Show the next step\nOffer a useful action that matches the reader’s intent.\n\n## Editorial checks\nVerify factual claims and references. Identify the author and relevant expertise. Write a unique title and description. Add relevant internal links. Check accessibility and mobile presentation.\n\n## Measurement\nRecord the baseline, publish date and review date. Evaluate search queries, qualified visits and the intended conversion when analytics are connected.`;
}
