import test from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync,readdirSync,statSync} from "node:fs";
import {join} from "node:path";
import {architecturePhotography,atlasOnlyPhotography,commandPhotography,editorialPhotography,studioPhotography} from "./editorial-photos";
import {allEditorialAssets,photosFor,premiumPhotography,requiredAllocation,type PhotoArea} from "./premium-photography";
import {categoryForEngine,cinematicVisuals,fullSelectionCount,getEngineVisuals,parentBrandVisuals,selectedPhotography,visualAssets,workingPagePhotos} from "./visual-assets";

const pub=(p:string)=>join(process.cwd(),"public",p.slice(1));
const engines=[1,2,3,4,5,6,7,8,9] as const;
/** Reads width and height from a lossy or lossless WebP header. */
function webpSize(file:string){
 const b=readFileSync(file);
 assert.equal(b.toString("ascii",0,4),"RIFF");assert.equal(b.toString("ascii",8,12),"WEBP");
 const kind=b.toString("ascii",12,16);
 if(kind==="VP8 ")return{width:b.readUInt16LE(26)&0x3fff,height:b.readUInt16LE(28)&0x3fff};
 if(kind==="VP8L"){const v=b.readUInt32LE(21);return{width:(v&0x3fff)+1,height:((v>>14)&0x3fff)+1};}
 return{width:1+b.readUIntLE(24,3),height:1+b.readUIntLE(27,3)};
}

test("all user selections are retained without duplicate image files",()=>{
 assert.equal(fullSelectionCount,41);
 assert.equal(visualAssets.length,40);
 assert.equal(selectedPhotography.length,37);
 assert.equal(parentBrandVisuals.length,3);
 assert.equal(cinematicVisuals.length,6);
 assert.equal(new Set(visualAssets.map(x=>x.path)).size,visualAssets.length);
});
test("every designated library binary is actually present in the project",()=>{
 for(const item of visualAssets){
  assert.match(item.path,/^\/web-images\/[a-z-]+\/[a-z-]+\.(jpg|png)$/);
  assert.ok(existsSync(pub(item.path)),"Missing "+item.path);
 }
});
test("every editorial photograph is served locally as optimised WebP with matching dimensions",()=>{
 for(const p of allEditorialAssets){
  for(const file of [p.path,p.thumb]){
   assert.match(file,/^\/web-images\/(premium\/[a-z-]+|editorial\/studio)\/[a-z-]+\.webp$/,file);
   assert.ok(existsSync(pub(file)),"Missing "+file);
  }
  const size=webpSize(pub(p.path));
  assert.deepEqual(size,{width:p.width,height:p.height},p.id+" dimensions");
  assert.ok(webpSize(pub(p.thumb)).width<=640,p.id+" thumbnail width");
  const kb=statSync(pub(p.path)).size/1024;
  assert.ok(kb<(p.placement==="gallery"?250:400),p.id+" is "+Math.round(kb)+" KB");
 }
});
test("image identifiers and local paths are unique across the whole library",()=>{
 const ids=allEditorialAssets.map(p=>p.id);
 assert.equal(new Set(ids).size,ids.length);
 const paths=[...allEditorialAssets.flatMap(p=>[p.path,p.thumb]),...visualAssets.map(v=>v.path)];
 assert.equal(new Set(paths).size,paths.length);
 const origins=allEditorialAssets.map(p=>p.origin);
 assert.equal(new Set(origins).size,origins.length,"the same original photograph is registered twice");
});
test("source, photographer, licence and description metadata are complete and registered",()=>{
 const register=JSON.parse(readFileSync(join(process.cwd(),"public/web-images/premium/sources.json"),"utf8")) as {assets:{id:string;sourceUrl:string;photographer:string;licence:string}[]};
 for(const p of allEditorialAssets){
  assert.equal(new URL(p.sourceUrl).hostname,"unsplash.com",p.id);
  assert.ok(p.photographer.trim(),p.id);
  assert.match(p.licence,/^Unsplash License/,p.id);
  assert.match(p.origin,/^photo-\d+-[0-9a-f]+$/,p.id);
  assert.ok(p.alt.length>=25&&!/illustrative|visual \d/i.test(p.alt),p.id+" alt text should describe the photograph");
  assert.ok(p.title.trim()&&!/\d/.test(p.title),p.id+" title");
  if(p.fallback){assert.ok(existsSync(pub(p.fallback)),p.fallback);assert.ok(p.fallbackAlt&&p.fallbackAlt.length>=20,p.id+" fallback alt");}
  const entry=register.assets.find(a=>a.id===p.id);
  assert.ok(entry,p.id+" missing from sources.json");
  assert.equal(entry.sourceUrl,p.sourceUrl);assert.equal(entry.photographer,p.photographer);
 }
});
test("premium photographs stay within the agreed allocation for each application area",()=>{
 for(const area of Object.keys(requiredAllocation) as PhotoArea[])
  assert.equal(photosFor(area).length,requiredAllocation[area],area);
});
test("every application area holds its full premium allocation",()=>{
 const missing=(Object.keys(requiredAllocation) as PhotoArea[]).map(a=>[a,requiredAllocation[a]-photosFor(a).length] as const).filter(([,n])=>n>0);
 assert.deepEqual(missing,[]);
 assert.equal(premiumPhotography.length,40);
});
test("each of the nine intelligence studios has a distinct local lead and a gallery of real photography",()=>{
 const leads=engines.map(e=>studioPhotography[e].path);
 assert.equal(new Set([...leads,commandPhotography.path]).size,10);
 for(const engine of engines){
  assert.ok(categoryForEngine[engine]);
  const gallery=getEngineVisuals(engine);
  assert.equal(gallery[0].path,studioPhotography[engine].path);
  assert.ok(gallery.length===3||gallery.length===4,"engine "+engine+" has "+gallery.length);
  assert.ok(gallery.every(g=>g.path.startsWith("/web-images/")),"engine "+engine+" must not hot-link images");
 }
 assert.ok(!editorialPhotography.some(p=>atlasOnlyPhotography.includes(p)),"retired handshake must stay in the atlas");
});
test("no photograph repeats across unrelated working areas",()=>{
 const placements=[
  ...engines.map(e=>getEngineVisuals(e).map(g=>g.path)),
  [commandPhotography.path,...photosFor("command").map(p=>p.path)],
  ...(["benchmark","investigation","workspace","pricing","demo","cinematic"] as PhotoArea[]).map(a=>photosFor(a).map(p=>p.path)),
  workingPagePhotos.audit.map(p=>p.path),workingPagePhotos.content.map(p=>p.path),
 ];
 const seen=new Map<string,number>();
 placements.forEach((group,i)=>group.forEach(path=>{assert.ok(!seen.has(path)||seen.get(path)===i,path+" appears in two areas");seen.set(path,i);}));
});

const sourceFiles=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?sourceFiles(join(dir,d.name)):/\.(tsx?|css)$/.test(d.name)&&!d.name.endsWith(".test.ts")?[join(dir,d.name)]:[]);
test("no generic numbered photographic labels are rendered",()=>{
 for(const file of sourceFiles(join(process.cwd(),"src/app"))){
  const text=readFileSync(file,"utf8");
  assert.doesNotMatch(text,/\b(Selected\s+)?(Visual|Image|Photo)\s*0\d\b/i,file);
  assert.doesNotMatch(text,/(Visual|Image|Photo)\s*\$\{/i,file);
  assert.doesNotMatch(text,/visualIndex|story-image-label/,file);
 }
});
test("every local image reference in the source resolves to a file and nothing is hot-linked",()=>{
 const files=[...sourceFiles(join(process.cwd(),"src")),join(process.cwd(),"next.config.ts")];
 for(const file of files){
  const text=readFileSync(file,"utf8");
  assert.doesNotMatch(text,/images\.unsplash\.com\/photo-/,file+" hot-links Unsplash");
  for(const [ref] of text.matchAll(/\/web-images\/[a-z0-9\/-]+\.(?:jpg|png|webp)/g))assert.ok(existsSync(pub(ref)),file+" references missing "+ref);
 }
});

test("all nine architecture cards use distinct local photographs from their corresponding engine",()=>{
 const photos=engines.map(id=>architecturePhotography[id]);
 assert.equal(photos.length,9);
 assert.equal(new Set(photos.map(p=>p.thumb)).size,9);
 for(const id of engines){const p=architecturePhotography[id];assert.equal(p.section,categoryForEngine[id]);assert.ok(existsSync(pub(p.thumb)));assert.ok(getEngineVisuals(id).some(g=>g.id===p.id));}
 const matrix=readFileSync(join(process.cwd(),"src/app/engine-matrix.tsx"),"utf8");
 assert.match(matrix,/architecturePhotography\[engine\.id\]/);
 assert.match(matrix,/className="vte-matrix-photo"/);
});
