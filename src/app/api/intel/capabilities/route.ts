import { NextResponse } from "next/server";
import { resourcePolicy } from "@/lib/intel/http";
import { renderAvailable } from "@/lib/intel/render";
import { aiAvailable, aiConfig } from "@/lib/intel/discovery-ai";
import { searchConfig } from "@/lib/intel/search-providers";
import { spiderConfigured } from "@/lib/intel/spider";

export const dynamic = "force-dynamic";

/** What this deployment can do, so the brief only offers capabilities that exist. */
export async function GET() {
  const policy = resourcePolicy();
  const mb = (n: number) => Math.round(n / 1048576);
  return NextResponse.json({
    render: renderAvailable(),
    pagespeedKey: Boolean(process.env.PAGESPEED_API_KEY),
    discoveryAi: aiAvailable() ? aiConfig().mode : "off",
    search: searchConfig().provider,
    spider: spiderConfigured(),
    policy: { maxHtmlMb: mb(policy.maxHtmlBytes), maxTransferMb: mb(policy.maxTransferBytes), maxDecodedMb: mb(policy.maxDecodedBytes), timeoutMs: policy.timeoutMs, retries: policy.retries },
  }, { headers: { "Cache-Control": "no-store" } });
}
