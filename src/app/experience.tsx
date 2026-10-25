'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Pause, Play, Radar, ScanLine, X, Crosshair, Layers3 } from 'lucide-react';
import CinematicPearl from './cinematic-pearl';
import TitaniumSignalField from './titanium-signal-field';
import {AmbidextersLogo} from './visual-stories';
import AppearanceSwitch from './appearance-switch';
import type {Appearance} from '@/lib/appearance';
import {VisTaMorph,VisTaMark} from './ecosystem';
import './experience-premium.css';

type Destination='command'|'investigation'|'benchmark'|'content'|'workspace'|'engines';
export default function Experience({navigate,motion,toggleMotion,appearance,onAppearanceChange}:{navigate:(view:Destination)=>void;motion:boolean;toggleMotion:()=>void;appearance:Appearance;onAppearanceChange:(next:Appearance)=>void}) {
 const [entering,setEntering]=useState(false);const [revealing,setRevealing]=useState(false);
 const [preview,setPreview]=useState(false);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setPreview(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 function enter(){
  if(entering)return;
  if(!motion){navigate('engines');return;}
  setPreview(false);setEntering(true);setRevealing(true);
  timer.current=setTimeout(()=>navigate('engines'),3450);
 }
 useEffect(()=>{if(!revealing)return;const exit=(event:KeyboardEvent)=>{if(event.key==='Escape'){if(timer.current)clearTimeout(timer.current);navigate('engines');}};window.addEventListener('keydown',exit);return()=>window.removeEventListener('keydown',exit);},[revealing,navigate]);
 function go(to:Destination){setPreview(false);navigate(to);}
 return <section className={'vista-experience question-entrance premium-entrance '+(entering?'is-entering':'')}
  onPointerMove={event=>{if(!motion||event.pointerType==='touch')return;const r=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--scene-x',((event.clientX-r.left)/r.width*100)+'%');event.currentTarget.style.setProperty('--scene-y',((event.clientY-r.top)/r.height*100)+'%');}}
  onPointerLeave={event=>{event.currentTarget.style.setProperty('--scene-x','72%');event.currentTarget.style.setProperty('--scene-y','52%');}}>
  <div className="experience-noise" aria-hidden="true"/><div className="experience-aurora" aria-hidden="true"/><TitaniumSignalField/>
  <div className="entrance-stage-grid" aria-hidden="true"/><div className="entrance-stage-beam" aria-hidden="true"/>
  <div className="entrance-reticle reticle-left" aria-hidden="true"/><div className="entrance-reticle reticle-right" aria-hidden="true"/>
  <header className="experience-header">
   <button className="experience-brand" onClick={()=>go('command')}><VisTaMark/><span>™</span></button>
   <div className="ax-attribution"><AmbidextersLogo compact/><span>AN AMBIDEXTERS TECHNOLOGY</span></div>
   <div className="experience-header-actions"><AppearanceSwitch appearance={appearance} onChange={onAppearanceChange}/><button className="experience-menu" onClick={()=>go('command')}>Go straight in <ArrowUpRight size={18}/></button></div>
  </header>
  <div className="experience-editorial">
   <span className="eyebrow">MARKETING SUPERIOR INTELLIGENCE</span>
   <h1>What if your next<br/><em>advantage</em><br/>is hiding in plain sight?</h1>
   <p>See the signals. Connect the dots.<br/>Make your next move with VisTa.</p>
   <div className="entrance-actions">
    <button className="experience-enter" onClick={enter} disabled={entering}>{entering?'Opening your VisTa…':'Reveal your VisTa'}<ArrowRight size={23}/></button>
    <button className="entrance-preview-trigger" onClick={()=>setPreview(v=>!v)} aria-expanded={preview} aria-controls="vista-entrance-preview">{preview?'Close preview':'Explore the intelligence'}<ArrowUpRight size={15}/></button>
   </div>
   <span className="entrance-footnote"><span/> OBSERVE / INTERPRET / ACT / VERIFY</span>
  </div>
  <div className="experience-sculpture"><CinematicPearl motion={motion} appearance={appearance}/></div>
  <div className="experience-index" aria-hidden="true"><span>V / 001</span><span>A NEW PERSPECTIVE</span></div>
  <div className="entrance-signature"><span>VISIBILITY</span><i/><span>INTELLIGENCE</span><i/><span>ACTION</span></div>
  <div className="entrance-status" aria-hidden="true"><i/> SYSTEM / READY TO EXPLORE</div>
  {preview&&<div className="entrance-preview-panel" id="vista-entrance-preview">
   <div className="preview-heading"><span className="eyebrow"><Radar size={13}/> THREE WAYS IN</span><button onClick={()=>setPreview(false)} aria-label="Close preview"><X size={16}/></button></div>
   <button onClick={()=>go('investigation')}><span><ScanLine size={18}/></span><div><strong>Investigate a website</strong><small>Follow technical signals across your pages.</small></div><ArrowUpRight size={15}/></button>
   <button onClick={()=>go('benchmark')}><span><Crosshair size={18}/></span><div><strong>Compare your market</strong><small>Measure observable HTML differences.</small></div><ArrowUpRight size={15}/></button>
   <button onClick={()=>go('workspace')}><span><Layers3 size={18}/></span><div><strong>Make intelligence actionable</strong><small>Save evidence, organise tasks and verify work.</small></div><ArrowUpRight size={15}/></button>
   <p>Available tools use observed website data and your saved workspace.</p>
  </div>}
  {revealing&&<VisTaMorph motion={motion} onContinue={()=>{if(timer.current)clearTimeout(timer.current);navigate("engines");}}/>}
  <footer className="experience-footer"><span>YOUR NEXT MOVE STARTS HERE.</span><button onClick={toggleMotion}>{motion?<Pause size={13}/>:<Play size={13}/>} {motion?'Pause motion':'Play motion'}</button><span>VisTa BY AMBIDEXTERS</span></footer>
 </section>;
}
