import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {join} from "node:path";
import {editorialPhotography,studioPhotography} from "./editorial-photos";
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

test("nine studios use distinct editorial lead photographs with source attribution and local fallback",()=>{
 assert.equal(new Set(editorialPhotography.map(p=>p.path)).size,10);
 for(const engine of [1,2,3,4,5,6,7,8,9] as const){
  const p=studioPhotography[engine];assert.equal(getEngineVisuals(engine)[0].path,p.path);assert.equal(p.folder,categoryForEngine[engine]);assert.equal(new URL(p.path).hostname,"images.unsplash.com");assert.equal(new URL(p.source).hostname,"unsplash.com");assert.ok(p.photographer);assert.ok(existsSync(join(process.cwd(),"public",p.fallback.slice(1))));
 }
});
