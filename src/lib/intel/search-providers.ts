/**
 * Licensed search data providers. Nothing here estimates: when no provider is configured the
 * caller receives `configured: false` and the dependency is reported instead of numbers.
 * - DataForSEO (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD): Google Ads search volume, CPC,
 *   competition and monthly trend; Labs keyword difficulty; live Google organic results.
 * - Brave Search API (BRAVE_SEARCH_API_KEY): live web results only (organic competitors, rankings).
 */
export type SearchProvider = "DataForSEO" | "Brave Search";
export type Metric = { keyword: string; volume?: number; cpc?: number; competition?: number; difficulty?: number; trend?: number[] };
export type SerpResult = { keyword: string; results: { url: string; position: number }[] };

export function searchConfig(env: Record<string, string | undefined> = process.env): { provider: SearchProvider | null; metrics: boolean } {
  if (env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD) return { provider: "DataForSEO", metrics: true };
  if (env.BRAVE_SEARCH_API_KEY) return { provider: "Brave Search", metrics: false };
  return { provider: null, metrics: false };
}

const braveCountry: Record<string, string> = { "United Kingdom": "GB", "United States": "US", Ireland: "IE", Canada: "CA", Australia: "AU", "New Zealand": "NZ", Nigeria: "NG", "South Africa": "ZA", India: "IN", Germany: "DE", France: "FR", Spain: "ES", Italy: "IT", Netherlands: "NL", "United Arab Emirates": "AE", Singapore: "SG" };

/** Provider-reported cost (USD) of DataForSEO requests made in this process, for the usage ledger. */
export const usage = { dataforseoUsd: 0, requests: 0 };
async function dataForSeo(path: string, body: unknown, env: Record<string, string | undefined>, fetcher: typeof fetch) {
  const auth = Buffer.from(env.DATAFORSEO_LOGIN + ":" + env.DATAFORSEO_PASSWORD).toString("base64");
  const response = await fetcher("https://api.dataforseo.com/v3/" + path, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(40000), headers: { Authorization: "Basic " + auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error("DataForSEO returned HTTP " + response.status + ".");
  const data = await response.json() as { status_code?: number; status_message?: string; cost?: number; tasks?: { status_code?: number; status_message?: string; result?: unknown[] }[] };
  usage.requests += 1;
  if (typeof data.cost === "number") usage.dataforseoUsd += data.cost;
  const task = data.tasks?.[0];
  if (data.status_code !== 20000 || !task || task.status_code !== 20000) throw new Error("DataForSEO: " + (task?.status_message || data.status_message || "request failed") + ".");
  return task.result || [];
}

export async function keywordMetrics(keywords: string[], market: string, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<Metric[]> {
  if (searchConfig(env).provider !== "DataForSEO" || !keywords.length) return [];
  const location = market || "United Kingdom";
  const volume = await dataForSeo("keywords_data/google_ads/search_volume/live", [{ keywords: keywords.slice(0, 100), location_name: location, language_name: "English" }], env, fetcher) as { keyword?: string; search_volume?: number | null; cpc?: number | null; competition_index?: number | null; monthly_searches?: { year: number; month: number; search_volume: number }[] | null }[];
  const out = new Map<string, Metric>();
  for (const row of volume) if (row.keyword) out.set(row.keyword, { keyword: row.keyword, ...(typeof row.search_volume === "number" ? { volume: row.search_volume } : {}), ...(typeof row.cpc === "number" ? { cpc: row.cpc } : {}), ...(typeof row.competition_index === "number" ? { competition: row.competition_index } : {}), ...(row.monthly_searches?.length ? { trend: [...row.monthly_searches].sort((a, b) => a.year - b.year || a.month - b.month).map(m => m.search_volume) } : {}) });
  try {
    const difficulty = await dataForSeo("dataforseo_labs/google/bulk_keyword_difficulty/live", [{ keywords: keywords.slice(0, 100), location_name: location, language_name: "English" }], env, fetcher) as { items?: { keyword?: string; keyword_difficulty?: number | null }[] }[];
    for (const item of difficulty[0]?.items || []) if (item.keyword && typeof item.keyword_difficulty === "number") out.set(item.keyword, { ...(out.get(item.keyword) || { keyword: item.keyword }), difficulty: item.keyword_difficulty });
  } catch { /* Difficulty is optional; volumes remain valid. */ }
  return [...out.values()];
}

export async function serpResults(keywords: string[], market: string, env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch): Promise<SerpResult[]> {
  const cfg = searchConfig(env);
  const out: SerpResult[] = [];
  for (const keyword of keywords.slice(0, 8)) {
    if (cfg.provider === "DataForSEO") {
      const result = await dataForSeo("serp/google/organic/live/advanced", [{ keyword, location_name: market || "United Kingdom", language_name: "English", depth: 10 }], env, fetcher) as { items?: { type?: string; rank_group?: number; url?: string }[] }[];
      out.push({ keyword, results: (result[0]?.items || []).filter(i => i.type === "organic" && i.url).slice(0, 10).map(i => ({ url: String(i.url), position: Number(i.rank_group) || 0 })) });
    } else if (cfg.provider === "Brave Search") {
      const url = "https://api.search.brave.com/res/v1/web/search?count=10&q=" + encodeURIComponent(keyword) + (braveCountry[market] ? "&country=" + braveCountry[market] : "");
      const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json", "X-Subscription-Token": String(env.BRAVE_SEARCH_API_KEY) } });
      if (!response.ok) throw new Error("Brave Search returned HTTP " + response.status + ".");
      const data = await response.json() as { web?: { results?: { url?: string }[] } };
      out.push({ keyword, results: (data.web?.results || []).filter(r => r.url).slice(0, 10).map((r, i) => ({ url: String(r.url), position: i + 1 })) });
    }
  }
  return out;
}
