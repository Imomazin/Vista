'use client';
import {useRef,useState} from "react";
import {ArrowRight,BookOpen,CheckCircle2,Clock3,ExternalLink,FileText,Film,Play,ShieldCheck} from "lucide-react";
import "./watch-demo.css";

const film="https://pusbuucyprqbblfginbl.supabase.co/storage/v1/object/public/vista-media/vista-walkthrough.mp4";
const chapters=[
 {time:0,title:"The VisTa vision",detail:"Nine intelligence disciplines. One connected decision-making journey.",route:"engines",label:"Explore nine engines"},
 {time:50,title:"Search and discoverability",detail:"Why technical evidence is different from verified Search Console metrics.",route:"engines/1",label:"Open Search Visibility"},
 {time:100,title:"Live Site Intelligence",detail:"The actual Ambidexters homepage HTML audit: 89 / 100.",route:"audit",label:"Run live audit"},
 {time:150,title:"Comparison and market context",detail:"Ambidexters, SkillHubs and ImpactCity received 89 on different HTML findings.",route:"benchmark",label:"Open comparison"},
 {time:200,title:"Content intelligence",detail:"Evidence-informed writing, structure analysis and editorial hand-off.",route:"content",label:"Open content editor"},
 {time:250,title:"Trust and reputation",detail:"Record sourced claims, authority gaps and human-reviewed actions.",route:"engines/5",label:"Open authority engine"},
 {time:300,title:"Projects and execution",detail:"Save audit evidence locally, then convert issues into accountable work.",route:"workspace/projects",label:"Open projects"},
 {time:350,title:"Measurements and decisions",detail:"Compare dated evidence responsibly; never confuse HTML scores with revenue.",route:"measurements",label:"Open measurements"},
 {time:400,title:"AI exposure and GEO",detail:"The real workflow for prompts, answers and dated citations.",route:"workspace/ai-exposure",label:"Open AI ledger"},
 {time:450,title:"Cloud security and governance",detail:"Verified VisTa owner, organisational membership and checkpoint backups.",route:"workspace/connections",label:"Open connections"},
 {time:500,title:"Founding commercial plans",detail:"Basic, Standard and Platinum are proposals, not active billing subscriptions.",route:"pricing",label:"Review pricing"},
 {time:550,title:"Your first client engagement",detail:"Start with a real public-page audit, clarify limitations, agree next decisions.",route:"audit",label:"Launch your first audit"}
] as const;

export default function WatchDemo(){
 const video=useRef<HTMLVideoElement>(null);
 const [active,setActive]=useState(0);
 const [videoError,setVideoError]=useState(false);
 function jump(index:number){setActive(index);if(video.current){video.current.currentTime=chapters[index].time;void video.current.play().catch(()=>{});}}
 return <section className="demo-theatre">
  <header className="demo-head">
   <span className="demo-kicker"><Film size={16}/> VISTA / THE CLIENT EXPERIENCE</span>
   <h1>Watch the <em>demo.</em></h1>
   <p>A guided, ten-minute introduction to VisTa’s nine-engine marketing intelligence ecosystem. See what works today, the evidence behind it and the integrations planned next.</p>
   <div className="demo-facts"><span><Clock3 size={15}/> 10-minute video</span><span><CheckCircle2 size={15}/> Real website findings</span><span><ShieldCheck size={15}/> Limitations stated openly</span></div>
  </header>
  <div className="demo-columns">
   <div className="demo-primary">
    <div className="demo-player-frame">
     <video ref={video} controls playsInline preload="metadata" poster="/web-images/cinematic/immersive-executive-command-centre.jpg" aria-label="VisTa ten-minute narrated guided walkthrough" onTimeUpdate={e=>{const t=e.currentTarget.currentTime;const index=Math.min(chapters.length-1,Math.floor(t/50));if(index!==active)setActive(index);}} onError={()=>setVideoError(true)}>
      <source src={film} type="video/mp4"/>
      <track kind="captions" src="/vista-demo-captions.vtt" srcLang="en" label="English" default/>
      Your browser does not support video playback.
     </video>
    </div>
    {videoError&&<p className="demo-playback-notice" role="status">The hosted video could not be loaded here. <a href={film} target="_blank" rel="noopener noreferrer">Open the video directly</a>, or use the interactive chapter links below.</p>}
    <div className="demo-live-bridge"><div><span className="demo-kicker">LIVE / TRY IT YOURSELF</span><h2>Prefer evidence to a pitch?</h2><p>Run a real public-website HTML audit now. No account is required for this limited tool.</p></div><a href="#audit">Launch live website audit <ArrowRight size={16}/></a></div>
    <details className="demo-transcript"><summary><BookOpen size={16}/> Video overview and evidence notes</summary>
     <p>The presentation uses verified public-website HTML observations, a transparent nine-check scoring method and real VisTa workflows. Graphics and illustrative transitions are explanatory; they do not represent an authenticated analytics data feed. A live Google Search Console, GA4, HubSpot or AI model connection is not implied.</p>
     <p>For the 25 October 2026 verification, Ambidexters, SkillHubs and ImpactCity each scored 89/100 in the single-page HTML checks, with different improvements identified. Scores are not search rankings or commercial performance measurements.</p>
    </details>
   </div>
   <aside className="demo-chapters" aria-label="Video chapters">
    <div className="demo-chapters-head"><span className="demo-kicker">THE TEN-MINUTE TOUR</span><strong>12 chapters</strong></div>
    {chapters.map((chapter,index)=><div className={"demo-chapter "+(active===index?"demo-chapter-active":"")} key={chapter.time}>
     <button type="button" onClick={()=>jump(index)} aria-current={active===index?"step":undefined}><span className="demo-chapter-time">{Math.floor(chapter.time/60).toString().padStart(2,"0")}:{(chapter.time%60).toString().padStart(2,"0")}</span><span className="demo-chapter-content"><strong>{chapter.title}</strong><small>{chapter.detail}</small></span><Play size={14}/></button>
     {active===index&&<a href={"#"+chapter.route}>{chapter.label} <ExternalLink size={13}/></a>}
    </div>)}
   </aside>
  </div>
  <div className="demo-evidence-note"><FileText size={18}/><span>Client-demo edition. The video is a narrated, illustrated product tour based on tested VisTa functions. Interactive applications and source access are explicitly distinguished from visual concepts. Commercial pricing is indicative only.</span></div>
 </section>;
}
