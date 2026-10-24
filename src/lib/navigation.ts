export type View='experience'|'investigation'|'command'|'audit'|'benchmark'|'content'|'workspace'|'engines';
export type WorkspaceTab='Projects'|'Audit history'|'Action board'|'Content studio'|'AI exposure'|'Connections';
const sections:Record<string,WorkspaceTab>={projects:'Projects','audit-history':'Audit history','action-board':'Action board','content-studio':'Content studio','ai-exposure':'AI exposure',connections:'Connections'};
const views=new Set<View>(['experience','investigation','command','audit','benchmark','content','workspace','engines']);
export function readRoute(hash:string):{view:View;tab:WorkspaceTab}{const [view,section]=hash.replace(/^#/,'').split('/');return{view:views.has(view as View)?view as View:'experience',tab:sections[section]||'Projects'};}
export function routeHash(view:View,tab:WorkspaceTab='Projects'){return '#'+view+(view==='workspace'?'/'+Object.entries(sections).find(([,name])=>name===tab)![0]:'');}
