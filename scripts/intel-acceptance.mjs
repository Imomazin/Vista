/**
 * End-to-end acceptance for the SEO & GEO Studio and Executive Studio against fixture websites
 * (scripts/intel-fixtures.mjs). Drives the real UI: create client → brief → crawl → findings →
 * GEO evidence → decisions → exports → track improvement, plus scenario runs.
 * Usage: node scripts/intel-acceptance.mjs [baseUrl] [outDir]
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "intel-acceptance";
mkdirSync(out, { recursive: true });
const { chromium } = createRequire(import.meta.url)("playwright");
const report = { steps: [], scenarios: [], downloads: [], problems: [], consoleErrors: [] };
const log = (step, detail = "") => { report.steps.push({ step, detail }); console.log("✓", step, detail); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await context.addInitScript(() => { try { if (!localStorage.getItem("vista-appearance")) localStorage.setItem("vista-appearance", "dark"); } catch {} });
const page = await context.newPage();
page.on("pageerror", e => report.consoleErrors.push(String(e)));
page.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource|401|503/.test(m.text())) report.consoleErrors.push(m.text().slice(0, 300)); });
page.on("dialog", d => d.accept());
const shot = (name, full = true) => page.screenshot({ path: join(out, name + ".png"), fullPage: full });
const settle = () => page.waitForTimeout(700);

async function createClient(name, website) {
  await page.getByLabel("Client name").fill(name);
  await page.getByLabel("Website", { exact: true }).fill(website);
  await page.getByRole("button", { name: "Create client" }).click();
  await settle();
}

async function fillBrief(o) {
  await page.getByLabel("Client website").fill(o.website);
  await page.getByLabel("Brand name").fill(o.brand);
  if (o.industry) await page.getByLabel("Industry").fill(o.industry);
  if (o.audience) await page.getByLabel("Target audience").fill(o.audience);
  if (o.offerings) await page.getByLabel("Primary products and services").fill(o.offerings);
  if (o.objectives) await page.getByLabel("Commercial objectives").fill(o.objectives);
  if (o.competitors) await page.getByLabel("Competitor websites").fill(o.competitors);
  if (o.keywords) await page.getByLabel("Target keywords").fill(o.keywords);
  if (o.prompts) await page.getByLabel("AI search prompts to monitor").fill(o.prompts);
  await page.getByRole("radio", { name: new RegExp(o.mode) }).check();
  await page.getByText("Crawl limits, sources and budget").click();
  // Outbound link checks need internet DNS, which this test container does not have.
  const outbound = page.getByLabel("Check outbound links");
  if (await outbound.isChecked()) await outbound.uncheck();
}

async function waitForJob(timeout = 300000) {
  await page.waitForFunction(() => document.querySelector(".ipulse-complete, .ipulse-failed, .ipulse-cancelled, .ipulse-paused"), null, { timeout });
  return page.evaluate(() => ({ status: document.querySelector(".ipulse")?.className.match(/ipulse-(complete|failed|cancelled|paused)/)?.[1], stages: [...document.querySelectorAll(".ipulse-stage")].map(s => s.className.replace("ipulse-stage stage-", "") + ": " + s.querySelector("strong")?.textContent), activity: document.querySelector(".ipulse-readout p")?.textContent, readout: document.querySelector(".ipulse-readout strong")?.textContent }));
}

// 1. Prospect journey: ecommerce client with a competitor.
await page.goto(base + "/#studio", { waitUntil: "networkidle" });
await page.getByText("Create your first client").waitFor();
await shot("01-studio-empty");
await createClient("Summit Outfitters", "https://summit-outfitters.example");
log("Client created");
await fillBrief({ website: "http://127.0.0.11:4810", brand: "Summit Outfitters", industry: "outdoor equipment", audience: "UK hikers", offerings: "hiking boots, tents", objectives: "Grow online sales by 20%", competitors: "http://127.0.0.16:4810", keywords: "hiking boots, tents, waterproof jackets", prompts: "Which UK shop is best for hiking boots?", mode: "Deep Intelligence" });
await shot("02-brief");
await page.getByRole("button", { name: "Start intelligence investigation" }).click();
await page.waitForSelector(".ipulse-running", { timeout: 20000 });
await page.waitForTimeout(1200);
await page.locator(".ipulse").screenshot({ path: join(out, "03-pulse-running.png") });
const percents = [];
for (let i = 0; i < 6; i++) { percents.push(await page.locator(".ipulse-readout strong").textContent()); await page.waitForTimeout(400); }
const job = await waitForJob();
log("Ecommerce investigation finished", JSON.stringify({ status: job.status, readings: percents }));
if (job.status !== "complete") report.problems.push({ step: "ecommerce job", job });
await page.locator(".ipulse").screenshot({ path: join(out, "04-pulse-complete.png") });
await shot("05-cockpit");

const tabs = ["Technical SEO", "Content", "Authority & trust", "Competitors", "GEO & AI search", "Search & analytics", "Findings", "Decision Room", "Executive Studio", "Portfolio"];
for (const [i, tab] of tabs.entries()) {
  await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: tab, exact: true }).click();
  await page.waitForTimeout(1500);
  await shot(String(6 + i).padStart(2, "0") + "-" + tab.toLowerCase().replace(/[^a-z]+/g, "-"));
  const broken = await page.evaluate(() => ({ svgs: document.querySelectorAll(".vchart-canvas svg").length, charts: document.querySelectorAll(".vchart").length, overflow: document.documentElement.scrollWidth - innerWidth }));
  log("Tab " + tab, JSON.stringify(broken));
  if (broken.overflow > 1) report.problems.push({ tab, overflow: broken.overflow });
  if (broken.charts !== broken.svgs && tab !== "Executive Studio") report.problems.push({ tab, charts: broken.charts, rendered: broken.svgs });
}

// Drill-down: page profile from the Technical tab.
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "Technical SEO", exact: true }).click();
await page.locator(".studio-table .link-button").first().click();
await page.getByRole("dialog", { name: /Page profile/ }).waitFor();
await shot("20-page-profile", false);
await page.keyboard.press("Escape");
log("Page profile drill-down");
// Chart table alternative and full screen.
await page.locator(".vchart").first().getByRole("button", { name: "Show data table" }).click();
await page.locator(".vchart-table").first().waitFor();
await page.locator(".vchart").first().getByRole("button", { name: "Show chart" }).click();
await page.locator(".vchart").first().getByRole("button", { name: "Full screen" }).click();
await page.waitForTimeout(800); await shot("21-chart-fullscreen", false);
await page.keyboard.press("Escape");
const [svgDownload] = await Promise.all([page.waitForEvent("download"), page.locator(".vchart").first().getByRole("button", { name: "Download SVG" }).click()]);
await svgDownload.saveAs(join(out, "chart-" + svgDownload.suggestedFilename())); report.downloads.push(svgDownload.suggestedFilename());
const [pngDownload] = await Promise.all([page.waitForEvent("download"), page.locator(".vchart").first().getByRole("button", { name: "Download PNG" }).click()]);
await pngDownload.saveAs(join(out, "chart-" + pngDownload.suggestedFilename())); report.downloads.push(pngDownload.suggestedFilename());
log("Chart table, full screen and exports");

// Findings: expand and open the ten-question dossier.
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "Findings", exact: true }).click();
await page.locator(".finding-head").first().click();
await page.getByRole("tab", { name: "Ten-question investigation" }).first().click();
await page.waitForTimeout(400); await page.locator(".finding-card.open").first().screenshot({ path: join(out, "22-finding-dossier.png") });
await page.getByLabel("Severity").selectOption("high");
log("Findings filter and dossier", await page.locator(".filter-bar > span").textContent());

// GEO: two verified manual observations.
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "GEO & AI search", exact: true }).click();
for (const [provider, response] of [["Perplexity", "For hiking boots in the UK, popular choices include:\n1. Ridgeline Supply — wide range of trail boots\n2. Mountain Warehouse\n3. Cotswold Outdoor"], ["Google AI Overviews", "Summit Outfitters is a UK retailer of hiking boots and tents. Customers mention fast delivery."]]) {
  await page.getByLabel("Provider").selectOption(provider);
  await page.getByLabel("Full response (pasted)").fill(response);
  await page.getByLabel("Cited source URLs").fill(provider === "Perplexity" ? "https://www.ridgeline.example/boots\nhttps://www.which.co.uk/reviews/walking-boots" : "http://127.0.0.11:4810/");
  await page.getByRole("button", { name: "Save observation" }).click();
  await page.waitForTimeout(600);
}
await page.waitForTimeout(1200);
await shot("23-geo-observations");
log("GEO observations recorded", await page.locator(".opportunity-map li").count() + " opportunity map entries");

// Decision Room: approve an intervention and assign an owner.
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "Decision Room", exact: true }).click();
await page.locator(".decision-buttons button", { hasText: "Approve" }).first().click();
await page.locator(".interventions input").first().fill("Head of Digital");
await page.waitForTimeout(800); await shot("24-decision-room");
log("Decision recorded");

// Executive Studio exports (board presentation).
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "Executive Studio", exact: true }).click();
await page.getByLabel("Report").selectOption("board");
await page.waitForTimeout(2500);
await shot("25-executive-preview");
for (const label of ["PowerPoint (.pptx)", "Presentation PDF", "A4 analytical PDF", "Excel workbook", "JSON", "Chart pack"]) {
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 180000 }), page.locator(".export-grid button", { hasText: label }).first().click()]);
  const file = join(out, download.suggestedFilename());
  await download.saveAs(file);
  report.downloads.push(download.suggestedFilename());
  log("Export " + label, download.suggestedFilename());
  await page.waitForTimeout(500);
}
for (const which of ["CSV Findings", "CSV Page inventory"]) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: which, exact: true }).click()]);
  await download.saveAs(join(out, download.suggestedFilename())); report.downloads.push(download.suggestedFilename());
}
await page.locator(".ipulse").screenshot({ path: join(out, "26-export-pulse.png") });

// Track improvement: re-run with the same brief.
await page.getByRole("navigation", { name: "Studio sections" }).getByRole("button", { name: "Cockpit", exact: true }).click();
await page.getByRole("button", { name: "Re-run to track improvement" }).click();
const rerun = await waitForJob();
await page.waitForTimeout(1500);
await shot("27-cockpit-rerun");
log("Re-run for improvement tracking", rerun.status + " · waterfall " + (await page.getByText("Improvement since the previous investigation").count()));

// Command Centre cockpit and engine dashboards.
await page.goto(base + "/#command", { waitUntil: "networkidle" }); await page.waitForTimeout(2500);
await page.locator(".command-cockpit").screenshot({ path: join(out, "28-command-cockpit.png") });
for (let e = 1; e <= 9; e++) {
  await page.goto(base + "/#engines/" + e, { waitUntil: "networkidle" }); await page.waitForTimeout(1800);
  const dash = page.locator(".engine-dashboard");
  await dash.scrollIntoViewIfNeeded();
  await dash.screenshot({ path: join(out, "29-engine-" + e + ".png") });
}
log("Command cockpit and nine engine dashboards");

// VisTa BoT: evidence-grounded answer with an in-app action.
await page.goto(base + "/#studio/cockpit", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /VisTa BoT/ }).last().click();
await page.getByRole("button", { name: "What findings should I present to the board?" }).click();
await page.locator(".vb-message.assistant").last().waitFor();
const answer = await page.locator(".vb-message.assistant").last().textContent();
await page.locator(".vb-panel").screenshot({ path: join(out, "33-bot-evidence.png") });
if (!/EV-/.test(answer || "")) report.problems.push({ bot: "answer lacks evidence identifiers", answer: (answer || "").slice(0, 200) });
await page.locator(".vb-message.assistant").last().getByRole("button", { name: "Open Executive Studio" }).click();
await page.waitForTimeout(800);
if (!page.url().includes("#studio/executive")) report.problems.push({ bot: "action did not navigate", url: page.url() });
log("VisTa BoT evidence answer and action", (answer || "").slice(0, 80));

// 2. Scenarios.
async function scenario(name, website, mode, extra = {}) {
  await page.goto(base + "/#studio/portfolio", { waitUntil: "networkidle" });
  await createClient(name, "https://" + name.toLowerCase().replace(/[^a-z]+/g, "-") + ".example");
  await page.locator(".studio-bar select").first().selectOption({ label: name }); await settle();
  await page.getByRole("button", { name: "New investigation" }).click();
  await fillBrief({ website, brand: name, mode, ...extra });
  await page.getByRole("button", { name: "Start intelligence investigation" }).click();
  if (extra.cancelAfter) {
    await page.waitForFunction(n => { const s = document.querySelector(".stage-active small")?.textContent || ""; const m = s.match(/(\d+) of/); return m && Number(m[1]) >= n; }, extra.cancelAfter, { timeout: 120000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    const cancelled = await waitForJob();
    await page.locator(".ipulse").screenshot({ path: join(out, "30-cancelled.png") });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(".ipulse");
    const resumeVisible = await page.getByRole("button", { name: "Resume" }).isVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    const resumed = await waitForJob();
    report.scenarios.push({ name, cancelled: cancelled.status, resumeVisible, resumed: resumed.status, stages: resumed.stages });
    log("Scenario " + name, cancelled.status + " → reload → resume → " + resumed.status);
    return;
  }
  const result = await waitForJob();
  await page.waitForTimeout(1000);
  const summary = await page.evaluate(() => ({ metrics: [...document.querySelectorAll(".cockpit-metrics .ismetric")].map(m => m.textContent), errors: [...document.querySelectorAll(".ipulse-errors li")].map(l => l.textContent).slice(0, 4) }));
  await shot("31-" + name.toLowerCase().replace(/[^a-z]+/g, "-"));
  report.scenarios.push({ name, ...result, ...summary });
  log("Scenario " + name, result.status + " · " + result.activity);
}
await scenario("Harbour Advisory", "http://127.0.0.12:4810", "Quick Scan", { keywords: "strategy consulting, risk advisory", industry: "professional services" });
await scenario("Northstar Learning", "http://127.0.0.13:4810", "Quick Scan", { keywords: "leadership training, project management course", industry: "corporate training" });
await scenario("Members Club", "http://127.0.0.15:4810", "Quick Scan");
await scenario("Meridian Group", "http://127.0.0.14:4810", "Enterprise Investigation", { cancelAfter: 12 });

// Portfolio after scenarios.
await page.goto(base + "/#studio/portfolio", { waitUntil: "networkidle" }); await page.waitForTimeout(2000);
await shot("32-portfolio");

// Light theme spot checks.
await page.evaluate(() => { localStorage.setItem("vista-appearance", "light"); });
for (const [hash, name] of [["#studio/cockpit", "40-light-cockpit"], ["#studio/technical", "41-light-technical"], ["#studio/geo", "42-light-geo"], ["#studio/decisions", "43-light-decisions"], ["#studio/executive", "44-light-executive"]]) {
  await page.goto(base + "/" + hash, { waitUntil: "networkidle" }); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(2200);
  if (await page.evaluate(() => document.documentElement.dataset.appearance) !== "light") report.problems.push({ theme: "light not applied", hash });
  await shot(name);
}
// Tablet and mobile checks in the same context (the investigation data lives in this browser).
for (const [width, height, label] of [[834, 1112, "tablet"], [390, 844, "mobile"]]) {
  await page.setViewportSize({ width, height });
  for (const [hash, name] of [["#studio/cockpit", "cockpit"], ["#studio/technical", "technical"], ["#studio/geo", "geo"], ["#studio/decisions", "decisions"], ["#studio/executive", "executive"], ["#studio/brief", "brief"]]) {
    await page.goto(base + "/" + hash, { waitUntil: "networkidle" }); await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 1) report.problems.push({ viewport: label, hash, overflow });
    await shot("5" + (label === "tablet" ? "0" : "1") + "-" + label + "-" + name);
  }
}
await browser.close();
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
console.log("problems", report.problems.length, "console errors", report.consoleErrors.length);
for (const p of report.problems) console.log(JSON.stringify(p).slice(0, 300));
for (const e of report.consoleErrors.slice(0, 10)) console.log("console:", e);
if (report.problems.length) process.exitCode = 1;
