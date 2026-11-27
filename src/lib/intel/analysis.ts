/** One derived view of an investigation, shared by dashboards, reports and VisTa BoT. */
import { buildFindings } from "./findings";
import { geoMetrics, opportunityMap } from "./geo";
import type { Investigation } from "./model";
import { defaultWeights, intelligenceIndex, type DimensionId } from "./scoring";
import { analyseSite } from "./site";
import { buildInterventions, roadmap, upsideScenarios } from "./strategy";

export function computeAnalysis(inv: Investigation) {
  const brand = [inv.brief.brand, ...inv.brief.aliases].filter(Boolean);
  const site = analyseSite(inv.discovery, inv.pages, inv.failures, inv.links, brand);
  const collectedAt = inv.discovery?.collectedAt || inv.createdAt;
  const findings = buildFindings(inv.projectId, inv.brief, inv.discovery, inv.pages, site, inv.performance, inv.competitors, inv.firstParty, collectedAt);
  const weights = { ...defaultWeights, ...(inv.settings?.weights || {}) } as Record<DimensionId, number>;
  const index = intelligenceIndex(inv, site, findings, weights);
  const interventions = buildInterventions(findings, inv.brief, inv.settings?.owners || {}, { dayRate: inv.settings?.dayRate ?? 650, currency: inv.settings?.currency || "GBP" }, new Date(inv.updatedAt || Date.now()));
  return {
    site, findings, index, interventions,
    phases: roadmap(interventions),
    geo: geoMetrics(inv.observations, inv.brief),
    opportunities: opportunityMap(inv.observations),
    upside: upsideScenarios(inv.firstParty, inv.settings?.valuePerClick ?? null),
  };
}
export type Analysis = ReturnType<typeof computeAnalysis>;
