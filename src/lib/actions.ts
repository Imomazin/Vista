import { actionKey, type Workspace, type ActionPlan } from './workspace';
export function projectActions(workspace: Workspace, projectId: string) {
  const newest = new Map<string, Workspace['snapshots'][number]>();
  for (const snapshot of workspace.snapshots.filter(s=>s.projectId===projectId)) {
    const old = newest.get(snapshot.report.url);
    if (!old || Date.parse(snapshot.report.inspectedAt)>Date.parse(old.report.inspectedAt)) newest.set(snapshot.report.url,snapshot);
  }
  return [...newest.values()].flatMap(snapshot=>snapshot.report.signals.flatMap(signal=>{
    const key=actionKey(projectId,snapshot.report.url,signal.id);
    const saved=workspace.actionPlans?.find(a=>a.key===key);
    if(signal.status==='pass'&&!saved) return [];
    const legacy=workspace.completed.includes(snapshot.id+':'+signal.id);
    const plan:ActionPlan=saved||{key,projectId,url:snapshot.report.url,signalId:signal.id,owner:'',due:'',notes:'',stage:legacy?'Ready for verification':'Planned',evidenceAt:snapshot.report.inspectedAt};
    const newer=Date.parse(snapshot.report.inspectedAt)>Date.parse(plan.evidenceAt);
    const stage=signal.status==='pass'?'Verified':plan.stage==='Ready for verification'&&newer?'Needs attention':plan.stage;
    return [{key,signal,plan,stage,url:snapshot.report.url,inspectedAt:snapshot.report.inspectedAt}];
  })).sort((a,b)=>Number(a.stage==='Verified')-Number(b.stage==='Verified')||Number(b.signal.status==='issue')-Number(a.signal.status==='issue')||a.signal.name.localeCompare(b.signal.name));
}
export type ProjectAction=ReturnType<typeof projectActions>[number];
export function actionBrief(action:ProjectAction, project:Workspace['projects'][number]) {
  return `# ${action.signal.name}: ${project.name}\n\nPage: ${action.url}\nAudience: ${project.audience||'To be defined'}\nBusiness goal: ${project.goal||'To be defined'}\n\n## Observed evidence\n${action.signal.detail}\n\nCaptured: ${action.inspectedAt}\n\n## Required change\n${action.signal.recommendation}\n\n## Delivery notes\n${action.plan.notes||'Document the proposed changes and supporting sources.'}\n\n## Acceptance check\nReview the published page and run a new Vista audit. A passing HTML signal verifies this check only, not traffic or commercial impact.`;
}
