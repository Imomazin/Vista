import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {categoryForEngine,cinematicVisuals,fullSelectionCount,getEngineVisuals,parentBrandVisuals,selectedPhotography,visualAssets} from "./visual-assets";

test("all user selections are retained without duplicate image files",()=>{
 assert.equal(fullSelectionCount,41);
 assert.equal(visualAssets.length,40);
 assert.equal(selectedPhotography.length,37);
 assert.equal(parentBrandVisuals.length,3);
 assert.equal(cinematicVisuals.length,6);
 assert.equal(new Set(visualAssets.map(x=>x.path)).size,visualAssets.length);
});
test("every designated image binary is actually present in the project",()=>{
 for(const item of visualAssets){
  assert.match(item.path,/^\/web-images\/[a-z-]+\/[a-z-]+\.(jpg|png)$/);
  assert.ok(existsSync(join(process.cwd(),"public",item.path.slice(1))),"Missing "+item.path);
 }
});
test("each of the nine intelligence studios has allocated real photography",()=>{
 for(const engine of [1,2,3,4,5,6,7,8,9] as const){
  assert.ok(categoryForEngine[engine]);
  assert.ok(getEngineVisuals(engine).length>0);
 }
});
