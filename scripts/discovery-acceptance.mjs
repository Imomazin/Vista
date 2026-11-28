/**
 * End-to-end acceptance for Intelligent Discovery against the fixture websites and the simulated
 * AI provider (scripts/intel-fixtures.mjs; start VisTa with VISTA_TEST_OPENAI_URL). Provides only a
 * website address, reviews the recommendations, edits some, launches the investigation and checks
 * that accepted recommendations reach the pipeline. Also checks themes, layouts and the BoT entry.
 * Usage: node scripts/discovery-acceptance.mjs [baseUrl] [outDir]
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "discovery-acceptance";
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)("playwright");
const report = { scenarios: [], problems: [], consoleErrors: [] };
let lastStep = "start";
const problem = (detail) => { report.problems.push(detail); console.log("✗", JSON.stringify(detail)); };
const log = (step, detail = "") => { lastStep = step; console.log("✓", step, detail); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { try { if (!localStorage.getItem("vista-appearance")) localStorage.setItem("vista-appearance", "dark"); } catch {} });
const page = await context.newPage();
page.on("pageerror", e => report.consoleErrors.push("after “" + lastStep + "” (" + page.url().split("#")[1] + "): " + String(e.stack || e).slice(0, 500)));
page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource|401|503|422|429/.test(m.text())) report.consoleErrors.push(m.text().slice(0, 300)); });
page.on("dialog", d => d.accept());
const shot = (name, full = true) => page.screenshot({ path: join(out, name + ".png"), fullPage: full });
const discoveryPulse = () => page.locator(".ipulse", { hasText: "Intelligent Discovery" });

async function discover(website, name, expect = {}) {
  await page.getByLabel("Client website", { exact: true }).first().fill(website);
  await page.getByRole("button", { name: /Discover intelligence/ }).click();
  await discoveryPulse().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  await discoveryPulse().screenshot({ path: join(out, name + "-pulse-running.png") }).catch(() => {});
  await page.waitForFunction(() => { const el = [...document.querySelectorAll(".ipulse")].find(e => e.textContent.includes("Intelligent Discovery")); return el && /ipulse-(complete|partial|failed|cancelled)/.test(el.className); }, null, { timeout: 240000 });
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const pulse = [...document.querySelectorAll(".ipulse")].find(e => e.textContent.includes("Intelligent Discovery"));
    const field = label => [...document.querySelectorAll(".rec-field")].find(f => f.querySelector("h4")?.textContent === label);
    const values = label => [...(field(label)?.querySelectorAll(":scope > ul > li") || [])].map(li => ({ value: li.querySelector(".rec-value")?.textContent || li.querySelector("input")?.value, basis: li.querySelector(".basis-tag")?.textContent, on: !li.classList.contains("off") }));
    return {
      status: pulse?.className.match(/ipulse-(complete|partial|failed|cancelled)/)?.[1],
      stages: [...(pulse?.querySelectorAll(".ipulse-stage") || [])].map(s => s.querySelector("strong")?.textContent + " · " + (s.querySelector("small")?.textContent || "")),
      activity: pulse?.querySelector(".ipulse-readout p")?.textContent,
      brand: values("Brand name")[0]?.value, industry: values("Industry")[0]?.value, model: values("Business model")[0]?.value,
      offerings: values("Products and services"), markets: values("Geographic markets"), segments: values("Customer segments"), subsectors: values("Industry subsectors"),
      competitors: [...document.querySelectorAll(".competitor-card")].map(c => ({ name: c.querySelector("header strong")?.textContent, kinds: [...c.querySelectorAll(".kind-chip")].map(k => k.textContent), on: c.classList.contains("on"), verified: !c.classList.contains("unverified"), confidence: c.querySelector(".conf")?.textContent })),
      keywords: document.querySelectorAll(".kw-table tbody tr").length, keywordTotal: document.querySelector(".kw-filters .filter-chip em")?.textContent,
      measuredCells: [...document.querySelectorAll(".kw-table tbody td")].filter(td => /^\d[\d,.]*$/.test(td.textContent.trim()) && td.cellIndex >= 5 && td.cellIndex <= 8).length,
      prompts: document.querySelectorAll(".prompt-group li").length, promptCategories: document.querySelectorAll(".prompt-group").length, sampled: document.querySelectorAll(".sample-chip").length,
      pages: document.querySelectorAll(".page-role li").length, roles: [...document.querySelectorAll(".page-role h4")].map(h => h.textContent),
      scope: document.querySelector(".discovery-actions span")?.textContent, charts: document.querySelectorAll('[aria-label="Discovery visual intelligence"] figure.vchart').length,
      gaps: [...document.querySelectorAll(".discovery .partial-banner li")].map(l => l.textContent),
    };
  });
  report.scenarios.push({ name, website, ...result });
  log("Discovery " + name, result.status + " · " + result.brand + " · " + result.industry + " · " + result.competitors.length + " competitors · " + result.keywords + " keywords shown · " + result.prompts + " prompts · " + result.charts + " charts");
  if (!["complete", "partial"].includes(result.status)) problem({ scenario: name, status: result.status, activity: result.activity });
  for (const [key, value] of Object.entries(expect)) {
    const ok = typeof value === "function" ? value(result) : result[key] === value;
    if (!ok) problem({ scenario: name, expectation: key, actual: typeof value === "function" ? undefined : result[key], result: { brand: result.brand, industry: result.industry, competitors: result.competitors, offerings: result.offerings.map(o => o.value) } });
  }
  await shot(name + "-results");
  return result;
}

// 1. Empty Studio: Intelligent Discovery is the default entry; only a website is provided.
await page.goto(base + "/#studio", { waitUntil: "networkidle" });
await page.getByRole("tab", { name: /Intelligent Discovery/ }).waitFor();
if (await page.getByRole("tab", { name: /Intelligent Discovery/ }).getAttribute("aria-selected") !== "true") problem({ step: "default entry mode is not Intelligent Discovery" });
await shot("01-discovery-entry");
const labmed = await discover("http://127.0.0.17:4810", "labmed", {
  brand: "LabMed Academy",
  industry: r => /Education/.test(r.industry || ""),
  competitors: r => r.competitors.some(c => c.name === "BioMed Skills" && c.on && c.kinds.some(k => /GEO/.test(k))),
  hallucination: r => !r.offerings.some(o => /Quantum/.test(o.value || "")),
  prompts: r => r.prompts >= 30 && r.prompts <= 50,
  promptCategories: r => r.promptCategories >= 9,
  charts: r => r.charts >= 6,
  measuredCells: 0,
  pages: r => r.pages >= 5,
});
// Client created automatically and named after the discovered brand.
await page.waitForTimeout(800);
const clientName = await page.locator(".studio-bar select").first().evaluate(s => s.options[s.selectedIndex]?.text).catch(() => null);
if (clientName !== "LabMed Academy") problem({ step: "auto-created client name", clientName });

// 2. Review and edit: exclude a competitor, add one manually, edit an offering, filter keywords, edit a prompt.
const northstar = page.locator(".competitor-card", { hasText: "Northstar" });
if (await northstar.count()) { const box = northstar.locator('header input[type="checkbox"]'); if (await box.isChecked()) await box.uncheck(); }
await page.getByLabel("Add a competitor website").fill("http://127.0.0.16:4810");
await page.getByRole("button", { name: "Verify and add" }).click();
await page.locator(".competitor-card", { hasText: "Ridgeline" }).waitFor({ timeout: 30000 });
log("Manual competitor verified", await page.locator(".competitor-card", { hasText: "Ridgeline" }).locator(".conf").textContent());
const firstOffering = page.locator(".rec-field", { hasText: "Products and services" }).locator("li").first();
await firstOffering.getByRole("button", { name: /^Edit / }).click();
await firstOffering.locator(".rec-edit input").fill("Histology training (5 months)");
await firstOffering.getByRole("button", { name: "Save" }).click();
await page.getByRole("button", { name: /^Transactional/ }).click();
const transactional = await page.locator(".kw-table tbody tr").count();
await page.getByRole("button", { name: /^Select shown/ }).click();
await page.getByRole("button", { name: /^All \d/ }).click();
await shot("10-review-edited");
log("Edits applied", "transactional keywords " + transactional);
// Accept all, then regenerate prompts only.
await page.getByRole("button", { name: "Accept all recommendations" }).click();
await page.locator(".regen-menu summary").click();
await page.getByRole("button", { name: "Prompts and AI answer samples" }).click();
await page.waitForFunction(() => { const el = [...document.querySelectorAll(".ipulse")].find(e => e.textContent.includes("Intelligent Discovery")); return el && /ipulse-(complete|partial)/.test(el.className); }, null, { timeout: 120000 });
log("Regenerated prompts", await discoveryPulse().locator(".ipulse-readout p").textContent());
// Light theme and responsive layouts of the review.
for (const [w, h, label] of [[1440, 900, "desktop"], [834, 1112, "tablet"], [390, 844, "mobile"]]) {
  for (const theme of ["dark", "light"]) {
    await page.evaluate(t => { localStorage.setItem("vista-appearance", t); document.documentElement.dataset.appearance = t; }, theme);
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) problem({ layout: label + " " + theme, horizontalOverflow: overflow });
    await shot("20-" + label + "-" + theme);
  }
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => { localStorage.setItem("vista-appearance", "dark"); document.documentElement.dataset.appearance = "dark"; });

// 3. Launch: accepted recommendations flow into the existing investigation pipeline.
await page.locator(".discovery-actions").getByRole("button", { name: "Launch investigation" }).click();
await page.locator(".ipulse", { hasText: "Website intelligence" }).waitFor({ timeout: 20000 });
await page.waitForFunction(() => document.querySelector(".ipulse-complete, .ipulse-partial, .ipulse-failed"), null, { timeout: 420000 });
const investigation = await page.evaluate(() => ({ status: document.querySelector(".ipulse")?.className.match(/ipulse-(complete|partial|failed)/)?.[1], stages: [...document.querySelectorAll(".ipulse-stage")].map(s => s.querySelector("strong")?.textContent + " · " + (s.querySelector("small")?.textContent || "")) }));
log("Investigation launched from discovery", investigation.status);
if (!["complete", "partial"].includes(investigation.status)) problem({ step: "launched investigation", investigation });
const competitiveStage = investigation.stages.find(s => /competitive/i.test(s)) || "";
if (!/2 of 2 competitors|of 2 competitors|competitors sampled/.test(competitiveStage)) problem({ step: "competitors reached the pipeline", competitiveStage });
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "GEO & AI search", exact: true }).click();
await page.waitForTimeout(1500);
const geoObservations = await page.evaluate(() => document.body.innerText.match(/(\d+) observations?/)?.[1]);
await shot("30-investigation-geo");
log("Discovery AI samples carried into the investigation", geoObservations);
report.investigation = { ...investigation, geoObservations };

// 4. Further discovery scenarios: ecommerce, professional services, JavaScript-heavy.
for (const [website, name, expect] of [
  ["http://127.0.0.11:4810", "ecommerce", { industry: r => /Retail/.test(r.industry || ""), model: r => /ecommerce/i.test(r.model || ""), competitors: r => r.competitors.some(c => c.name === "Ridgeline Supply" && c.on) && r.competitors.some(c => /Harbour/.test(c.name) && !c.on) && r.competitors.some(c => !c.verified && !c.on) }],
  ["http://127.0.0.12:4810", "professional-services", { industry: r => /Professional services/.test(r.industry || "") }],
  ["http://127.0.0.19:4810", "javascript-app", { scope: r => typeof r.scope === "string" }],
]) {
  await page.locator(".studio-bar").getByRole("button", { name: "New investigation" }).click().catch(() => {});
  await page.getByRole("tab", { name: /Intelligent Discovery/ }).click();
  await discover(website, name, expect);
}

// 5. VisTa BoT: conversational request starts Intelligent Discovery (no internet here: graceful failure expected).
await page.getByRole("button", { name: /VisTa BoT/ }).click();
await page.getByLabel("Ask about VisTa").fill("Please investigate labmedexpert.com for me");
await page.getByRole("button", { name: "Send question" }).click();
const action = page.getByRole("button", { name: /Start Intelligent Discovery for labmedexpert.com/ });
await action.waitFor({ timeout: 10000 });
await page.locator(".vb-panel").screenshot({ path: join(out, "40-bot-discovery.png") });
await action.click();
await page.waitForTimeout(1500);
const botStarted = await page.evaluate(() => ({ website: document.querySelector("#discovery-website")?.value, pulse: [...document.querySelectorAll(".ipulse")].some(e => e.textContent.includes("labmedexpert.com")) }));
log("BoT started discovery", JSON.stringify(botStarted));
if (!/labmedexpert\.com/.test(botStarted.website || "") || !botStarted.pulse) problem({ step: "BoT discovery start", botStarted });

writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 2));
console.log("problems", report.problems.length, "console errors", report.consoleErrors.length);
await browser.close();
process.exit(report.problems.length || report.consoleErrors.length ? 1 : 0);
