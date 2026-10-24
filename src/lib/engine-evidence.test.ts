import test from "node:test";import assert from "node:assert/strict";
import {emptyEngineLedger,parseEngineLedger,saveEngineEvidence,removeEngineEvidence} from "./engine-evidence";
test("evidence ledger validates structured source citations",()=>{
 const entry={id:"one",engineId:5 as const,projectId:"p",title:"Verified organisation entity",kind:"Finding" as const,source:"https://example.org/profile",details:"Public legal name",implication:"Check inconsistencies",nextAction:"Correct structured data",observedAt:"2026-10-24T11:00:00Z",savedAt:"2026-10-24T11:00:00Z",stage:"Observed" as const};
 const result=saveEngineEvidence(emptyEngineLedger(),entry);
 assert.equal(result.records.length,1);
 assert.equal(parseEngineLedger(JSON.stringify(result),["p"]).records[0].source,entry.source);
 assert.equal(removeEngineEvidence(result,"one").records.length,0);
 assert.throws(()=>parseEngineLedger(JSON.stringify({...result,records:[entry,entry]})));
 assert.throws(()=>parseEngineLedger(JSON.stringify({...result,records:[{...entry,source:"javascript:alert(1)"}]})));
 assert.throws(()=>parseEngineLedger(JSON.stringify(result),["different-project"]));
});
test("ledger rejects unsupported records and oversized collections",()=>{
 assert.throws(()=>parseEngineLedger(JSON.stringify({version:2,records:[]})));
 assert.throws(()=>parseEngineLedger(JSON.stringify({version:1,records:[{}]})));
 assert.deepEqual(parseEngineLedger(JSON.stringify(emptyEngineLedger())),emptyEngineLedger());
});
