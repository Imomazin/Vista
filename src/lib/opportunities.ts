import type { Workspace } from "./workspace";

export type VistaOpportunity = {
  key: string;
  projectId: string;
  projectName: string;
  url: string;
  signalId: string;
  name: string;
  detail: string;
  recommendation: string;
  status: "issue" | "warning";
  priority: "Priority" | "Review";
  score: number;
  affectedPages: number;
  inspectedAt: string;
};

/**
 * Orders observable HTML findings by signal severity and recurrence.
 * This is a technical triage score, NOT predicted commercial impact,
 * search ranking, conversion probability or AI visibility.
 */
export function buildOpportunities(workspace: Workspace, projectId?: string): VistaOpportunity[] {
  const projectNames = new Map(workspace.projects.map(project => [project.id, project.name]));
  const newest = new Map<string, Workspace["snapshots"][number]>();
  for (const snapshot of workspace.snapshots) {
    if (!projectNames.has(snapshot.projectId) || (projectId && snapshot.projectId !== projectId)) continue;
    const key = JSON.stringify([snapshot.projectId, snapshot.report.url]);
    const older = newest.get(key);
    if (!older || Date.parse(snapshot.report.inspectedAt) > Date.parse(older.report.inspectedAt)) {
      newest.set(key, snapshot);
    }
  }
  const reports = [...newest.values()];
  const counts = new Map<string, number>();
  for (const snapshot of reports) {
    for (const signal of snapshot.report.signals) {
      if (signal.status === "pass") continue;
      const key = JSON.stringify([snapshot.projectId, signal.id]);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return reports.flatMap(snapshot => snapshot.report.signals.flatMap(signal => {
    if (signal.status === "pass") return [];
    const affectedPages = counts.get(JSON.stringify([snapshot.projectId, signal.id])) || 1;
    const score = Math.min(95, (signal.status === "issue" ? 76 : 46) + Math.min(19, (affectedPages - 1) * 5));
    return [{
      key: JSON.stringify([snapshot.projectId, snapshot.report.url, signal.id]),
      projectId: snapshot.projectId,
      projectName: projectNames.get(snapshot.projectId) || "Project",
      url: snapshot.report.url,
      signalId: signal.id,
      name: signal.name,
      detail: signal.detail,
      recommendation: signal.recommendation,
      status: signal.status,
      priority: signal.status === "issue" ? "Priority" as const : "Review" as const,
      score,
      affectedPages,
      inspectedAt: snapshot.report.inspectedAt,
    }];
  })).sort((a, b) => b.score - a.score || Date.parse(b.inspectedAt) - Date.parse(a.inspectedAt) || a.name.localeCompare(b.name));
}

export function latestProjectSnapshots(workspace: Workspace, projectId?: string) {
  const newest = new Map<string, Workspace["snapshots"][number]>();
  const existing = new Set(workspace.projects.map(project => project.id));
  for (const snapshot of workspace.snapshots) {
    if (!existing.has(snapshot.projectId) || (projectId && snapshot.projectId !== projectId)) continue;
    const key = JSON.stringify([snapshot.projectId, snapshot.report.url]);
    const old = newest.get(key);
    if (!old || Date.parse(snapshot.report.inspectedAt) > Date.parse(old.report.inspectedAt)) newest.set(key, snapshot);
  }
  return [...newest.values()].sort((a, b) => Date.parse(b.report.inspectedAt) - Date.parse(a.report.inspectedAt));
}

export function technicalTrend(workspace: Workspace, projectId: string, url: string) {
  return workspace.snapshots
    .filter(snapshot => snapshot.projectId === projectId && snapshot.report.url === url)
    .sort((a, b) => Date.parse(a.report.inspectedAt) - Date.parse(b.report.inspectedAt))
    .map(snapshot => ({ at: snapshot.report.inspectedAt, score: snapshot.report.technicalScore }));
}
