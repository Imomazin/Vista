import { NextResponse } from "next/server";
import { resourcePolicy } from "@/lib/intel/http";
import { renderConfig } from "@/lib/intel/render";

export const dynamic = "force-dynamic";

/** What this deployment can do, so the brief only offers capabilities that exist. */
export async function GET() {
  const policy = resourcePolicy();
  const mb = (n: number) => Math.round(n / 1048576);
  return NextResponse.json({
    render: Boolean(renderConfig()),
    pagespeedKey: Boolean(process.env.PAGESPEED_API_KEY),
    policy: { maxHtmlMb: mb(policy.maxHtmlBytes), maxTransferMb: mb(policy.maxTransferBytes), maxDecodedMb: mb(policy.maxDecodedBytes), timeoutMs: policy.timeoutMs, retries: policy.retries },
  }, { headers: { "Cache-Control": "no-store" } });
}
