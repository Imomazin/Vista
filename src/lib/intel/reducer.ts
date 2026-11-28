/**
 * Streaming HTML reducer. Large pages are dominated by inline scripts, styles, SVG paths,
 * comments and base64 data URIs that carry no SEO evidence. The reducer removes those bodies
 * while streaming (keeping the tags, so script sources and counts remain observable), keeps
 * JSON-LD structured data intact, and retains at most `maxRetained` characters.
 */
export type ReductionStats = { inlineScriptBytes: number; strippedBytes: number; jsonLdBytes: number; dataUris: number; truncated: boolean };

const STRIP = new Set(["script", "style", "svg", "template"]);
const MAX_PENDING = 256 * 1024;
const MAX_JSONLD = 1_000_000;

function tagEnd(s: string, from: number): number {
  let quote = "";
  for (let i = from; i < s.length; i += 1) {
    const c = s[i];
    if (quote) { if (c === quote) quote = ""; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}

export class HtmlReducer {
  private out: string[] = [];
  private size = 0;
  private pending = "";
  private mode: { tag: string; keep: boolean; kept: number } | null = null;
  readonly stats: ReductionStats = { inlineScriptBytes: 0, strippedBytes: 0, jsonLdBytes: 0, dataUris: 0, truncated: false };

  constructor(private readonly maxRetained: number) {}

  private emit(text: string) {
    if (!text || this.stats.truncated) return;
    if (this.size + text.length > this.maxRetained) {
      this.out.push(text.slice(0, this.maxRetained - this.size));
      this.size = this.maxRetained;
      this.stats.truncated = true;
      return;
    }
    this.out.push(text);
    this.size += text.length;
  }

  private inside(text: string) {
    const mode = this.mode!;
    if (mode.keep && mode.kept + text.length <= MAX_JSONLD) { this.emit(text); mode.kept += text.length; this.stats.jsonLdBytes += text.length; return; }
    if (mode.tag === "script") this.stats.inlineScriptBytes += text.length;
    this.stats.strippedBytes += text.length;
  }

  feed(chunk: string) {
    const s = this.pending + chunk;
    const lower = s.toLowerCase();
    this.pending = "";
    let i = 0;
    while (i < s.length) {
      if (this.mode) {
        const close = this.mode.tag === "!--" ? "-->" : "</" + this.mode.tag;
        const j = lower.indexOf(close, i);
        if (j < 0) {
          const safe = Math.max(i, s.length - close.length);
          this.inside(s.slice(i, safe));
          this.pending = s.slice(safe);
          return;
        }
        this.inside(s.slice(i, j));
        if (this.mode.tag === "!--") { i = j + 3; this.mode = null; continue; }
        const end = s.indexOf(">", j);
        if (end < 0) { this.pending = s.slice(j); return; }
        this.emit(s.slice(j, end + 1));
        this.mode = null;
        i = end + 1;
        continue;
      }
      const lt = s.indexOf("<", i);
      if (lt < 0) { this.emit(s.slice(i)); return; }
      this.emit(s.slice(i, lt));
      if (s.startsWith("<!--", lt)) { this.mode = { tag: "!--", keep: false, kept: 0 }; i = lt + 4; continue; }
      if (s.length - lt < 4 && !s.slice(lt).includes(">")) { this.pending = s.slice(lt); return; }
      const gt = tagEnd(s, lt + 1);
      if (gt < 0) {
        if (s.length - lt > MAX_PENDING) { this.emit("&lt;"); i = lt + 1; continue; }
        this.pending = s.slice(lt);
        return;
      }
      let tag = s.slice(lt, gt + 1);
      if (tag.includes("data:")) tag = tag.replace(/(=\s*)(["'])data:[^"']{48,}\2/gi, (_m, eq: string, q: string) => { this.stats.dataUris += 1; return eq + q + "data:," + q; });
      const name = /^<\s*([a-zA-Z][a-zA-Z0-9-]*)/.exec(tag)?.[1]?.toLowerCase();
      this.emit(tag);
      i = gt + 1;
      if (name && STRIP.has(name) && !/\/\s*>$/.test(tag)) {
        const keep = name === "script" && /type\s*=\s*["']?application\/ld\+json/i.test(tag);
        this.mode = { tag: name, keep, kept: 0 };
      }
    }
  }

  finish(): { html: string; stats: ReductionStats } {
    if (this.pending) { if (this.mode) this.inside(this.pending); else this.emit(this.pending); this.pending = ""; }
    return { html: this.out.join(""), stats: this.stats };
  }
}

/** Reduce a complete HTML string (used for rendered HTML and tests). */
export function reduceHtml(html: string, maxRetained = 10_000_000) {
  const reducer = new HtmlReducer(maxRetained);
  for (let i = 0; i < html.length; i += 65536) reducer.feed(html.slice(i, i + 65536));
  return reducer.finish();
}
