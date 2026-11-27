'use client';
import Image from "next/image";
import {useEffect,useState,type ComponentProps,type KeyboardEvent} from "react";
import {atlasOnlyPhotography,commandPhotography,editorialPhotography} from "@/lib/editorial-photos";
import {ArrowLeft,ArrowRight,ArrowUpRight,Images,Layers3,Sparkles} from "lucide-react";
import {categoryForEngine,getEngineVisuals,selectedPhotography,type GalleryPhoto,type VisualCategory} from "@/lib/visual-assets";
import {photosFor,type PhotoArea} from "@/lib/premium-photography";
import type {EngineId} from "@/lib/engine-methods";
import "./visual-stories.css";
import "./visual-immersive.css";
import "./editorial-premium.css";

const captions:Record<VisualCategory,string>={
 "brand":"Ambidexters",
 "cinematic":"Cinematic intelligence",
 "search":"Search Visibility",
 "impact":"Impact Intelligence",
 "site":"Site Intelligence",
 "content":"Strategic Content",
 "authority":"Trust & Authority",
 "reputation":"Reputation Intelligence",
 "agency":"Agency Operations",
 "analytics":"Analytics Intelligence",
 "ai-exposure":"AI Exposure / GEO",
};
const studioIds:Partial<Record<VisualCategory,EngineId>>={
 "search":1,"impact":2,"site":3,"content":4,"authority":5,"reputation":6,"agency":7,"analytics":8,"ai-exposure":9
};

/** Next image that swaps to a local fallback, with its own accurate description, if the primary file fails. */
export function EditorialImage({fallback,fallbackAlt,...props}:ComponentProps<typeof Image>&{fallback?:string;fallbackAlt?:string}){
 const [failed,setFailed]=useState(false);
 const useFallback=failed&&!!fallback;
 return <Image {...props} src={useFallback?fallback!:props.src} alt={useFallback&&props.alt?(fallbackAlt??""):props.alt} onError={fallback&&!failed?()=>setFailed(true):props.onError}/>;
}

const legacyCommand:GalleryPhoto[]=[
 {id:"legacy-marketing-team",path:"/web-images/editorial/marketing-team.jpg",thumb:"/web-images/editorial/marketing-team.jpg",title:"Decide with the whole team",detail:"Every specialist at one table.",alt:"Team meeting around a table in a bright meeting room with a wall screen"},
 {id:"legacy-creative-collaboration",path:"/web-images/editorial/creative-collaboration.jpg",thumb:"/web-images/editorial/creative-collaboration.jpg",title:"Create with intelligence",detail:"Editorial craft connected to evidence.",alt:"Three colleagues laughing together while working on laptops at a round table"},
];
const commandLinks:EngineId[]=[8,2,7,1,4];

export function AmbidextersLogo({compact=false}:{compact?:boolean}){
 return <span className={"ax-transparent-logo"+(compact?" ax-logo-compact":"")} role="img" aria-label="Ambidexters">
  <Image className="ax-for-light" src="/web-images/brand/ambidexters-logo-transparent.png" alt="" width={72} height={72} sizes="72px"/>
  <Image className="ax-for-dark" src="/web-images/brand/ambidexters-logo-platinum.png" alt="" width={72} height={72} sizes="72px"/>
 </span>;
}

const reelScenes=[
 ...photosFor("cinematic").map(p=>p.path),
 "/web-images/cinematic/violet-cyan-digital-orbit.jpg",
 "/web-images/cinematic/ai-laptop-holographic-dashboard.jpg",
 "/web-images/cinematic/chromatic-data-spiral.jpg",
];
/** Ambient entrance reel. Only the visible and next frames are mounted, so the library is not loaded on entry. */
export function CinematicPhotoReel({motion=true}:{motion?:boolean}){
 const [index,setIndex]=useState(0);
 useEffect(()=>{
  if(!motion||reelScenes.length<2)return;
  if(typeof window!=="undefined"&&window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
  const timer=setInterval(()=>setIndex(i=>(i+1)%reelScenes.length),6000);
  return()=>clearInterval(timer);
 },[motion]);
 const next=(index+1)%reelScenes.length;
 return <div className="cinematic-photo-reel reel-js" aria-hidden="true">{reelScenes.map((path,i)=>(i===index||i===next)&&<div key={path} className={"cinematic-reel-frame"+(i===index?" is-current":"")}>
  <Image src={path} fill sizes="(max-width:850px) 100vw, 60vw" alt="" quality={72} priority={i===0}/>
 </div>)}</div>;
}

export function CommandEditorial({onNavigate}:{onNavigate:(engine:EngineId)=>void}){
 const tiles=[commandPhotography,...photosFor("command"),...legacyCommand].slice(0,Math.max(4,1+photosFor("command").length));
 return <section className="vista-editorial" aria-label="Marketing intelligence visual stories">
  <div className="vista-editorial-heading"><span className="eyebrow"><Sparkles size={15}/> VISUAL INTELLIGENCE</span><h2>See beyond the dashboard.<br/><em>Discover a new perspective.</em></h2><p>Human expertise, intelligent technology and evidence-led marketing decisions. Explore the individual VisTa intelligence studios.</p></div>
  <div className="vista-editorial-grid">{tiles.map((s,i)=>{
   const p=s as GalleryPhoto;
   return <button key={p.id} type="button" className={"vista-editorial-tile"+(i===0?" editorial-lead":"")} onClick={()=>onNavigate(commandLinks[i])}>
    <EditorialImage src={i===0?p.path:p.thumb} fallback={p.fallback} fallbackAlt={p.fallbackAlt} alt={p.alt} fill style={p.objectPosition?{objectPosition:p.objectPosition}:undefined} sizes={i===0?"(max-width:1000px) 100vw, 45vw":"(max-width:650px) 50vw, (max-width:1000px) 50vw, 25vw"} quality={80}/>
    <span className="editorial-shade" aria-hidden="true"/><span className="editorial-caption"><strong>{p.title}</strong>{p.detail&&<span>{p.detail}</span>}</span><ArrowUpRight className="editorial-arrow" size={19} aria-hidden="true"/>
   </button>;
  })}</div>
  <p className="vista-editorial-disclaimer">Imagery illustrates the intelligence disciplines. Platform analytics and measurements are sourced separately from observed evidence.</p>
 </section>;
}

const narratives:Record<EngineId,{overline:string;opening:string;emphasis:string;description:string;label:string}>={
 1:{overline:"DISCOVERABILITY / DEMAND",opening:"Be found where",emphasis:"the future looks.",description:"Search visibility is the gateway to strategic advantage. Investigate demand, understand discoverability and act on real evidence.",label:"Explore search intelligence"},
 2:{overline:"SIGNAL / OUTCOME",opening:"Turn every insight",emphasis:"into measurable impact.",description:"Connect marketing decisions to customer journeys, meaningful outcomes and verifiable performance evidence.",label:"Explore impact intelligence"},
 3:{overline:"TECHNOLOGY / EXPERIENCE",opening:"See the architecture",emphasis:"behind performance.",description:"Discover how the technical foundations of a digital presence create or constrain visibility, trust and experience.",label:"Investigate site intelligence"},
 4:{overline:"IDEA / INFLUENCE",opening:"Create what",emphasis:"moves the world.",description:"Bring human imagination together with evidence-led content strategy, confident storytelling and purposeful execution.",label:"Enter the content studio"},
 5:{overline:"IDENTITY / TRUST",opening:"See what connects",emphasis:"authority and influence.",description:"Make entities, relationships and sources understandable. Distinguish what is evidenced from what is merely assumed.",label:"Explore authority intelligence"},
 6:{overline:"PERCEPTION / REPUTATION",opening:"Understand the",emphasis:"conversation around you.",description:"Bring audience understanding, public signals and source-aware reputation decisions into one strategic view.",label:"Explore reputation intelligence"},
 7:{overline:"PEOPLE / ORCHESTRATION",opening:"Run intelligence",emphasis:"at enterprise scale.",description:"Turn collaborative work, client relationships and campaign execution into a considered, accountable operating system.",label:"Open agency operations"},
 8:{overline:"EVIDENCE / DECISIONS",opening:"Find the meaning",emphasis:"inside the metrics.",description:"From analytical signals to executive decisions: read the data, understand the context and trace what deserves action.",label:"Explore analytics intelligence"},
 9:{overline:"AI / GENERATIVE DISCOVERY",opening:"Become visible in",emphasis:"the age of answers.",description:"Explore how generative systems describe, connect and cite brands. Bring prompt evidence, interpretation and action together.",label:"Enter the AI exposure studio"}
};
export function EngineVisualStory({engine,onAction}:{engine:EngineId;onAction:()=>void}){
 const category=categoryForEngine[engine];
 const selected=getEngineVisuals(engine);
 const [active,setActive]=useState(0);
 useEffect(()=>setActive(0),[engine]);
 if(!selected.length)return null;
 const current=selected[active]||selected[0];
 const narrative=narratives[engine];
 const step=(delta:number)=>setActive(i=>(i+selected.length+delta)%selected.length);
 const onGalleryKey=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;
  event.preventDefault();
  const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
  const from=Math.max(0,buttons.indexOf(document.activeElement as HTMLButtonElement));
  const next=(from+selected.length+(event.key==="ArrowRight"?1:-1))%selected.length;
  setActive(next);
  buttons[next]?.focus();
 };
 return <section className={"vista-engine-story story-immersive engine-story-"+category} aria-label={captions[category]+" photography"}>
  <div className="story-stage">
   <div className="story-stage-image">
    <EditorialImage key={current.path} src={current.path} fallback={current.fallback} fallbackAlt={current.fallbackAlt} alt={current.alt} fill style={current.objectPosition?{objectPosition:current.objectPosition}:undefined} sizes="(max-width:780px) 100vw, 62vw" quality={80}/>
    <span className="story-image-shade" aria-hidden="true"/>
    <span className="story-image-caption" aria-live="polite">{current.title}</span>
   </div>
   <div className="story-stage-copy">
    <span className="story-kicker"><i aria-hidden="true"/>{narrative.overline}</span>
    <h3>{narrative.opening}<br/><em>{narrative.emphasis}</em></h3>
    <p>{narrative.description}</p>
    <button className="story-main-action" type="button" onClick={onAction}>{narrative.label}<ArrowUpRight size={17}/></button>
    <div className="story-stage-navigation">
     <span>Explore the gallery</span>
     <div>
      <button type="button" aria-label="Previous photograph" disabled={selected.length<2} onClick={()=>step(-1)}><ArrowLeft size={17}/></button>
      <button type="button" aria-label="Next photograph" disabled={selected.length<2} onClick={()=>step(1)}><ArrowRight size={17}/></button>
     </div>
    </div>
   </div>
  </div>
  {selected.length>1&&<div className={"story-gallery gallery-count-"+selected.length} role="group" aria-label={captions[category]+" gallery"} onKeyDown={onGalleryKey}>
   {selected.map((pic,i)=><button type="button" key={pic.id} className={"story-gallery-card"+(active===i?" active":"")} onClick={()=>setActive(i)} aria-pressed={active===i} aria-label={"Show "+pic.title}>
    <EditorialImage src={pic.thumb} fallback={pic.fallback} alt="" fill style={pic.objectPosition?{objectPosition:pic.objectPosition}:undefined} sizes="(max-width:640px) 92vw, (max-width:1000px) 46vw, 30vw" quality={75}/>
    <span className="story-gallery-tint" aria-hidden="true"/>
    <span className="story-gallery-copy"><strong>{pic.title}</strong>{pic.detail&&<span>{pic.detail}</span>}</span>
    <ArrowUpRight className="story-gallery-arrow" size={17} aria-hidden="true"/>
   </button>)}
  </div>}
  <p className="story-visual-disclosure">Photography illustrates the discipline. Source-backed intelligence, actual measurements and actions are provided in the working studio below.</p>
 </section>;
}

/** Compact editorial photography for working pages; sits beside or below headings without covering tools. */
export function EditorialBand({area,photos,variant="aside",className=""}:{area?:PhotoArea;photos?:GalleryPhoto[];variant?:"aside"|"strip";className?:string}){
 const items=(photos??(area?photosFor(area):[])).slice(0,2);
 if(!items.length)return null;
 return <div className={"editorial-band band-"+variant+" band-count-"+items.length+(className?" "+className:"")}>
  {items.map((p,i)=><figure key={p.id} className="band-photo">
   <EditorialImage src={variant==="strip"&&items.length===1?p.path:p.thumb} fallback={p.fallback} fallbackAlt={p.fallbackAlt} alt={p.alt} fill loading="lazy" style={p.objectPosition?{objectPosition:p.objectPosition}:undefined}
    sizes={variant==="strip"?(items.length===1?"(max-width:900px) 100vw, 1100px":"(max-width:700px) 100vw, 50vw"):"(max-width:1000px) 100vw, "+(items.length===1?"34vw":"18vw")} quality={78}/>
   <span className="band-shade" aria-hidden="true"/>
   <figcaption><strong>{p.title}</strong>{p.detail&&(items.length===1||i===0)&&<span>{p.detail}</span>}</figcaption>
  </figure>)}
 </div>;
}

export function VisualAtlas({onChoose}:{onChoose:(engine:EngineId)=>void}){
 const used=new Set(editorialPhotography.map(p=>p.path));
 const collection=[
  ...selectedPhotography.map(a=>({path:a.path,title:a.title,folder:a.folder,fallback:undefined as string|undefined,alt:a.title})),
  ...atlasOnlyPhotography.filter(p=>!used.has(p.path)).map(p=>({path:p.thumb,title:p.title,folder:p.section as VisualCategory,fallback:p.fallback,alt:p.alt})),
 ];
 const groups=[...new Set(collection.map(a=>a.folder))];
 return <details className="vista-visual-atlas" id="vista-visual-atlas">
  <summary><span className="atlas-summary-icon"><Images size={23}/></span><span><small>THE CURATED VISUAL COLLECTION</small><strong>Explore the entire VisTa Visual Atlas</strong><em>{collection.length} images across the nine intelligence elements and the cinematic universe.</em></span><Layers3 size={22}/></summary>
  <div className="atlas-body"><p>The selected images illustrate the fields VisTa covers. They do not depict connected analytics, measured marketing results or verified client work.</p>
   {groups.map(group=><section className="atlas-group" key={group}>
    <h3>{captions[group]} <span>{collection.filter(a=>a.folder===group).length} images</span></h3>
    <div className="atlas-grid">{collection.filter(a=>a.folder===group).map(pic=><article key={pic.path} className="atlas-card">
     <div className="atlas-photo"><EditorialImage src={pic.path} fallback={pic.fallback} fill alt={pic.alt} loading="lazy" sizes="(max-width:600px) 45vw, (max-width:1000px) 25vw, 18vw" quality={72}/></div>
     <p>{pic.title.replace(/-/g," ")}</p>{studioIds[group]&&<button type="button" onClick={()=>onChoose(studioIds[group]!)}>Open studio <ArrowUpRight size={12}/></button>}
    </article>)}</div>
   </section>)}
  </div>
 </details>;
}
