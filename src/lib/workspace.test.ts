import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorkspace, parseWorkspace, addSnapshot, compareReports, publicUrl } from './workspace';
import { analyseHtml } from './audit';
const project = {id:'project',name:'Example',url:'https://example.com/',audience:'Teams',goal:'Qualified enquiries'};
function fixture() { return {...emptyWorkspace(),projects:[project]}; }
test('backup roundtrip preserves projects and audit evidence',()=>{
  const w = addSnapshot(fixture(),project.id,analyseHtml(project.url,'<h1>Example</h1>'));
  assert.deepEqual(parseWorkspace(JSON.stringify(w)),w);
});
test('import rejects orphaned records and unsafe links',()=>{
  const w=addSnapshot(fixture(),project.id,analyseHtml(project.url,'<h1>Example</h1>'));
  w.snapshots[0].projectId='missing';
  assert.throws(()=>parseWorkspace(JSON.stringify(w)),/history/);
  for(const value of ['javascript:alert(1)','http://example.com','https://user:password@example.com']) assert.throws(()=>publicUrl(value));
});
test('import rejects malformed signals and duplicate projects',()=>{
  const w=addSnapshot(fixture(),project.id,analyseHtml(project.url,'<h1>Example</h1>'));
  const bad=JSON.parse(JSON.stringify(w)); bad.snapshots[0].report.signals[0].status='unknown';
  assert.throws(()=>parseWorkspace(JSON.stringify(bad)),/history/);
  assert.throws(()=>parseWorkspace(JSON.stringify({...fixture(),projects:[project,project]})),/Duplicate/);
});
test('comparisons identify regressions and refuse unrelated pages',()=>{
  const before=analyseHtml(project.url,'<title>A useful page title with enough characters</title><h1>Example</h1>');
  const after=analyseHtml(project.url,'<h1>Example</h1>');
  assert.equal(compareReports(after,before).find(s=>s.id==='title')?.change,-2);
  assert.throws(()=>compareReports({...after,url:'https://another.example/'},before),/same page/);
});
test('audit history keeps a bounded newest-first set and validates project ownership',()=>{
  let w=fixture(); const report=analyseHtml(project.url,'<h1>Example</h1>');
  for(let i=0;i<105;i++) w=addSnapshot(w,project.id,{...report,title:String(i)});
  assert.equal(w.snapshots.length,100);assert.equal(w.snapshots[0].report.title,'104');
  assert.throws(()=>addSnapshot(w,'missing',report),/Select a project/);
});
test('duplicate evidence identifiers cannot enter the workspace',()=>{const w=addSnapshot(fixture(),project.id,analyseHtml(project.url,'<h1>Example</h1>'));w.snapshots.push(w.snapshots[0]);assert.throws(()=>parseWorkspace(JSON.stringify(w)),/Duplicate record/);});
test('late saves cannot displace newer observed evidence',()=>{let w=addSnapshot(fixture(),project.id,{...analyseHtml(project.url,'<h1>Newer</h1>'),inspectedAt:'2026-10-24T12:00:00Z'});w=addSnapshot(w,project.id,{...analyseHtml(project.url,'<h1>Older</h1>'),inspectedAt:'2026-10-23T12:00:00Z'});assert.equal(w.snapshots[0].report.inspectedAt,'2026-10-24T12:00:00Z');assert.equal(publicUrl('https://example.com/#section'),'https://example.com/');});
