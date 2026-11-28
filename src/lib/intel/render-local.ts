/**
 * VisTa Spider: in-platform JavaScript rendering with open-source Playwright and Chromium
 * (on Vercel, the open-source @sparticuz/chromium build). No external rendering service.
 *
 * Safeguards: the target is validated and resolved as public before launch; every browser request
 * (documents, scripts, XHR) passes the same public-address check (cached per host); WebSockets,
 * service workers, downloads, images, media and fonts are blocked; at most 120 requests and a
 * bounded time per page. Rendering runs only for pages the crawler already fetched with robots.txt
 * respected and found to depend on JavaScript.
 */
import { crawlerUserAgent, FetchFailure, resolvePublic, testOrigins, validatePublicUrl } from "./http";
import { reduceHtml } from "./reducer";

export type LocalRender = { html: string; truncated: boolean; bytes: number; requests: number; blocked: number };

/** Whether this deployment can render in-platform (Vercel's runtime or a local Chromium), unless switched off. */
export function localRenderAvailable(env: Record<string, string | undefined> = process.env): boolean {
  if (env.VISTA_RENDER_LOCAL === "off") return false;
  return env.VERCEL === "1" || Boolean(env.VISTA_CHROMIUM_PATH);
}

async function launch(env: Record<string, string | undefined> = process.env) {
  const { chromium } = await import("playwright-core");
  if (env.VERCEL === "1") {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    return chromium.launch({ executablePath: await sparticuz.executablePath(), args: sparticuz.args, headless: true });
  }
  return chromium.launch({ executablePath: env.VISTA_CHROMIUM_PATH, headless: true, args: ["--no-sandbox"] });
}

export async function renderLocally(target: string, maxHtmlBytes: number, timeoutMs = 25000): Promise<LocalRender> {
  const started = Date.now();
  const url = validatePublicUrl(target);
  await resolvePublic(url, Math.min(4000, timeoutMs));
  const allowed = new Map<string, Promise<boolean>>();
  const tests = testOrigins();
  const permitted = (raw: string) => {
    let u: URL;
    try { u = new URL(raw); } catch { return Promise.resolve(false); }
    if (u.protocol === "data:" || u.protocol === "blob:") return Promise.resolve(true);
    if (tests.has(u.origin)) return Promise.resolve(true);
    const key = u.protocol + "//" + u.host;
    if (!allowed.has(key)) allowed.set(key, (async () => { try { validatePublicUrl(u.href); await resolvePublic(u, 3000); return true; } catch { return false; } })());
    return allowed.get(key)!;
  };
  let requests = 0, blocked = 0;
  const browser = await launch();
  try {
    const context = await browser.newContext({ userAgent: crawlerUserAgent + " (rendering)", acceptDownloads: false, serviceWorkers: "block", viewport: { width: 1280, height: 900 }, javaScriptEnabled: true });
    await context.routeWebSocket(/.*/, ws => ws.close());
    await context.route("**/*", async route => {
      const req = route.request();
      if (["image", "media", "font"].includes(req.resourceType())) return route.abort();
      requests += 1;
      if (requests > 120 || !(await permitted(req.url()))) { blocked += 1; return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    const remaining = () => Math.max(1000, timeoutMs - (Date.now() - started) - 1500);
    const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: remaining() });
    if (!response) throw new FetchFailure("connection", "The rendered page did not load.");
    await page.waitForLoadState("networkidle", { timeout: Math.min(8000, remaining()) }).catch(() => { /* long-polling pages never go idle; the DOM so far is used */ });
    const html = await page.content();
    const bytes = Buffer.byteLength(html);
    const reduced = reduceHtml(html, maxHtmlBytes);
    return { html: reduced.html, truncated: reduced.stats.truncated, bytes, requests, blocked };
  } finally {
    await browser.close().catch(() => {});
  }
}
