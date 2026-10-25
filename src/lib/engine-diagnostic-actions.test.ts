import test from "node:test";import assert from "node:assert/strict";
import {diagnosticActions} from "./engine-diagnostic-actions";
import {engineMethods} from "./engine-methods";
test("all nine elements have one actionable instruction per diagnostic",()=>{
 for(const method of engineMethods){assert.equal(diagnosticActions[method.id].length,method.diagnostic.length);assert.ok(diagnosticActions[method.id].every(s=>s.length>45));}
});
