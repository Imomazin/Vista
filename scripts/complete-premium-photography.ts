/**
 * Complete the remaining premium-photo allocation on PR #22.
 * 1. node --import tsx scripts/complete-premium-photography.ts --stage
 * 2. Inspect every staged master and thumbnail, actual source/rights and crop.
 * 3. node --import tsx scripts/complete-premium-photography.ts --apply-reviewed
 *
 * No network requests from the application; no credential or production changes.
 */
import {mkdir,readFile,writeFile,copyFile} from "node:fs/promises";
import {dirname,join} from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {allEditorialAssets,premiumPhotography,requiredAllocation,type PhotoArea,type VistaEditorialAsset} from "../src/lib/premium-photography";

type Candidate = Pick<VistaEditorialAsset,"id"|"title"|"alt"|"section"|"placement"|"photographer"|"sourceUrl"|"origin"|"objectPosition"> & {
 slug:string; cdnUrl:string; previewInspected:boolean; originalRequestedId:string; selection:string; replaceId?:string;
};
type Staged = {id:string; width:number;height:number;bytes:number;thumbBytes:number;sha256:string;thumbSha256:string;originalSha256:string};
const root=process.cwd();
const cache=join(root,".photo-cache","completion");
const registry=join(root,"src/lib/premium-photography.ts");
const sourceRegister=join(root,"public/web-images/premium/sources.json");
const testFile=join(root,"src/lib/visual-assets.test.ts");
const licence="Unsplash License (see original source page and licence terms; additional third-party rights may apply)";
const masterWidth={hero:1920,editorial:1600,gallery:1200};
const hash=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
const stageFile=(c:Candidate,suffix="")=>join(cache,c.id+suffix+".webp");

async function main(){
 const manifest=JSON.parse(await readFile(join(root,"scripts/premium-photo-completion.json"),"utf8")) as {candidates:Candidate[]};
 const candidates=manifest.candidates;
 const action=process.argv[2];
 if(action!=="--stage"&&action!=="--apply-reviewed")throw Error("Use --stage, inspect the actual photographs, then --apply-reviewed.");
 if(candidates.length!==27)throw Error("Expected 26 outstanding photographs plus the Pricing replacement.");
 const replaced=new Set(candidates.flatMap(c=>c.replaceId?[c.replaceId]:[]));
 if(replaced.size!==1||!replaced.has("pricing-boardroom-review"))throw Error("Unexpected replacements.");
 const ids=new Set(allEditorialAssets.filter(a=>!replaced.has(a.id)).map(a=>a.id));
 const origins=new Set(allEditorialAssets.map(a=>a.origin));
 for(const c of candidates){
  if(!/^[a-z-]+$/.test(c.id)||!/^[a-z-]+$/.test(c.slug)||!Object.hasOwn(requiredAllocation,c.section))throw Error("Invalid candidate "+c.id);
  if(ids.has(c.id)||origins.has(c.origin))throw Error("Duplicate candidate "+c.id);
  ids.add(c.id);origins.add(c.origin);
  const source=new URL(c.sourceUrl),cdn=new URL(c.cdnUrl);
  if(source.protocol!=="https:"||source.hostname!=="unsplash.com"||cdn.protocol!=="https:"||cdn.hostname!=="images.unsplash.com"||cdn.pathname!=="/"+c.origin||!/^photo-\d+-[a-f0-9]+$/.test(c.origin))throw Error("Invalid source: "+c.id);
  if(!c.photographer.trim()||c.alt.length<25||/\d/.test(c.title))throw Error("Incomplete metadata "+c.id);
 }
 for(const area of Object.keys(requiredAllocation) as PhotoArea[]){
  const count=premiumPhotography.filter(p=>p.section===area&&!replaced.has(p.id)).length+candidates.filter(p=>p.section===area).length;
  if(count!==requiredAllocation[area])throw Error(area+" expected "+requiredAllocation[area]+", found "+count);
 }
 await mkdir(cache,{recursive:true});
 const report:Staged[]=[];
 const originals=new Set<string>(),masters=new Set<string>();
 if(action==="--stage"){
  const failures:string[]=[];
  for(const c of candidates){
   try{
    const response=await fetch(c.cdnUrl,{redirect:"error",signal:AbortSignal.timeout(45000)});
    if(!response.ok||!response.headers.get("content-type")?.startsWith("image/"))throw Error("HTTP "+response.status+" or non-image response");
    if(Number(response.headers.get("content-length")||0)>20_000_000)throw Error("Original too large");
    const input=Buffer.from(await response.arrayBuffer());
    if(input.length>20_000_000)throw Error("Original too large");
    const metadata=await sharp(input,{limitInputPixels:60_000_000}).metadata();
    if(!metadata.width||!metadata.height||metadata.width<800||metadata.height<450)throw Error("Insufficient original resolution");
    const originalSha256=hash(input);
    if(originals.has(originalSha256))throw Error("Duplicate original binary");
    originals.add(originalSha256);
    const limit=c.placement==="gallery"?250*1024:400*1024;
    // Generate from the original for each quality attempt, never recompress an output.
    let master:Buffer|undefined;let width=0,height=0;
    for(const quality of [78,74,70,66]){
     const output=await sharp(input,{limitInputPixels:60_000_000}).rotate().resize({width:masterWidth[c.placement],withoutEnlargement:true}).webp({quality,effort:6}).toBuffer({resolveWithObject:true});
     if(output.data.length<limit){master=output.data;width=output.info.width;height=output.info.height;break;}
    }
    if(!master)throw Error("Master exceeds file-size target");
    const thumbnail=await sharp(input,{limitInputPixels:60_000_000}).rotate().resize({width:640,withoutEnlargement:true}).webp({quality:74,effort:6}).toBuffer();
    const sha256=hash(master);
    if(masters.has(sha256))throw Error("Duplicate optimised binary");
    masters.add(sha256);
    await writeFile(stageFile(c),master);
    await writeFile(stageFile(c,"-thumb"),thumbnail);
    report.push({id:c.id,width,height,bytes:master.length,thumbBytes:thumbnail.length,sha256,thumbSha256:hash(thumbnail),originalSha256});
    console.log(c.id,width+"x"+height,Math.round(master.length/1024)+" KB",c.sourceUrl);
   }catch(error){failures.push(c.id+": "+String(error));}
  }
  await writeFile(join(cache,"stage-report.json"),JSON.stringify({assets:report,failures},null,2)+"\n");
  if(failures.length)throw Error("Staging incomplete:\n"+failures.join("\n"));
  console.log("All "+report.length+" candidates downloaded and staged. Inspect .photo-cache/completion before applying.");
  return;
 }

 // Applying is deliberately separate from downloading: a human/visual check must
 // confirm that the actual files match the sources, descriptions and rights.
 const staged=JSON.parse(await readFile(join(cache,"stage-report.json"),"utf8")) as {assets:Staged[];failures:string[]};
 if(staged.failures.length||staged.assets.length!==candidates.length)throw Error("Staging is incomplete");
 const existing=await readFile(registry,"utf8");
 const oldPrice=/  premium\(\{ id: "pricing-boardroom-review"[\s\S]*?\}\),\n/;
 const insertion="];\n\n/** Existing studio leads";
 if(!oldPrice.test(existing)||!existing.includes(insertion))throw Error("Registry has changed; reconcile the branch before applying.");
 const currentTests=await readFile(testFile,"utf8");
 const todo=/test\("every application area holds its full premium allocation",\{todo:"[^"]+"\},\(\)=>\{/;
 if(!todo.test(currentTests))throw Error("Allocation test has changed; inspect it before applying.");
 const currentSources=JSON.parse(await readFile(sourceRegister,"utf8")) as {assets:Record<string,unknown>[];retired?:Record<string,unknown>[];[key:string]:unknown};
 const seeds:string[]=[];
 const newEntries:Record<string,unknown>[]=[];
 for(const c of candidates){
  const r=staged.assets.find(a=>a.id===c.id);
  if(!r)throw Error("Missing staged report "+c.id);
  const master=await readFile(stageFile(c)),thumb=await readFile(stageFile(c,"-thumb"));
  if(hash(master)!==r.sha256||hash(thumb)!==r.thumbSha256||masters.has(r.sha256)||originals.has(r.originalSha256))throw Error("Stage checksum or duplicate error "+c.id);
  masters.add(r.sha256);originals.add(r.originalSha256);
  const metadata=await sharp(master).metadata(),tm=await sharp(thumb).metadata();
  if(metadata.format!=="webp"||tm.format!=="webp"||metadata.width!==r.width||metadata.height!==r.height||!tm.width||tm.width>640||master.length!==r.bytes||thumb.length!==r.thumbBytes||master.length>=(c.placement==="gallery"?250:400)*1024)throw Error("Stage dimensions or size changed "+c.id);
  const {id,slug,section,placement,title,alt,photographer,sourceUrl,origin,objectPosition}=c;
  const seed={id,slug,section,placement,title,alt,photographer,sourceUrl,origin,width:r.width,height:r.height,...(objectPosition?{objectPosition}:{})};
  seeds.push("  premium("+JSON.stringify(seed)+"),\n");
  const base="/web-images/premium/"+section+"/"+slug;
  newEntries.push({id,path:base+".webp",thumb:base+"-thumb.webp",section,collection:"premium",title,alt,photographer,sourceUrl,licence,cdnOrigin:"https://images.unsplash.com/"+origin,width:r.width,height:r.height,bytes:r.bytes,thumbBytes:r.thumbBytes,selection:c.selection,originalRequestedId:c.originalRequestedId});
 }
 // All checks have passed before any working files are modified.
 const revised=existing.replace(oldPrice,"").replace(insertion,seeds.join("")+insertion).replace(/const UNSPLASH = "[^"]+";/,"const UNSPLASH = "+JSON.stringify(licence)+";");
 const retired=currentSources.assets.filter(a=>replaced.has(String(a.id)));
 const retained=currentSources.assets.filter(a=>!replaced.has(String(a.id))).map(a=>({...a,licence}));
 for(const c of candidates){
  const out=join(root,"public","web-images","premium",c.section,c.slug);
  await mkdir(dirname(out),{recursive:true});
  await copyFile(stageFile(c),out+".webp");await copyFile(stageFile(c,"-thumb"),out+"-thumb.webp");
 }
 await writeFile(registry,revised);
 await writeFile(sourceRegister,JSON.stringify({...currentSources,assets:[...retained,...newEntries],retired:[...(currentSources.retired||[]),...retired]},null,1)+"\n");
 await writeFile(testFile,currentTests.replace(todo,'test("every application area holds its full premium allocation",()=>{'));
 console.log("Installed 26 outstanding photographs and replaced Pricing. Full allocation test is now mandatory. Run typecheck, tests, build and browser acceptance.");
}
main().catch(error=>{console.error(error);process.exitCode=1});
