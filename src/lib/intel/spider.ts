/**
 * VisTa Spider worker: scheduled recrawling from the persistent queue (database/spider.sql) into the
 * server-side VisTa Index (database/index.sql). Invoked by Vercel Cron with CRON_SECRET; any number of
 * invocations can run in parallel because jobs are leased with FOR UPDATE SKIP LOCKED. Uses the
 * server-only service role; inactive until the owner applies the migrations and sets the secrets.
 */
import { timingSafeEqual } from "node:crypto";
import { CloudError, cloudConfig, provider } from "../cloud";
import { crawlPage } from "./crawl";
import { observe } from "./observations";

export const serviceKey = (env: Record<string, string | undefined> = process.env) => env.VISTA_SUPABASE_SERVICE_ROLE_KEY || env.VISTA_JOB_WORKER_KEY || "";
export function spiderConfigured(env: Record<string, string | undefined> = process.env): boolean {
  let cloud = false;
  try { cloud = Boolean(cloudConfig()); } catch { cloud = false; }
  return cloud && Boolean(serviceKey(env)) && Boolean(env.CRON_SECRET && env.CRON_SECRET.length >= 32);
}

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". */
export function cronAuthorised(request: Request, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env.CRON_SECRET;
  if (!secret || secret.length < 32) return false;
  const supplied = Buffer.from(request.headers.get("authorization") || ""), expected = Buffer.from("Bearer " + secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

type Job = { id: number; url: string; host: string; render: boolean; lease_token: string };
type Call = typeof provider;
export type SpiderRun = { scheduled: number; claimed: number; done: number; failed: number; lost: number; observations: number };

export async function runSpider(opts: { batch?: number; budgetMs?: number; call?: Call; crawl?: typeof crawlPage } = {}): Promise<SpiderRun> {
  const call = opts.call || provider, crawl = opts.crawl || crawlPage;
  const token = serviceKey();
  if (!token) throw new CloudError("The VisTa Spider worker is not configured.", 503);
  const started = Date.now(), budget = opts.budgetMs ?? 50_000;
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) => call(path, { method: "POST", headers, body: JSON.stringify(body) }, token);
  const scheduled = Number(await post("/rest/v1/rpc/vista_spider_schedule", {})) || 0;
  const jobs = ((await post("/rest/v1/rpc/vista_spider_claim", { batch: opts.batch ?? 4 })) || []) as Job[];
  const run: SpiderRun = { scheduled, claimed: jobs.length, done: 0, failed: 0, lost: 0, observations: 0 };
  for (const job of jobs) {
    let failure: string | null = null;
    if (Date.now() - started > budget) failure = "Worker time budget reached; the job will be retried.";
    else {
      const r = await crawl(job.url, 1, [], Date.now() + 25_000, { render: job.render });
      if (r.page) {
        const o = observe(r.page, "vista");
        await post("/rest/v1/vista_index_pages?on_conflict=key", { key: o.key, host: job.host, last_seen: o.observedAt }, { Prefer: "resolution=merge-duplicates" });
        await post("/rest/v1/vista_index_observations?on_conflict=key,observed_at,source", {
          key: o.key, observed_at: o.observedAt, source: "vista", status: o.status, title: o.title.slice(0, 300), description: o.description.slice(0, 500), h1: o.h1, headings: o.headings,
          words: o.words, text_hash: o.textHash, signature: o.signature, internal_links: o.internalLinks, external_links: o.externalLinks, schema_types: o.schemaTypes,
          canonical: o.canonical, indexable: o.indexable, links_out: { external: r.page.links.external.slice(0, 200).map(l => l.url) },
        }, { Prefer: "resolution=ignore-duplicates" });
        run.observations += 1;
      } else failure = (r.failure?.message || "The page could not be crawled.").slice(0, 300);
    }
    const accepted = await post("/rest/v1/rpc/vista_spider_finish", { job: job.id, fence: job.lease_token, failure });
    if (!accepted) run.lost += 1; else if (failure) run.failed += 1; else run.done += 1;
  }
  return run;
}
