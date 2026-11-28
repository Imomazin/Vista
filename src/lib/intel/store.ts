/**
 * Browser persistence for investigations (IndexedDB), local-first like the VisTa workspace.
 * Investigation metadata and page records are stored separately so large crawls checkpoint
 * incrementally (only new pages are written after each batch) instead of rewriting everything.
 */
import type { Investigation } from "./model";
import type { PageRecord } from "./page";

const dbName = "vista-intelligence";
const metaStore = "investigations";
const pageStore = "pages";
let memory: Map<string, Investigation> | null = null;
/** How many pages of each investigation are already persisted (and the first page, to detect reordering). */
const persisted = new Map<string, { count: number; first: string }>();

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(dbName, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(metaStore)) db.createObjectStore(metaStore, { keyPath: "id" }).createIndex("projectId", "projectId");
        if (!db.objectStoreNames.contains(pageStore)) db.createObjectStore(pageStore, { keyPath: ["inv", "i"] }).createIndex("inv", "inv");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

export function storageMode(): "indexeddb" | "memory" { return memory ? "memory" : "indexeddb"; }

const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
const result = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });

export async function saveInvestigation(inv: Investigation): Promise<void> {
  const db = await open();
  if (!db) { memory ||= new Map(); memory.set(inv.id, { ...inv, updatedAt: new Date().toISOString() }); notify(inv.id); return; }
  const meta = { ...inv, pages: [] as PageRecord[], pageCount: inv.pages.length, updatedAt: new Date().toISOString() };
  const known = persisted.get(inv.id);
  const first = inv.pages[0]?.finalUrl || "";
  const rewrite = !known || known.count > inv.pages.length || known.first !== first;
  const tx = db.transaction([metaStore, pageStore], "readwrite");
  tx.objectStore(metaStore).put(JSON.parse(JSON.stringify(meta)));
  const pages = tx.objectStore(pageStore);
  if (rewrite) pages.delete(IDBKeyRange.bound([inv.id, 0], [inv.id, Number.MAX_SAFE_INTEGER]));
  for (let i = rewrite ? 0 : known!.count; i < inv.pages.length; i += 1) pages.put({ inv: inv.id, i, page: inv.pages[i] });
  await done(tx);
  db.close();
  persisted.set(inv.id, { count: inv.pages.length, first });
  notify(inv.id);
}

function notify(id: string) { if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vista-intel-update", { detail: id })); }

async function loadPages(db: IDBDatabase, meta: Investigation & { pageCount?: number }): Promise<Investigation> {
  if (meta.pages?.length) { persisted.delete(meta.id); return meta; } // Version 1 record with inline pages.
  const tx = db.transaction(pageStore, "readonly");
  const rows = await result(tx.objectStore(pageStore).index("inv").getAll(IDBKeyRange.only(meta.id)) as IDBRequest<{ i: number; page: PageRecord }[]>);
  rows.sort((a, b) => a.i - b.i);
  const pages = rows.map(r => r.page);
  persisted.set(meta.id, { count: pages.length, first: pages[0]?.finalUrl || "" });
  return { ...meta, pages };
}

/** Investigation summaries (metadata with `pageCount`, without page records) unless `withPages` is set. */
export async function listInvestigations(projectId?: string, withPages = false): Promise<Investigation[]> {
  const db = await open();
  if (!db) return [...(memory?.values() || [])].filter(i => !projectId || i.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const metas = await result(db.transaction(metaStore, "readonly").objectStore(metaStore).getAll() as IDBRequest<(Investigation & { pageCount?: number })[]>);
  const chosen = metas.filter(i => !projectId || i.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(m => ({ ...m, pageCount: m.pageCount ?? m.pages?.length ?? 0 }));
  const out = withPages ? await Promise.all(chosen.map(m => loadPages(db, m))) : chosen;
  db.close();
  return out;
}

export async function getInvestigation(id: string): Promise<Investigation | null> {
  const db = await open();
  if (!db) return memory?.get(id) ?? null;
  const meta = await result(db.transaction(metaStore, "readonly").objectStore(metaStore).get(id) as IDBRequest<Investigation | undefined>);
  const full = meta ? await loadPages(db, meta) : null;
  db.close();
  return full;
}

export async function deleteInvestigation(id: string): Promise<void> {
  const db = await open();
  if (db) {
    const tx = db.transaction([metaStore, pageStore], "readwrite");
    tx.objectStore(metaStore).delete(id);
    tx.objectStore(pageStore).delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    await done(tx);
    db.close();
  }
  memory?.delete(id);
  persisted.delete(id);
  notify(id);
}

/** Load the latest investigation with page evidence for each project (full records). */
export async function latestPerProject(projectIds?: string[]): Promise<Investigation[]> {
  const summaries = await listInvestigations();
  const seen = new Set<string>();
  const picks = summaries.filter(s => (s.pageCount ?? s.pages.length) > 0 && (!projectIds || projectIds.includes(s.projectId)) && !seen.has(s.projectId) && seen.add(s.projectId));
  return (await Promise.all(picks.map(p => getInvestigation(p.id)))).filter((i): i is Investigation => !!i);
}
