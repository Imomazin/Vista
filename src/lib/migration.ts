import {emptyWorkspace,parseWorkspace,type Workspace} from './workspace';
import {emptyEngineLedger,parseEngineLedger,type EngineLedger} from './engine-evidence';
import {emptyDecisionBook,parseDecisions,type DecisionBook} from './decisions';
export type MigrationBundle={version:1;exportedAt:string;workspace:Workspace;evidence:EngineLedger;decisions:DecisionBook;draft:{draft:string;keyword:string}|null};
export function parseBundle(raw:string):MigrationBundle{
 if(raw.length>3_000_000)throw Error('Combined transfer exceeds the 3 MB limit. Export individual registers to retain larger workspaces.');
 const b=JSON.parse(raw);if(!b||b.version!==1||!Number.isFinite(Date.parse(b.exportedAt)))throw Error('Invalid transfer package.');
 const workspace=parseWorkspace(JSON.stringify(b.workspace));const evidence=parseEngineLedger(JSON.stringify(b.evidence),workspace.projects.map(p=>p.id));
 const decisions=parseDecisions(JSON.stringify(b.decisions),evidence);
 if(b.draft!==null&&(!b.draft||typeof b.draft.draft!=='string'||typeof b.draft.keyword!=='string'||b.draft.draft.length>100000||b.draft.keyword.length>500))throw Error('Invalid content draft.');
 return {version:1,exportedAt:b.exportedAt,workspace,evidence,decisions,draft:b.draft};
}
export function createBundle(raw:{workspace:string|null;evidence:string|null;decisions:string|null;draft:string|null}):MigrationBundle{
 return parseBundle(JSON.stringify({version:1,exportedAt:new Date().toISOString(),workspace:raw.workspace?JSON.parse(raw.workspace):emptyWorkspace(),evidence:raw.evidence?JSON.parse(raw.evidence):emptyEngineLedger(),decisions:raw.decisions?JSON.parse(raw.decisions):emptyDecisionBook(),draft:raw.draft?JSON.parse(raw.draft):null}));
}
export function bundleCounts(b:MigrationBundle){return {projects:b.workspace.projects.length,audits:b.workspace.snapshots.length,briefs:b.workspace.briefs.length,aiSamples:b.workspace.observations.length,actions:b.workspace.actionPlans?.length||0,evidence:b.evidence.records.length,decisions:b.decisions.records.length,drafts:b.draft?1:0};}
