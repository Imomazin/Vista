/**
 * Project evidence for VisTa BoT. Only VisTa-generated summaries and identifiers are included;
 * raw crawled page text, titles and AI responses are excluded so website content cannot inject
 * instructions into the assistant.
 */
import type { Analysis } from "./analysis";
import type { Investigation } from "./model";
import { signalProfile } from "./scoring";

const clean = (s: unknown, max = 220) => String(s ?? "").replace(/[\u0000-\u001F\u007F<>`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

export type BotAction = { label: string; hash: string; discover?: string; launch?: boolean };

/** "Investigate example.com", "audit https://…", "research competitors for …": a website to run Intelligent Discovery on. */
export function discoveryRequest(question: string): { website: string; host: string } | null {
  const intent = /\b(investigat\w*|audit\w*|analy[sz]\w*|discover\w*|research\w*|assess\w*|scan\w*|review\w*|profil\w*|benchmark\w*|look (at|into)|check out|evaluate\w*|study)\b/i;
  const match = question.match(/\b((?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?:\/[^\s]*)?/i);
  if (!match || !intent.test(question)) return null;
  const host = match[1].replace(/^https?:\/\//i, "").toLowerCase();
  if (/^(vista\.ambidexters\.com|localhost)$/.test(host) || !/\.[a-z]{2,}$/.test(host)) return null;
  return { website: "https://" + host + "/", host };
}
export type EvidenceContext = ReturnType<typeof evidenceContext>;

export function evidenceContext(inv: Investigation, a: Analysis, clientName: string) {
  return {
    client: clean(clientName, 80),
    website: clean(inv.brief.website, 120),
    investigatedAt: inv.updatedAt.slice(0, 10),
    mode: inv.brief.mode,
    assessment: inv.brief.assessment,
    pagesAnalysed: inv.pages.length,
    index: { value: a.index.index, range: a.index.range, coverage: Math.round(a.index.coverage * 100), note: clean(a.index.reason, 200) },
    dimensions: a.index.dimensions.map(d => ({ dimension: d.label, score: d.score, coverage: Math.round(d.coverage * 100), evidence: d.evidenceClass, basis: clean(d.basis, 140) })),
    findings: a.findings.slice(0, 14).map(f => ({ id: f.evidenceId, finding: clean(f.rule === "keyword-gaps" || f.rule === "duplicate-titles" ? f.rule.replace(/-/g, " ") + " (" + f.affectedCount + ")" : f.title, 120), severity: f.severity, engine: f.engine, evidenceClass: f.evidenceClass, implication: clean(f.implication, 180), recommendation: clean(f.recommendation, 180), metric: clean(f.metric, 120) })),
    interventions: a.interventions.slice(0, 8).map(i => ({ id: i.id, evidence: i.evidenceId, phase: i.phase, effortDays: i.effortDays, action: clean(i.action, 160) })),
    geo: { observations: a.geo.n, mentionRate: a.geo.n ? Math.round(a.geo.mentionRate.value * 100) : null, interval: a.geo.n ? [Math.round(a.geo.mentionRate.low * 100), Math.round(a.geo.mentionRate.high * 100)] : null, citationRate: a.geo.n ? Math.round(a.geo.citationRate.value * 100) : null, opportunities: a.opportunities.length, opportunityCategories: [...new Set(a.opportunities.map(o => o.category))] },
    competitors: inv.competitors.filter(c => c.pages.length).map(c => { const p = signalProfile(c.pages); return { name: clean(c.name, 60), pagesSampled: c.pages.length, medianWords: Math.round(p.words), schemaPct: Math.round(p.schema), geoReadiness: Math.round(p.readiness), trust: Math.round(p.trust) }; }),
    client_profile: (() => { const p = signalProfile(inv.pages); return { medianWords: Math.round(p.words), schemaPct: Math.round(p.schema), geoReadiness: Math.round(p.readiness), trust: Math.round(p.trust) }; })(),
    firstParty: { searchConsole: Boolean(inv.firstParty.gsc), ga4: Boolean(inv.firstParty.ga4) },
    unavailable: a.index.dimensions.filter(d => d.evidenceClass === "unavailable").map(d => clean(d.label + ": " + d.basis, 160)),
  };
}

/** Deterministic, evidence-only answers for common strategic questions (no AI required). */
export function answerFromEvidence(question: string, ctx: EvidenceContext): { text: string; actions: BotAction[] } | null {
  const q = question.toLowerCase();
  const top = ctx.findings.filter(f => f.severity === "critical" || f.severity === "high").slice(0, 3);
  const list = (items: string[]) => items.map(i => "• " + i).join("\n");
  if (/board|present|presentation|executive|deck|report/.test(q)) {
    return { text: "From the " + ctx.investigatedAt + " investigation of " + ctx.website + " (" + ctx.pagesAnalysed + " pages):\n" + (ctx.index.value !== null ? "Intelligence Index " + ctx.index.value + " (coverage " + ctx.index.coverage + "%).\n" : "No overall index is stated: " + ctx.index.note + "\n") + "Present these material findings:\n" + list(top.map(f => f.finding + " [" + f.id + "] — " + f.implication)) + "\nThen the roadmap: " + ctx.interventions.filter(i => i.phase === 30).length + " actions in the first 30 days.\nThe Executive Studio builds the board presentation from this evidence; review it before sharing.", actions: [{ label: "Open Executive Studio", hash: "#studio/executive" }, { label: "Review findings", hash: "#studio/findings" }] };
  }
  if (/fund|first|prioriti|priority|intervention|invest|budget/.test(q)) {
    return { text: "Highest-priority interventions (impact × urgency × confidence ÷ effort):\n" + list(ctx.interventions.slice(0, 5).map(i => i.action + " [" + i.evidence + "] · " + i.effortDays.join("–") + " days · " + i.phase + "-day phase")) + "\nCost ranges and dependencies are in the Decision Room.", actions: [{ label: "Open Decision Room", hash: "#studio/decisions" }] };
  }
  if (/competitor|outperform|rival|versus|vs\b/.test(q)) {
    if (!ctx.competitors.length) return { text: "No competitors were assessed in this investigation. Add competitor websites to the brief and re-run it.", actions: [{ label: "Edit the brief", hash: "#studio/brief" }] };
    const leader = [...ctx.competitors].sort((a, b) => b.geoReadiness + b.schemaPct - (a.geoReadiness + a.schemaPct))[0];
    return { text: "On equal page samples (indicative, not market share):\n" + list([ctx.client + ": median " + ctx.client_profile.medianWords + " words, schema " + ctx.client_profile.schemaPct + "%, GEO readiness " + ctx.client_profile.geoReadiness, ...ctx.competitors.map(c => c.name + ": median " + c.medianWords + " words, schema " + c.schemaPct + "%, GEO readiness " + c.geoReadiness)]) + "\nStrongest observable signals: " + leader.name + ". Rankings and traffic would need licensed data.", actions: [{ label: "Open competitor analysis", hash: "#studio/competitors" }] };
  }
  if (/\bai\b|chatgpt|gemini|perplexity|copilot|geo|generative|recommendation/.test(q)) {
    if (!ctx.geo.observations) return { text: "No AI answers have been sampled or recorded yet, so AI visibility cannot be assessed. Record verified observations or enable authorised API sampling in the GEO tab.", actions: [{ label: "Open GEO & AI search", hash: "#studio/geo" }] };
    return { text: "AI visibility from " + ctx.geo.observations + " observations: brand mentioned in " + ctx.geo.mentionRate + "% (95% interval " + ctx.geo.interval!.join("–") + "%), cited in " + ctx.geo.citationRate + "%.\n" + ctx.geo.opportunities + " prompts show competitors but not the brand" + (ctx.geo.opportunityCategories.length ? " (" + ctx.geo.opportunityCategories.join(", ") + ")" : "") + ".\nRelated findings:\n" + list(ctx.findings.filter(f => f.engine === 9 || f.engine === 5).slice(0, 3).map(f => f.finding + " [" + f.id + "]")) + "\nThese are plausible contributors, not proven causes; small samples are directional.", actions: [{ label: "Open the GEO Opportunity Map", hash: "#studio/geo" }] };
  }
  if (/declin|drop|fall|lost|organic|visibility/.test(q)) {
    return { text: (ctx.firstParty.searchConsole ? "Search Console data is connected; compare query and page trends in Search & analytics.\n" : "Search Console is not connected, so a decline cannot be measured or confirmed.\n") + "Technical factors observed in the crawl:\n" + list(ctx.findings.filter(f => f.engine === 3 || f.engine === 1).slice(0, 4).map(f => f.finding + " [" + f.id + "]")) + "\nUse the cross-engine investigation in the Decision Room to validate each hypothesis.", actions: [{ label: "Open cross-engine investigations", hash: "#studio/decisions" }, { label: "Search & analytics", hash: "#studio/search" }] };
  }
  if (/page|convert|conversion|revenue|commercial|lead/.test(q)) {
    return { text: ctx.firstParty.ga4 ? "GA4 channel outcomes are connected; landing-page outcomes need the GA4 landing page report (Measurements import or connected view)." : "Commercial outcomes by page require GA4 or CRM data, which is not connected for this investigation. VisTa does not estimate conversions without it.", actions: [{ label: "Search & analytics", hash: "#studio/search" }, { label: "Measurements", hash: "#measurements" }] };
  }
  return null;
}

export function validEvidence(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const text = JSON.stringify(value);
  return text.length <= 14000 ? text.replace(/[\u0000-\u001F]/g, " ") : null;
}
