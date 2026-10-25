'use client';
import Image from "next/image";
import {useState} from "react";
import {ArrowLeft,ArrowRight,ArrowUpRight,Images,Layers3,Sparkles} from "lucide-react";
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
 if(!selected.length)return null;
 const current=selected[active]||selected[0];
 const narrative=narratives[engine];
 return <section className={"vista-engine-story story-immersive engine-story-"+category} aria-label={captions[category]+" visual story"}>
  <div className="story-stage">
   <div className="story-stage-image">
    <Image key={current.path} src={current.path} alt={current.title.replace(/-/g," ")+", illustrative visual for "+captions[category]} fill priority={false} sizes="(max-width:900px) 100vw, 65vw" quality={86}/>
    <span className="story-image-shade" aria-hidden="true"/>
    <div className="story-image-label"><span>VisTa / {captions[category].toUpperCase()}</span><span>{String(active+1).padStart(2,"0")} / {String(selected.length).padStart(2,"0")}</span></div>
    <span className="story-image-caption">{current.title.replace(/-/g," ")}</span>
   </div>
   <div className="story-stage-copy">
    <span className="story-kicker"><i aria-hidden="true"/>{narrative.overline}</span>
    <h3>{narrative.opening}<br/><em>{narrative.emphasis}</em></h3>
    <p>{narrative.description}</p>
    <button className="story-main-action" type="button" onClick={onAction}>{narrative.label}<ArrowUpRight size={17}/></button>
    <div className="story-stage-navigation">
     <span>SELECTED VISUAL STORIES</span>
     <div>
      <button type="button" aria-label="Previous visual" disabled={selected.length<2} onClick={()=>setActive(i=>(i+selected.length-1)%selected.length)}><ArrowLeft size={17}/></button>
      <button type="button" aria-label="Next visual" disabled={selected.length<2} onClick={()=>setActive(i=>(i+1)%selected.length)}><ArrowRight size={17}/></button>
     </div>
    </div>
   </div>
  </div>
  {selected.length>1&&<div className="story-gallery" aria-label={"Explore selected "+captions[category]+" visuals"}>
   {selected.map((pic,i)=><button type="button" key={pic.path} className={"story-gallery-card"+(active===i?" active":"")} onClick={()=>setActive(i)} aria-pressed={active===i} aria-label={"Show "+pic.title.replace(/-/g," ")}>
    <Image src={pic.path} alt="" fill sizes="(max-width:640px) 75vw, (max-width:1050px) 42vw, 28vw" quality={79}/>
    <span className="story-gallery-tint"/>
    <span className="story-gallery-copy"><small>VISUAL {String(i+1).padStart(2,"0")}</small><strong>{pic.title.replace(/-/g," ")}</strong></span>
    <ArrowUpRight className="story-gallery-arrow" size={17}/>
   </button>)}
  </div>}
  <p className="story-visual-disclosure">Visual references illustrate the discipline. Source-backed intelligence, actual measurements and actions are provided in the working studio below.</p>
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
