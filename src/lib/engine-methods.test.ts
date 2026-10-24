import test from "node:test";import assert from "node:assert/strict";
import {engineMethods,engineById,engineSummary} from "./engine-methods";
import {emptyWorkspace} from "./workspace";
test("exactly nine distinct elements map to VisTa's five pillars",()=>{
 assert.deepEqual(engineMethods.map(m=>m.id),[1,2,3,4,5,6,7,8,9]);
 assert.deepEqual([...new Set(engineMethods.map(m=>m.pillar))],["V","I","S","T","A"]);
 assert.ok(engineMethods.every(m=>m.metrics.length>=4&&m.diagnostic.length>=4&&m.inputs.length>=3));
});
test("source unavailable indicators never report fabricated search or business metrics",()=>{
 for(const id of [1,2,5,6] as const)assert.equal(engineSummary(id,emptyWorkspace()).value,null);
 assert.equal(engineSummary(9,emptyWorkspace()).value,0);
 assert.equal(engineById(99),undefined);
});
