import test from "node:test";
import assert from "node:assert/strict";
import {visualIdentity,contrastRatio} from "./visual-identity";

test("VisTa maintains distinct Obsidian and Porcelain materials",()=>{
 assert.equal(visualIdentity.name,"Titanium + Emerald Intelligence");
 assert.notEqual(visualIdentity.dark.surface,visualIdentity.light.surface);
 assert.notEqual(visualIdentity.dark.emerald,visualIdentity.light.emerald);
});
test("text and primary controls have readable contrast",()=>{
 for(const m of [visualIdentity.dark,visualIdentity.light]){
  assert.ok(contrastRatio(m.foreground,m.surface)>=4.5);
  assert.ok(contrastRatio(m.secondary,m.surface)>=4.5);
  assert.ok(contrastRatio(m.onEmerald,m.emerald)>=4.5);
 }
});
test("emerald remains distinguishable against each canvas",()=>{
 assert.ok(contrastRatio(visualIdentity.dark.emerald,visualIdentity.dark.background)>=3);
 assert.ok(contrastRatio(visualIdentity.light.emerald,visualIdentity.light.background)>=3);
});
