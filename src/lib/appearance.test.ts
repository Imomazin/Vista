import test from "node:test";import assert from "node:assert/strict";
import {resolveAppearance,nextAppearance} from "./appearance";
test("explicit appearance persists over system preference",()=>{
 assert.equal(resolveAppearance("dark",true),"dark");
 assert.equal(resolveAppearance("light",false),"light");
 assert.equal(resolveAppearance("auto",true),"light");
 assert.equal(resolveAppearance(undefined,false),"dark");
 assert.equal(resolveAppearance(null,true),"light");
});
test("theme switch is reversible",()=>{
 assert.equal(nextAppearance(nextAppearance("light")),"light");
 assert.equal(nextAppearance(nextAppearance("dark")),"dark");
});
