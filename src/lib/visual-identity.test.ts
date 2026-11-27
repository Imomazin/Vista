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

test("Porcelain strengthened foreground pairs remain legible on light surfaces",()=>{
 for(const bg of ["#FFFFFF","#F8F7F2","#F0F2ED"]){
  for(const fg of ["#102C24","#2B463A","#40565B","#0B513C","#4C287E","#344E40"])assert.ok(contrastRatio(fg,bg)>=7,fg+" on "+bg);
  assert.ok(contrastRatio("#61776A",bg)>=3);
 }
 assert.ok(contrastRatio("#FFFFFF","#0D5B43")>=7);
});
