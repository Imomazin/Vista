"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3,
  Check, ChevronRight, CircleAlert, Clock3, Compass, FileCheck2,
  Globe2, Layers3, LockKeyhole, Radar, ScanSearch, Search,
  ShieldCheck, Sparkles, Target, WandSparkles
} from "lucide-react";
import { engines, pillars } from "@/lib/engines";
import type { AuditReport } from "@/lib/audit";

const glyphs = [
  Search, Target, ScanSearch, WandSparkles, ShieldCheck,
  Radar, Layers3, BarChart3, Sparkles
];

function Mark() {
  return (
    <div className="mark" aria-label="VISTA">
      <div className="mark-symbol" aria-hidden="true"><span>V</span></div>
      <div><div className="mark-word">VISTA<span className="mark-dot">.</span></div><div className="mark-caption">BY AMBIDEXTERS</div></div>
    </div>
  );
}

export default function Home() {
  const [address, setAddress] = useState("https://ambidexters.com");
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"overview" | "engines">("overview");
  const issues = useMemo(
    () => report?.signals.filter((signal) => signal.status !== "pass") || [],
    [report]
  );

  async function runAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: address })
      });
      const payload: AuditReport | { error: string } = await response.json();
      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "The scan could not be completed.");
      }
      setReport(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The scan could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Mark />
        <p className="side-label">WORKSPACE</p>
        <nav className="side-nav" aria-label="Primary navigation">
          <button className={view === "overview" ? "nav-item selected" : "nav-item"} onClick={() => setView("overview")}><Compass size={18} /> Overview <ChevronRight size={15} className="nav-chevron" /></button>
          <button className={view === "engines" ? "nav-item selected" : "nav-item"} onClick={() => setView("engines")}><Layers3 size={18} /> Intelligence engines <ChevronRight size={15} className="nav-chevron" /></button>
        </nav>
        <p className="side-label side-label-second">FIVE PILLARS</p>
        <div className="pillar-list">
          {pillars.map((pillar) => (
            <div className="pillar-row" key={pillar.letter}>
              <span className="pillar-letter">{pillar.letter}</span>
              <span>{pillar.name}</span>
            </div>
          ))}
        </div>
        <div className="side-bottom">
          <div className="side-orb"><Sparkles size={18} /></div>
          <p className="side-bottom-head">Built for the next era</p>
          <p>Marketing intelligence that connects discovery with measurable impact.</p>
          <div className="side-product-status"><span className="status-light" /> Foundation release</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">VISTA <span>/</span> {view === "overview" ? "Overview" : "Intelligence engines"}</div>
          <div className="topbar-right"><span className="small-lock"><LockKeyhole size={13} /> Public beta foundation</span><span className="avatar">AX</span></div>
        </header>

        {view === "overview" ? (
          <>
            <section className="hero">
              <div className="hero-grain" aria-hidden="true" />
              <div className="hero-content">
                <span className="hero-eyebrow"><span className="eyebrow-star">✳</span> INTRODUCING VISTA INTELLIGENCE</span>
                <h1>Marketing Superior<br />Intelligence. <em>Reimagined.</em></h1>
                <p>Visibility, authority and growth, connected by superior intelligence. One platform built around nine specialised engines.</p>
                <a className="hero-link" href="#audit">Explore site intelligence <ArrowUpRight size={17} /></a>
              </div>
              <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="hero-art-core">V</div><span className="orbit-point orbit-point-a" /><span className="orbit-point orbit-point-b" /><span className="orbit-point orbit-point-c" /></div>
            </section>

            <div className="summary-strip">
              <div><p>INTELLIGENCE ENGINES</p><strong>09</strong><span>Across every marketing layer</span></div>
              <div><p>STRATEGIC PILLARS</p><strong>05</strong><span>One connected ecosystem</span></div>
              <div><p>LIVE CAPABILITIES</p><strong>01</strong><span>Website audit, first release</span></div>
              <div className="summary-status"><span className="summary-status-icon"><Activity size={20} /></span><div><p>DEVELOPMENT STATUS</p><strong className="summary-status-text">Foundation</strong><span>Expanding in stages</span></div></div>
            </div>

            <section className="section" id="audit">
              <div className="section-heading"><div><span className="section-overline">VISTA SITE INTELLIGENCE</span><h2>See beyond the surface.</h2><p>Inspect a public website and reveal structural signals that affect technical search readiness.</p></div><span className="section-pill"><span className="status-light" /> Engine 03 · Live</span></div>
              <form className="audit-form" onSubmit={runAudit}>
                <label htmlFor="website">Website address</label>
                <div className="audit-input-row">
                  <div className="input-wrap"><Globe2 size={20} /><input id="website" type="url" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="https://yourwebsite.com" autoComplete="url" /></div>
                  <button type="submit" disabled={busy} className="primary-button">{busy ? "Analysing..." : "Run site audit"} {busy ? <span className="loading-dot" /> : <ArrowRight size={17} />}</button>
                </div>
                <p className="form-hint"><ShieldCheck size={14} /> Public HTTPS webpages only. No account or credentials needed.</p>
              </form>

              {error && <div className="message error-message" role="alert"><CircleAlert size={18} /><span>{error}</span></div>}
              {report && (
                <div className="results" aria-live="polite">
                  <div className="result-top"><div><span className="section-overline">LATEST AUDIT</span><h3>{new URL(report.url).hostname}</h3><p><Clock3 size={14} /> {new Date(report.inspectedAt).toLocaleString("en-GB")} · HTML analysis</p></div><div className="score-card"><strong>{report.technicalScore}<small>/100</small></strong><span>HTML signal score</span></div></div>
                  <div className="site-details"><div><span>PAGE TITLE</span><p>{report.title || "Not found"}</p></div><div><span>H1 HEADINGS</span><p>{report.headingOneCount}</p></div><div><span>SCHEMA BLOCKS</span><p>{report.structuredDataBlocks}</p></div><div><span>IMAGES WITHOUT ALT</span><p>{report.imagesMissingAlt}</p></div></div>
                  <div className="result-columns">
                    <div className="signal-column"><h4>Technical signals <span>{report.signals.length} checked</span></h4>{report.signals.map((signal) => <div className="signal-row" key={signal.id}><span className={"signal-mark " + signal.status}>{signal.status === "pass" ? <Check size={14} /> : <CircleAlert size={14} />}</span><div><strong>{signal.name}</strong><small>{signal.detail}</small></div></div>)}</div>
                    <div className="action-column"><h4>Priority actions <span>{issues.length} identified</span></h4>{issues.length ? issues.map((signal, index) => <div className="action-row" key={signal.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{signal.name}</strong><p>{signal.recommendation}</p></div></div>) : <div className="clear-state"><FileCheck2 size={28} /><p>No issues flagged by this limited HTML check.</p></div>}</div>
                  </div>
                  <div className="limitations"><CircleAlert size={16}/><p>{report.limitations.join(" ")}</p></div>
                </div>
              )}
              {!report && !busy && !error && <div className="empty-panel"><div className="empty-symbol"><ScanSearch size={28} /></div><div><h3>Your next insight starts here.</h3><p>Run a live audit to examine page titles, indexing directives, canonical links, headings, structured data and more.</p></div><span className="empty-tag">9 signals</span></div>}
            </section>

            <section className="section engines-section" id="engines">
              <div className="section-heading"><div><span className="section-overline">THE INTELLIGENCE ECOSYSTEM</span><h2>Nine engines. One vision.</h2><p>Purpose-built capabilities working together across the marketing value chain.</p></div><button className="text-button" onClick={() => setView("engines")}>View all engines <ArrowUpRight size={17}/></button></div>
              <EngineCards />
            </section>
          </>
        ) : (
          <section className="section engines-full">
            <span className="section-overline">THE VISTA ARCHITECTURE</span>
            <h1>Nine engines.<br /><span>One intelligence ecosystem.</span></h1>
            <p>Each engine is designed to solve a distinct problem. Together, they connect digital discovery, authority, commercial performance and scalable execution.</p>
            <EngineCards />
            <div className="build-notice"><Sparkles size={19}/><span>The Site Intelligence audit is available now. The other eight engines are on the development roadmap.</span><button onClick={() => setView("overview")}>Return to audit <ArrowRight size={15}/></button></div>
          </section>
        )}

        <footer><span>© 2026 AMBIDEXTERS · VISTA</span><span>MARKETING SUPERIOR INTELLIGENCE. REIMAGINED.</span></footer>
      </main>
    </div>
  );
}

function EngineCards() {
  return <div className="engine-grid">{engines.map((engine, index) => {
    const Glyph = glyphs[index];
    return <article className="engine-card" key={engine.id}>
      <div className="engine-card-top"><div className="engine-icon"><Glyph size={20} strokeWidth={1.6}/></div><span className="engine-id">{String(engine.id).padStart(2, "0")}</span></div>
      <h3>{engine.name}</h3>
      <p>{engine.description}</p>
      <div className="engine-card-bottom"><span className={"engine-status " + engine.status}><span className="status-light"/>{engine.status === "live" ? "Available now" : "On roadmap"}</span><span className="engine-pillar">PILLAR {engine.pillar}</span></div>
    </article>;
  })}</div>;
}
