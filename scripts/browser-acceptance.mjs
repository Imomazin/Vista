/**
 * Browser acceptance for VisTa photography: renders every primary view in both themes at
 * desktop, tablet and mobile sizes, records failed image requests, broken images and
 * horizontal overflow, exercises the engine gallery and saves screenshots.
 *
 * Usage: node scripts/browser-acceptance.mjs [baseUrl] [outDir] [browser]
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "acceptance";
const browserName = process.argv[4] ?? "chromium";
mkdirSync(out, { recursive: true });
// Playwright is provided by the test machine rather than the project dependencies.
const { chromium, firefox, webkit } = createRequire(import.meta.url)("playwright");

const routes = [
  ["entrance", ""], ["command", "#command"],
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => ["engine-" + n, "#engines/" + n]),
  ["investigation", "#investigation"], ["benchmark", "#benchmark"], ["audit", "#audit"], ["content", "#content"],
  ["workspace", "#workspace/projects"], ["pricing", "#pricing"], ["demo", "#demo"],
];
const viewports = { desktop: { width: 1440, height: 900 }, tablet: { width: 834, height: 1112 }, mobile: { width: 390, height: 844 } };
const themes = ["light", "dark"];

const launcher = { chromium, firefox, webkit }[browserName];
const browser = await launcher.launch();
const report = { base, browser: browserName, pages: [], gallery: [], problems: [] };

for (const theme of themes) for (const [vpName, viewport] of Object.entries(viewports)) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(t => { try { localStorage.setItem("vista-appearance", t); } catch {} }, theme);
  const page = await context.newPage();
  const failures = [];
  page.on("response", r => { if (r.request().resourceType() === "image" && r.status() >= 400) failures.push(r.status() + " " + r.url()); });
  page.on("requestfailed", r => { if (r.resourceType() === "image") failures.push("failed " + r.url()); });
  for (const [name, hash] of routes) {
    failures.length = 0;
    await page.goto(base + "/" + hash, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    // Scroll through the page so lazy photography loads.
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForLoadState("networkidle");
    const state = await page.evaluate(() => {
      const imgs = [...document.images].filter(i => i.getBoundingClientRect().width > 40 && !i.closest("[aria-hidden='true'].cinematic-photo-reel"));
      return {
        appearance: document.documentElement.dataset.appearance,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        images: imgs.length,
        broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src),
        photos: [...new Set(imgs.map(i => decodeURIComponent((i.currentSrc || i.src).replace(/.*url=([^&]+).*/, "$1"))).filter(s => s.includes("/web-images/premium/") || s.includes("/web-images/editorial/studio/")))],
        numbered: (document.body.innerText.match(/\b(Selected\s+)?(Visual|Image)\s*0\d\b/gi) || []),
      };
    });
    const entry = { theme, viewport: vpName, name, ...state, failedRequests: [...failures] };
    report.pages.push(entry);
    if (state.overflow > 1 || state.broken.length || failures.length || state.numbered.length || state.appearance !== theme)
      report.problems.push(entry);
    await page.screenshot({ path: join(out, `${name}-${vpName}-${theme}.png`), fullPage: vpName !== "desktop" ? false : name.startsWith("engine") || ["command", "pricing", "investigation", "workspace", "demo", "benchmark"].includes(name) });
  }
  // Gallery interaction on an engine with several photographs.
  if (vpName === "desktop") {
    await page.goto(base + "/#engines/9", { waitUntil: "networkidle" });
    const stage = () => page.locator(".story-stage-image img").first().getAttribute("src");
    const caption = () => page.locator(".story-image-caption").first().innerText();
    const first = await caption();
    const cards = page.locator(".story-gallery-card");
    await cards.nth(2).click();
    const afterClick = await caption();
    const pressed = await cards.nth(2).getAttribute("aria-pressed");
    await page.getByRole("button", { name: "Next photograph" }).click();
    const afterNext = await caption();
    await cards.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    const afterKey = await caption();
    const focusOutline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    report.gallery.push({ theme, first, afterClick, pressed, afterNext, afterKey, focusOutline, stageSrc: await stage(), cards: await cards.count() });
    if (first === afterClick || afterClick === afterNext || pressed !== "true" || afterKey === afterNext && afterKey === first)
      report.problems.push({ theme, gallery: "interaction failed" });
    await page.locator(".vista-engine-story").screenshot({ path: join(out, `engine-gallery-interaction-${theme}.png`) });
  }
  await context.close();
}
await browser.close();
writeFileSync(join(out, "report.json"), JSON.stringify(report, null, 1));
console.log(`pages ${report.pages.length}, problems ${report.problems.length}`);
for (const p of report.problems) console.log(JSON.stringify(p).slice(0, 400));
console.log(JSON.stringify(report.gallery));
