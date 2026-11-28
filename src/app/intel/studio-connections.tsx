'use client';
import { useCallback, useEffect, useState } from 'react';

type Status = { available: { google: boolean }; connections: { provider: string; account: string | null; property: string | null; connected_at: string }[] };
type Row = { key: string; clicks: number; impressions: number; ctr: number; position: number };
type Report = { source: string; account: string | null; property: string; period: { startDate: string; endDate: string }; observedAt: string; queries: Row[]; pages: Row[]; note: string };

/** Organisation Google connection (R1): connect, choose a Search Console property, read measured data, disconnect. */
export default function GoogleConnection({ organisationId, canManage }: { organisationId: string | null; canManage: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [properties, setProperties] = useState<{ property: string; permission: string }[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState(() => { try { const m = /connection=(\w+)/.exec(location.hash)?.[1]; return m === 'connected' ? 'Google connected.' : m === 'declined' ? 'The Google connection was declined.' : m === 'failed' ? 'The Google connection could not be completed. Try again.' : ''; } catch { return ''; } });
  const load = useCallback(() => { fetch('/api/connections/status' + (organisationId ? '?organisationId=' + organisationId : ''), { cache: 'no-store' }).then(r => r.json()).then(setStatus).catch(() => setStatus(null)); }, [organisationId]);
  useEffect(() => { load(); }, [load]);
  const post = async (path: string, body: Record<string, unknown>) => { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organisationId, ...body }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed'); return d; };
  const google = status?.connections.find(c => c.provider === 'google');
  if (!status) return null;
  if (!status.available.google) return <section className="studio-section dependency-card"><h3>Organisation Google connection</h3><p>Connecting each organisation&apos;s own Search Console and GA4 (read-only, OAuth with PKCE, encrypted refresh tokens) is built but not yet configured on this deployment. The owner completes the Google setup in <code>docs/provider-setup.md</code>: an OAuth web client with the redirect URI <code>https://vista.ambidexters.com/api/connections/google/callback</code>, the encryption key and the <code>database/connections.sql</code> migration.</p></section>;
  if (!organisationId) return <section className="studio-section dependency-card"><h3>Organisation Google connection</h3><p>Sign in to an organisation to connect its Search Console and GA4.</p></section>;
  return <section className="studio-section" aria-label="Organisation Google connection"><div className="discovery-head"><h3>Organisation Google connection</h3><p className="section-note">Read-only access to this organisation&apos;s Search Console. Values are measured by Google and shown exactly as Google defines them.</p></div>
    {message && <p className="lex-coverage" role="status">{message}</p>}
    {!google ? (canManage ? <button className="ghost-button" onClick={async () => { try { const d = await post('/api/connections/google/start', {}); location.href = d.url; } catch (e) { setMessage((e as Error).message); } }}>Connect Google</button> : <p className="rec-note">An owner or editor can connect Google.</p>)
      : <div className="pulse-schedule"><span>Connected{google.account ? ' as ' + google.account : ''}{google.property ? ' · ' + google.property : ''}</span>
        <button className="ghost-button" onClick={async () => { try { const d = await post('/api/connections/google/gsc', {}); if (d.properties) setProperties(d.properties); else setReport(d); } catch (e) { setMessage((e as Error).message); } }}>{google.property ? 'Load Search Console data' : 'Choose a property'}</button>
        {canManage && <button className="link-button" onClick={async () => { try { const d = await post('/api/connections/google/revoke', {}); setMessage(d.revokedAtGoogle ? 'Disconnected and revoked at Google.' : 'Disconnected.'); setReport(null); load(); } catch (e) { setMessage((e as Error).message); } }}>Disconnect</button>}</div>}
    {properties && <ul className="graph-list">{properties.map(p => <li key={p.property}><button className="link-button" onClick={async () => { try { setReport(await post('/api/connections/google/gsc', { property: p.property })); setProperties(null); load(); } catch (e) { setMessage((e as Error).message); } }}>{p.property}</button><small>{p.permission}</small></li>)}</ul>}
    {report && <><p className="lex-coverage"><strong>Measured</strong> · {report.source} · {report.property} · {report.period.startDate} to {report.period.endDate}. {report.note}</p>
      <div className="table-scroll"><table className="studio-table"><thead><tr><th scope="col">Query</th><th scope="col">Clicks</th><th scope="col">Impressions</th><th scope="col">CTR</th><th scope="col">Average position</th></tr></thead><tbody>{report.queries.slice(0, 25).map(r => <tr key={r.key}><th scope="row">{r.key}</th><td>{r.clicks}</td><td>{r.impressions}</td><td>{(r.ctr * 100).toFixed(1)}%</td><td>{r.position}</td></tr>)}</tbody></table></div></>}
  </section>;
}
