export type Engine = {
  id: number;
  name: string;
  pillar: "V" | "I" | "S" | "T" | "A";
  description: string;
  status: "live" | "planned";
};

export const engines: Engine[] = [
  { id: 1, pillar: "V", name: "Search Visibility", description: "Organic rankings, discoverability and competitive intelligence.", status: "planned" },
  { id: 2, pillar: "I", name: "Impact Intelligence", description: "Conversions, qualified leads and revenue attribution.", status: "planned" },
  { id: 3, pillar: "S", name: "Site Intelligence", description: "Live technical website audits, structure and indexing signals.", status: "live" },
  { id: 4, pillar: "S", name: "Content Studio", description: "Editorial planning, optimisation and publishing.", status: "planned" },
  { id: 5, pillar: "T", name: "Authority Graph", description: "Brand entities, verifiable identity and authoritative sources.", status: "planned" },
  { id: 6, pillar: "T", name: "Reputation Intelligence", description: "Earned coverage, digital PR and brand reputation.", status: "planned" },
  { id: 7, pillar: "A", name: "Agency Operations", description: "Multi-client workspaces and white-label reporting.", status: "planned" },
  { id: 8, pillar: "A", name: "Analytics Intelligence", description: "First-party search, traffic and performance measurement.", status: "planned" },
  { id: 9, pillar: "A", name: "AI Exposure", description: "Sampled AI citations, recommendations and GEO monitoring.", status: "planned" },
];

export const pillars = [
  { letter: "V", name: "Visibility" },
  { letter: "I", name: "Impact Intelligence" },
  { letter: "S", name: "Search & Site Optimisation" },
  { letter: "T", name: "Trust & Authority" },
  { letter: "A", name: "Agencies, Analytics & AI Exposure" },
] as const;
