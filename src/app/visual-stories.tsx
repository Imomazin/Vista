'use client';
import Image from "next/image";
import {ArrowUpRight,Images,Layers3,ScanLine,Sparkles} from "lucide-react";
import {categoryForEngine,cinematicVisuals,getEngineVisuals,selectedPhotography,visualAssets,type VisualCategory} from "@/lib/visual-assets";
import type {EngineId} from "@/lib/engine-methods";
import "./visual-stories.css";

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
const primeStories=[
 {file:"immersive-executive-command-centre.jpg",category:"cinematic" as const,title:"The intelligence theatre",detail:"One connected executive perspective.",engine:8 as EngineId},
 {file:"artificial-intelligence-radiant-network.jpg",category:"ai-exposure" as const,title:"AI visibility, reimagined",detail:"Follow prompts, responses and real citations.",engine:9 as EngineId},
 {file:"holographic-growth-dashboard.jpg",category:"impact" as const,title:"Turn insights into impact",detail:"Move from findings to measured decisions.",engine:2 as EngineId},
 {file:"purple-production-studio.jpg",category:"content" as const,title:"Create with intelligence",detail:"Connect editorial craft to evidence.",engine:4 as EngineId}
];

export function AmbidextersLogo({compact=false}:{compact?:boolean}){
 return <span className={"ax-transparent-logo"+(compact?" ax-logo-compact":"")} role="img" aria-label="Ambidexters">
  <Image className="ax-for-light" src="/web-images/brand/ambidexters-logo-transparent.png" alt="" width={72} height={72} sizes="72px"/>
  <Image className="ax-for-dark" src="/web-images/brand/ambidexters-logo-platinum.png" alt="" width={72} height={72} sizes="72px"/>
 </span>;
}

export function CinematicPhotoReel(){
 const scenes=[
  {path:"/web-images/cinematic/violet-cyan-digital-orbit.jpg",alt:"Violet and cyan intelligence rings"},
  {path:"/web-images/cinematic/ai-laptop-holographic-dashboard.jpg",alt:"Human and artificial intelligence"},
  {path:"/web-images/cinematic/chromatic-data-spiral.jpg",alt:"Chromatic intelligence vortex"}
 ];
 return <div className="cinematic-photo-reel" aria-hidden="true">{scenes.map((scene,i)=><div key={scene.path} className={"cinematic-reel-frame reel-frame-"+i}>
  <Image src={scene.path} fill sizes="(max-width:700px) 80vw, 50vw" alt="" quality={72}/>
 </div>)}</div>;
}

export function CommandEditorial({onNavigate}:{onNavigate:(engine:EngineId)=>void}){
 return <section className="vista-editorial" aria-label="Marketing intelligence visual stories">
  <div className="vista-editorial-heading"><span className="eyebrow"><Sparkles size={15}/> VISUAL INTELLIGENCE</span><h2>See beyond the dashboard.<br/><em>Discover a new perspective.</em></h2><p>Human expertise, intelligent technology and evidence-led marketing decisions. Explore the individual VisTa intelligence studios.</p></div>
  <div className="vista-editorial-grid">{primeStories.map((s,i)=>{
   const src="/web-images/"+s.category+"/"+s.file;
   return <button key={s.file} className={"vista-editorial-tile"+(i===0?" editorial-lead":"")} onClick={()=>onNavigate(s.engine)}>
    <Image src={src} alt={s.title+" — illustrative marketing technology photography"} fill sizes={i===0?"(max-width:800px) 100vw, 45vw":"(max-width:800px) 50vw, 25vw"} quality={82}/>
    <span className="editorial-shade"/><span className="editorial-caption"><small>EXPLORE / {String(i+1).padStart(2,"0")}</small><strong>{s.title}</strong><span>{s.detail}</span></span><ArrowUpRight className="editorial-arrow" size={19}/>
   </button>;
  })}</div>
  <p className="vista-editorial-disclaimer">Imagery illustrates the intelligence disciplines. Platform analytics and measurements are sourced separately from observed evidence.</p>
 </section>;
}

export function EngineVisualStory({engine,onAction}:{engine:EngineId;onAction:()=>void}){
 const category=categoryForEngine[engine];const selected=getEngineVisuals(engine);
 if(!selected.length)return null;
 const hero=selected[0];const others=selected.slice(1);
 return <section className={"vista-engine-story engine-story-"+category} aria-label={captions[category]+" visual story"}>
  <div className="engine-story-photo">
   <Image src={hero.path} alt={hero.title+" — illustrative photograph"} fill sizes="(max-width:900px) 95vw, 45vw" quality={82}/>
   <div className="engine-story-photo-scrim"/><span>VisTa / {captions[category].toUpperCase()}</span>
  </div>
  <div className="engine-story-copy">
   <small>THE HUMAN SIDE OF SUPERIOR INTELLIGENCE</small>
   <h3>Intelligence you can<br/><em>put to work.</em></h3>
   <p>{hero.placement}. VisTa connects visual perspective with evidence, source context and real operational next steps.</p>
   <button className="engine-story-cta" onClick={onAction}>Open the working studio <ArrowUpRight size={16}/></button>
   {others.length>0&&<div className="engine-story-thumbnails" aria-label="Additional selected visuals">
    {others.map(pic=><div key={pic.path} className="engine-story-mini" title={pic.title}><Image src={pic.path} alt={pic.title} fill sizes="110px" quality={72}/></div>)}
   </div>}
  </div>
 </section>;
}

export function VisualAtlas({onChoose}:{onChoose:(engine:EngineId)=>void}){
 const groups=[...new Set(selectedPhotography.map(a=>a.folder))];
 return <details className="vista-visual-atlas" id="vista-visual-atlas">
  <summary><span className="atlas-summary-icon"><Images size={23}/></span><span><small>THE CURATED VISUAL COLLECTION</small><strong>Explore the entire VisTa Visual Atlas</strong><em>{selectedPhotography.length} selected photographs across our nine intelligence elements and cinematic universe.</em></span><Layers3 size={22}/></summary>
  <div className="atlas-body"><p>The selected images illustrate the fields VisTa covers. They do not depict connected analytics, measured marketing results or verified client work.</p>
   {groups.map(group=><section className="atlas-group" key={group}>
    <h3>{captions[group]} <span>{selectedPhotography.filter(a=>a.folder===group).length} visuals</span></h3>
    <div className="atlas-grid">{visualAssets.filter(a=>a.folder===group).map(pic=><article key={pic.path} className="atlas-card">
     <div className="atlas-photo"><Image src={pic.path} fill alt={pic.title} sizes="(max-width:600px) 45vw, (max-width:1000px) 25vw, 18vw" quality={75}/></div>
     <p>{pic.title.replace(/-/g," ")}</p>{studioIds[group]&&<button onClick={()=>onChoose(studioIds[group]!)}>Open studio <ArrowUpRight size={12}/></button>}
    </article>)}</div>
   </section>)}
  </div>
 </details>;
}
