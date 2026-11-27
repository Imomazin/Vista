/**
 * Browser persistence for investigations (IndexedDB). Investigations stay on the user's
 * device, consistent with VisTa's local-first workspace; nothing is shared between tenants.
 */
import type { Investigation } from "./model";

const dbName = "vista-intelligence";
const storeName = "investigations";
let memory: Map<string, Investigation> | null = null;

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: "id" }).createIndex("projectId", "projectId"); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
}

export function storageMode(): "indexeddb" | "memory" { return memory ? "memory" : "indexeddb"; }

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open();
  if (!db) { memory ||= new Map(); return null; }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveInvestigation(inv: Investigation): Promise<void> {
  const copy: Investigation = JSON.parse(JSON.stringify({ ...inv, updatedAt: new Date().toISOString() }));
  const result = await withStore("readwrite", s => s.put(copy));
  if (result === null && memory) memory.set(copy.id, copy);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vista-intel-update", { detail: copy.id }));
}

export async function listInvestigations(projectId?: string): Promise<Investigation[]> {
  const all = (await withStore("readonly", s => s.getAll() as IDBRequest<Investigation[]>)) ?? [...(memory?.values() || [])];
  return all.filter(i => !projectId || i.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getInvestigation(id: string): Promise<Investigation | null> {
  const result = await withStore("readonly", s => s.get(id) as IDBRequest<Investigation | undefined>);
  return result ?? memory?.get(id) ?? null;
}

export async function deleteInvestigation(id: string): Promise<void> {
  await withStore("readwrite", s => s.delete(id));
  memory?.delete(id);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("vista-intel-update", { detail: id }));
}
