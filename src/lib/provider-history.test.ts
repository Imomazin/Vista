import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistory,comparisonIssue,compareReports,type SavedReport} from './provider-history';
const saved=(id:string,start:string,end:string):SavedReport=>({id,organisationId:'org-a',report:{source:'GA4 Analytics Data API',property:'123456',view:'channels',observedAt:'2026-10-26T12:00:00Z',period:{startDate:start,endDate:end},rows:[{label:'Direct',sessions:20,totalUsers:10,keyEvents:2}]}});
test('history validates bounded records and rejects corrupted metrics without recovery overwrite',()=>{
 const r=saved('one','2026-10-01','2026-10-07');assert.deepEqual(parseHistory(JSON.stringify([r])),[r]);
 assert.throws(()=>parseHistory(JSON.stringify([r,r])));
 assert.throws(()=>parseHistory(JSON.stringify({...r})));
 assert.throws(()=>parseHistory(JSON.stringify([{...r,report:{...r.report,rows:[{sessions:-1}]}}])));
 assert.throws(()=>parseHistory(JSON.stringify(Array.from({length:31},(_,i)=>({...r,id:String(i)})))));
});
test('comparison requires same tenant, property, view and equal nonoverlapping complete periods',()=>{
 const a=saved('one','2026-10-08','2026-10-14'),b=saved('two','2026-10-01','2026-10-07');
 assert.equal(comparisonIssue(a,b),null);
 for(const changed of [{...b,organisationId:'other'},{...b,report:{...b.report,property:'other'}},{...b,report:{...b.report,truncated:true}},{...b,report:{...b.report,rows:[]}},{...b,report:{...b.report,period:{startDate:'2026-10-07',endDate:'2026-10-13'}}}])assert.ok(comparisonIssue(a,changed));
 assert.ok(comparisonIssue({...a,report:{...a.report,view:'realtime'}},{...b,report:{...b.report,view:'realtime'}}));
});
test('comparison retains observed rows and does not invent zero or infinite percentage changes',()=>{
 const a=saved('one','2026-10-08','2026-10-14'),b=saved('two','2026-10-01','2026-10-07');
 b.report.rows=[{label:'Direct',sessions:10,totalUsers:5,keyEvents:0}];a.report.rows.push({label:'New',sessions:4,totalUsers:3,keyEvents:0});
 const result=compareReports(a,b);assert.equal(result.length,3);assert.equal(result[0].change,100);assert.equal(result[2].change,null);
});
