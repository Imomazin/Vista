import {emptyWorkspace,parseWorkspace,type Workspace} from './workspace';
import {emptyEngineLedger,parseEngineLedger,type EngineLedger} from './engine-evidence';
import {emptyDecisionBook,parseDecisions,type DecisionBook} from './decisions';
import {emptyMeasurements,parseMeasurements,type MeasurementBook,measurementKey} from './measurements';
import {storageKey} from './workspace';
import {engineLedgerKey} from './engine-evidence';
import {decisionKey} from './decisions';
export type MigrationBundle={version:1;exportedAt:string;workspace:Workspace;evidence:EngineLedger;decisions:DecisionBook;draft:{draft:string;keyword:string}|null;measurements?:MeasurementBook};
export function parseBundle(raw:string):MigrationBundle{
 if(raw.length>3_000_000)throw Error('Combined transfer exceeds the 3 MB limit. Export individual registers to retain larger workspaces.');
 const b=JSON.parse(raw);if(!b||b.version!==1||!Number.isFinite(Date.parse(b.exportedAt)))throw Error('Invalid transfer package.');
 const workspace=parseWorkspace(JSON.stringify(b.workspace));const evidence=parseEngineLedger(JSON.stringify(b.evidence),workspace.projects.map(p=>p.id));
 const decisions=parseDecisions(JSON.stringify(b.decisions),evidence);
 if(b.draft!==null&&(!b.draft||typeof b.draft.draft!=='string'||typeof b.draft.keyword!=='string'||b.draft.draft.length>100000||b.draft.keyword.length>500))throw Error('Invalid content draft.');
 return {version:1,exportedAt:b.exportedAt,workspace,evidence,decisions,draft:b.draft,measurements:parseMeasurements(JSON.stringify(b.measurements||emptyMeasurements()),workspace.projects.map(p=>p.id))};
}
export function createBundle(raw:{workspace:string|null;evidence:string|null;decisions:string|null;draft:string|null;measurements?:string|null}):MigrationBundle{
 return parseBundle(JSON.stringify({version:1,exportedAt:new Date().toISOString(),workspace:raw.workspace?JSON.parse(raw.workspace):emptyWorkspace(),evidence:raw.evidence?JSON.parse(raw.evidence):emptyEngineLedger(),decisions:raw.decisions?JSON.parse(raw.decisions):emptyDecisionBook(),draft:raw.draft?JSON.parse(raw.draft):null,measurements:raw.measurements?JSON.parse(raw.measurements):emptyMeasurements()}));
}
export function bundleCounts(b:MigrationBundle){return {projects:b.workspace.projects.length,audits:b.workspace.snapshots.length,briefs:b.workspace.briefs.length,aiSamples:b.workspace.observations.length,actions:b.workspace.actionPlans?.length||0,evidence:b.evidence.records.length,decisions:b.decisions.records.length,drafts:b.draft?1:0,measurementReports:b.measurements?.datasets.length||0};}

export const restoreJournalKey='vista-restore-recovery';
const bundleKeys=[storageKey,engineLedgerKey,decisionKey,'vista-content-draft',measurementKey] as const;
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function browserSnapshot(store:Store){return JSON.stringify(Object.fromEntries(bundleKeys.map(key=>[key,store.getItem(key)])));}
export function restoreBundle(store:Store,bundle:MigrationBundle,expectedSnapshot:string){
 const safe=parseBundle(JSON.stringify(bundle));
 if(browserSnapshot(store)!==expectedSnapshot)throw Error('Browser data changed after inspection. Preview the restore again.');
 if(store.getItem(restoreJournalKey))throw Error('A previous restore recovery copy exists. Download and resolve it before restoring another package.');
 const before=JSON.parse(expectedSnapshot) as Record<string,string|null>;
 // Write recovery before touching any live register. A quota failure leaves the originals intact.
 store.setItem(restoreJournalKey,JSON.stringify({version:1,createdAt:new Date().toISOString(),before}));
 const after:Record<string,string|null>={[storageKey]:JSON.stringify(safe.workspace),[engineLedgerKey]:JSON.stringify(safe.evidence),[decisionKey]:JSON.stringify(safe.decisions),'vista-content-draft':safe.draft?JSON.stringify(safe.draft):null,[measurementKey]:JSON.stringify(safe.measurements||emptyMeasurements())};
 try{for(const key of bundleKeys){if(after[key]===null)store.removeItem(key);else store.setItem(key,after[key]!);}}
 catch{try{applyOriginals(store,before);}catch{throw Error('Restore interrupted and automatic rollback could not finish. The recovery copy is retained. Use Restore previous browser data before editing.');}throw Error('Restore failed. Previous browser data was restored; the recovery copy remains available.');}
}
function applyOriginals(store:Store,before:Record<string,string|null>){for(const key of bundleKeys){if(before[key]===null)store.removeItem(key);else store.setItem(key,before[key]!);}}
export function rollbackRestore(store:Store){const raw=store.getItem(restoreJournalKey);if(!raw)throw Error('No recovery copy exists.');const journal=JSON.parse(raw);if(journal.version!==1||!journal.before||bundleKeys.some(key=>journal.before[key]!==null&&typeof journal.before[key]!=='string'))throw Error('Recovery copy is invalid. Download it for manual recovery.');applyOriginals(store,journal.before);store.removeItem(restoreJournalKey);}
