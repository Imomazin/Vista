/** robots.txt parsing and matching following RFC 9309 (longest match wins, Allow wins ties). */
export type RobotsRule = { allow: boolean; pattern: string };
export type RobotsGroup = { agents: string[]; rules: RobotsRule[]; crawlDelay?: number };
export type RobotsPolicy = {
  /** "found" when a robots.txt was parsed; "missing" for 4xx (everything allowed); "unavailable" for 5xx/network errors (treated as full disallow per RFC 9309). */
  state: "found" | "missing" | "unavailable";
  groups: RobotsGroup[];
  sitemaps: string[];
  bytes: number;
};

export function parseRobots(text: string): Omit<RobotsPolicy, "state"> {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of text.slice(0, 512_000).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === "sitemap") { if (value && sitemaps.length < 50) sitemaps.push(value); continue; }
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      if (field === "disallow" && value === "") continue; // An empty Disallow allows everything.
      current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) current.crawlDelay = delay;
    }
  }
  return { groups, sitemaps, bytes: text.length };
}

/** Choose the group for a user agent: the most specific product token match, otherwise "*". */
export function groupFor(policy: Pick<RobotsPolicy, "groups">, userAgent: string): RobotsGroup | null {
  const token = userAgent.toLowerCase().split("/")[0];
  const specific = policy.groups.filter(g => g.agents.some(a => a !== "*" && token.includes(a)));
  if (specific.length) return { agents: specific.flatMap(g => g.agents), rules: specific.flatMap(g => g.rules), crawlDelay: specific.find(g => g.crawlDelay !== undefined)?.crawlDelay };
  const star = policy.groups.filter(g => g.agents.includes("*"));
  if (star.length) return { agents: ["*"], rules: star.flatMap(g => g.rules), crawlDelay: star.find(g => g.crawlDelay !== undefined)?.crawlDelay };
  return null;
}

function patternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = new RegExp("^" + body.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""));
  return regex.test(path);
}

export function robotsDecision(policy: RobotsPolicy, url: string, userAgent: string): { allowed: boolean; rule: RobotsRule | null } {
  if (policy.state === "missing") return { allowed: true, rule: null };
  if (policy.state === "unavailable") return { allowed: false, rule: null };
  const target = new URL(url);
  if (target.pathname === "/robots.txt") return { allowed: true, rule: null };
  const path = target.pathname + target.search;
  const group = groupFor(policy, userAgent);
  if (!group) return { allowed: true, rule: null };
  let best: RobotsRule | null = null;
  for (const rule of group.rules) {
    if (!patternMatches(rule.pattern, path)) continue;
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow && !best.allow)) best = rule;
  }
  return { allowed: best ? best.allow : true, rule: best };
}
