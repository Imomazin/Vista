/**
 * JavaScript rendering. VisTa Spider renders in-platform with open-source Playwright and Chromium
 * (render-local.ts). An optional external browser endpoint (Browserless-compatible `/content`
 * contract) is used instead when VISTA_RENDER_ENDPOINT is configured. Targets are validated first.
 */
import { testOrigins, validatePublicUrl } from "./http";
import { reduceHtml } from "./reducer";
import { localRenderAvailable, renderLocally } from "./render-local";
import { requestLimit } from "../rate-limit";

export type RenderConfig = { endpoint: string; token: string | undefined };

export function renderConfig(env: Record<string, string | undefined> = process.env): RenderConfig | null {
  const raw = env.VISTA_RENDER_ENDPOINT;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = env.VERCEL !== "1" && testOrigins(env).size > 0;
    if (url.protocol !== "https:" && !local) return null;
    if (url.username || url.password) return null;
    return { endpoint: url.href, token: env.VISTA_RENDER_TOKEN };
  } catch { return null; }
}

/** Rendering is available through a configured remote endpoint or VisTa Spider's in-platform renderer. */
export function renderAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(renderConfig(env)) || localRenderAvailable(env);
}

/** Deployment-wide daily rendering budget (VISTA_RENDER_DAILY, default 300 pages) to bound compute. */
export async function renderAllowance(): Promise<boolean> {
  const budget = Math.max(0, Math.floor(Number(process.env.VISTA_RENDER_DAILY) || 300));
  const r = await requestLimit(new Request("https://vista.internal/", { headers: { "x-real-ip": "deployment" } }), "render-deployment", budget, 86400);
  return r.allowed;
}

export async function renderPage(target: string, maxHtmlBytes: number, timeoutMs = 25000, config = renderConfig(), fetcher: typeof fetch = fetch): Promise<{ html: string; truncated: boolean; bytes: number }> {
  if (!config) {
    if (!localRenderAvailable()) throw new Error("JavaScript rendering is not configured for this deployment.");
    return renderLocally(target, maxHtmlBytes, timeoutMs);
  }
  const url = validatePublicUrl(target).href;
  const response = await fetcher(config.endpoint, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(timeoutMs), headers: { "Content-Type": "application/json", ...(config.token ? { Authorization: "Bearer " + config.token } : {}) }, body: JSON.stringify({ url, gotoOptions: { waitUntil: "networkidle2", timeout: timeoutMs - 3000 }, rejectResourceTypes: ["image", "media", "font"] }) });
  if (!response.ok) throw new Error("The rendering service returned HTTP " + response.status + ".");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The rendering service returned no content.");
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 30 * 1024 * 1024) { await reader.cancel(); throw new Error("The rendered document exceeds 30 MB."); }
    parts.push(decoder.decode(value, { stream: true }));
  }
  parts.push(decoder.decode());
  const reduced = reduceHtml(parts.join(""), maxHtmlBytes);
  return { html: reduced.html, truncated: reduced.stats.truncated, bytes };
}
