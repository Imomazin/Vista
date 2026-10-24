import test from "node:test";
import assert from "node:assert/strict";
import { analyseHtml } from "./audit";

test("reports core page signals without invented ranking information", () => {
  const html = '<html lang="en"><head><title>Professional consulting and business training services</title><meta name="description" content="Business training."/><meta name="viewport" content="width=device-width"/><link rel="canonical" href="https://example.com/"/><meta property="og:title" content="Example"/></head><body><h1>Corporate training</h1><script type="application/ld+json">{"@type":"Organization"}</script><img src="x.jpg" alt="Training session"/></body></html>';
  const result = analyseHtml("https://example.com", html);
  assert.equal(result.title, "Professional consulting and business training services");
  assert.equal(result.headingOneCount, 1);
  assert.equal(result.structuredDataBlocks, 1);
  assert.equal(result.imagesMissingAlt, 0);
  assert.equal(result.signals.length, 9);
  assert.equal(result.technicalScore, 100);
});

test("detects missing metadata and a noindex directive", () => {
  const result = analyseHtml("https://example.com/private", "<html><head><meta name='robots' content='noindex'></head><body><img src='photo.jpg'><h1>A</h1><h1>B</h1></body></html>");
  assert.equal(result.imagesMissingAlt, 1);
  assert.equal(result.signals.find((item) => item.id === "index")?.status, "issue");
  assert.equal(result.signals.find((item) => item.id === "title")?.status, "issue");
  assert.equal(result.signals.find((item) => item.id === "headings")?.status, "warning");
  assert.ok(result.technicalScore < 50);
});

test("honours X-Robots-Tag response headers", () => {
  const result = analyseHtml("https://example.com", "<html><head><title>Example</title></head><body></body></html>", "noindex, nofollow");
  assert.equal(result.signals[0].status, "issue");
});

test('distinguishes decorative alt text from missing attributes',()=>{const report=analyseHtml('https://example.com','<img alt=""><img alt="Illustration"><img src="missing.jpg">');assert.equal(report.imagesMissingAlt,1);});
test('invalid structured data, canonical schemes and fixed viewports need review',()=>{const report=analyseHtml('https://example.com','<script type="application/ld+json">{broken}</script><link rel="canonical" href="javascript:alert(1)"><meta name="viewport" content="width=1200">');for(const id of ['structured','canonical','mobile'])assert.equal(report.signals.find(s=>s.id===id)?.status,'warning');});
test('robots none restricts indexing and external canonical needs review',()=>{const report=analyseHtml('https://example.com','<meta name="robots" content="none"><link rel="canonical" href="https://other.example.com">');assert.equal(report.signals.find(s=>s.id==='index')?.status,'issue');assert.equal(report.signals.find(s=>s.id==='canonical')?.status,'warning');});
