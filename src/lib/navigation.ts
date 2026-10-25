import type {EngineId} from './engine-methods';
export type View='experience'|'investigation'|'command'|'audit'|'benchmark'|'content'|'workspace'|'engines'|'decisions'|'measurements'|'pricing'|'demo';
export type WorkspaceTab='Projects'|'Audit history'|'Action board'|'Content studio'|'AI exposure'|'Connections';
const sections:Record<string,WorkspaceTab>={projects:'Projects','audit-history':'Audit history','action-board':'Action board','content-studio':'Content studio','ai-exposure':'AI exposure',connections:'Connections'};
const views=new Set<View>(['experience','investigation','command','audit','benchmark','content','workspace','engines','decisions','measurements','pricing','demo']);
export function readRoute(hash:string):{view:View;tab:WorkspaceTab;engine:EngineId}{const [view,section]=hash.replace(/^#/,'').split('/');return{view:views.has(view as View)?view as View:'experience',tab:sections[section]||'Projects',engine:/^[1-9]$/.test(section||'')?Number(section) as EngineId:3};}
export function routeHash(view:View,tab:WorkspaceTab='Projects',engine:EngineId=3){return '#'+view+(view==='workspace'?'/'+Object.entries(sections).find(([,name])=>name===tab)![0]:view==='engines'?'/'+engine:'');}
