/**
 * PageSpeed Insights v5 adapter. Lighthouse lab data (a single simulated run) is kept
 * separate from Chrome UX Report field data (real-user 75th percentiles over 28 days).
 */
export type FieldMetric = { percentile: number; category: string };
export type PerformanceResult = {
  url: string;
  strategy: "mobile" | "desktop";
  collectedAt: string;
  lab: { score: number | null; lcpMs: number | null; cls: number | null; tbtMs: number | null; fcpMs: number | null; speedIndexMs: number | null; ttfbMs: number | null; requests: number | null; transferBytes: number | null; lighthouseVersion: string | null };
  field: { scope: "url" | "origin" | "none"; lcp: FieldMetric | null; inp: FieldMetric | null; cls: FieldMetric | null; overall: string | null };
  opportunities: { id: string; title: string; savingsMs: number; savingsBytes: number }[];
  renderBlocking: { url: string; wastedMs: number }[];
};

type Audit = { id?: string; title?: string; score?: number | null; numericValue?: number; details?: { type?: string; overallSavingsMs?: number; overallSavingsBytes?: number; items?: Record<string, unknown>[] }; metricSavings?: Record<string, number> };

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function field(metrics: Record<string, { percentile?: number; category?: string }> | undefined, key: string, scale = 1): FieldMetric | null {
  const metric = metrics?.[key];
  return metric && typeof metric.percentile === "number" ? { percentile: metric.percentile / scale, category: metric.category || "NONE" } : null;
}

export function parsePsi(data: Record<string, unknown>, url: string, strategy: "mobile" | "desktop"): PerformanceResult {
  const lighthouse = (data.lighthouseResult || {}) as { audits?: Record<string, Audit>; categories?: { performance?: { score?: number } }; lighthouseVersion?: string };
  const audits = lighthouse.audits || {};
  const value = (id: string) => num(audits[id]?.numericValue);
  const urlExperience = data.loadingExperience as { id?: string; metrics?: Record<string, { percentile?: number; category?: string }>; overall_category?: string; origin_fallback?: boolean } | undefined;
  const originExperience = data.originLoadingExperience as typeof urlExperience;
  const useUrl = urlExperience?.metrics && !urlExperience.origin_fallback;
  const experience = useUrl ? urlExperience : originExperience?.metrics ? originExperience : undefined;
  const requests = audits["network-requests"]?.details?.items;
  const opportunities = Object.entries(audits)
    .map(([id, audit]) => ({ id, title: audit.title || id, savingsMs: num(audit.details?.overallSavingsMs) ?? num(audit.metricSavings?.LCP) ?? 0, savingsBytes: num(audit.details?.overallSavingsBytes) ?? 0, score: audit.score }))
    .filter(item => item.score !== null && item.score !== undefined && item.score < 0.9 && (item.savingsMs > 0 || item.savingsBytes > 0))
    .sort((a, b) => b.savingsMs - a.savingsMs || b.savingsBytes - a.savingsBytes)
    .slice(0, 12)
    .map(({ id, title, savingsMs, savingsBytes }) => ({ id, title, savingsMs: Math.round(savingsMs), savingsBytes: Math.round(savingsBytes) }));
  const blocking = (audits["render-blocking-resources"] || audits["render-blocking-insight"])?.details?.items || [];
  return {
    url,
    strategy,
    collectedAt: new Date().toISOString(),
    lab: {
      score: num(lighthouse.categories?.performance?.score) === null ? null : Math.round((lighthouse.categories!.performance!.score as number) * 100),
      lcpMs: value("largest-contentful-paint"),
      cls: value("cumulative-layout-shift"),
      tbtMs: value("total-blocking-time"),
      fcpMs: value("first-contentful-paint"),
      speedIndexMs: value("speed-index"),
      ttfbMs: value("server-response-time"),
      requests: Array.isArray(requests) ? requests.length : null,
      transferBytes: Array.isArray(requests) ? requests.reduce((sum, item) => sum + (num(item.transferSize) ?? 0), 0) : null,
      lighthouseVersion: typeof lighthouse.lighthouseVersion === "string" ? lighthouse.lighthouseVersion : null,
    },
    field: {
      scope: !experience ? "none" : useUrl ? "url" : "origin",
      lcp: field(experience?.metrics, "LARGEST_CONTENTFUL_PAINT_MS"),
      inp: field(experience?.metrics, "INTERACTION_TO_NEXT_PAINT"),
      cls: field(experience?.metrics, "CUMULATIVE_LAYOUT_SHIFT_SCORE", 100),
      overall: experience?.overall_category || null,
    },
    opportunities,
    renderBlocking: blocking.slice(0, 10).map(item => ({ url: String(item.url || "").slice(0, 300), wastedMs: Math.round(num(item.wastedMs) ?? 0) })).filter(item => item.url),
  };
}

export async function runPageSpeed(url: string, strategy: "mobile" | "desktop", key = process.env.PAGESPEED_API_KEY, fetcher: typeof fetch = fetch): Promise<PerformanceResult> {
  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "performance");
  if (key) endpoint.searchParams.set("key", key);
  let response: Response;
  try { response = await fetcher(endpoint, { signal: AbortSignal.timeout(55000), cache: "no-store" }); }
  catch (error) {
    if ((error as Error).name === "TimeoutError" || /timeout|aborted/i.test((error as Error).message)) throw new Error("PageSpeed Insights did not finish within 55 seconds for this page; Lighthouse tests of large pages can take longer than the request limit. Retry later or test a lighter template.");
    throw error;
  }
  if (response.status === 429) throw new Error("PageSpeed Insights quota is exhausted. Configure PAGESPEED_API_KEY or retry later.");
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error("PageSpeed Insights could not test this URL" + (body?.error?.message ? ": " + body.error.message.slice(0, 200) : " (HTTP " + response.status + ")."));
  }
  return parsePsi(await response.json() as Record<string, unknown>, url, strategy);
}
