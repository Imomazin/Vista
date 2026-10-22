import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseHtml } from './audit';
import { actionKey, emptyWorkspace, parseWorkspace, type Workspace } from './workspace';
import { projectActions, actionBrief } from './actions';
const project={id:'p',name:'Example',url:'https://example.com/',audience:'Teams',goal:'Enquiries'};
function fixture():Workspace{
  const report=analyseHtml(project.url,'<h1>Example</h1>');
  report.inspectedAt='2026-10-01T10:00:00Z';
  return {...emptyWorkspace(),projects:[project],snapshots:[{id:'s',projectId:'p',report}]};
}
test('action ownership survives scans and only passing evidence verifies work',()=>{
  const w=fixture();const a=projectActions(w,'p').find(a=>a.signal.id==='title')!;
  w.actionPlans=[{...a.plan,owner:'Editor',stage:'Ready for verification'}];
  assert.equal(projectActions(w,'p').find(a=>a.signal.id==='title')!.stage,'Ready for verification');
  w.snapshots.unshift({id:'new',projectId:'p',report:{...w.snapshots[0].report,inspectedAt:'2026-10-02T10:00:00Z'}});
  let current=projectActions(w,'p').find(a=>a.signal.id==='title')!;
  assert.equal(current.stage,'Needs attention');assert.equal(current.plan.owner,'Editor');
  w.snapshots[0].report={...w.snapshots[0].report,signals:w.snapshots[0].report.signals.map(s=>s.id==='title'?{...s,status:'pass'}:s)};
  assert.equal(projectActions(w,'p').find(a=>a.signal.id==='title')!.stage,'Verified');
  assert.deepEqual(parseWorkspace(JSON.stringify(w)),w);
});
test('page-specific actions never merge and imports reject mismatched keys',()=>{
  const w=fixture();w.snapshots.push({id:'other',projectId:'p',report:{...w.snapshots[0].report,url:'https://example.com/about'}});
  const titles=projectActions(w,'p').filter(a=>a.signal.id==='title');assert.equal(titles.length,2);assert.notEqual(titles[0].key,titles[1].key);
  w.actionPlans=[{...titles[0].plan,key:actionKey('p','https://wrong.example/','title')}];
  assert.throws(()=>parseWorkspace(JSON.stringify(w)),/action key/);
});
test('legacy completions remain unverified and evidence briefs cite the page',()=>{
  const w=fixture();w.completed=['s:title'];const a=projectActions(w,'p').find(a=>a.signal.id==='title')!;
  assert.equal(a.stage,'Ready for verification');assert.match(actionBrief(a,project),/https:\/\/example.com/);assert.match(actionBrief(a,project),/Observed evidence/);
  assert.deepEqual(parseWorkspace(JSON.stringify(w)),w);
});
