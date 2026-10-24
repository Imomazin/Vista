'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Pause, Play } from 'lucide-react';
import CinematicPearl from './cinematic-pearl';
export default function Experience({navigate,motion,toggleMotion}:{navigate:(view:'command'|'investigation'|'benchmark'|'content'|'workspace')=>void;motion:boolean;toggleMotion:()=>void}) {
 const [entering,setEntering]=useState(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
 function enter(){if(entering)return;if(!motion){navigate('command');return;}setEntering(true);timer.current=setTimeout(()=>navigate('command'),1250);}
 return <section className={`vista-experience question-entrance ${entering?'is-entering':''}`}>
  <div className="experience-noise" aria-hidden="true"/><div className="experience-aurora" aria-hidden="true"/>
  <header className="experience-header"><button className="experience-brand" onClick={()=>navigate('command')}>VISTA<span>®</span></button><span>AN AMBIDEXTERS TECHNOLOGY</span><button className="experience-menu" onClick={()=>navigate('command')}>Go straight in <ArrowUpRight size={18}/></button></header>
  <div className="experience-editorial"><span className="eyebrow">MARKETING SUPERIOR INTELLIGENCE</span><h1>What if your next<br/><em>advantage</em><br/>is hiding in plain sight?</h1><p>See the signals. Connect the dots.<br/>Make your next move with Vista.</p><button className="experience-enter" onClick={enter} disabled={entering}>{entering?'Opening your Vista…':'Reveal your Vista'}<ArrowRight size={23}/></button></div>
  <div className="experience-sculpture"><CinematicPearl motion={motion}/></div>
  <div className="experience-index" aria-hidden="true"><span>V / 001</span><span>A NEW PERSPECTIVE</span></div>
  <div className="entrance-signature"><span>VISIBILITY</span><i/><span>INTELLIGENCE</span><i/><span>ACTION</span></div>
  <footer className="experience-footer"><span>YOUR NEXT MOVE STARTS HERE.</span><button onClick={toggleMotion}>{motion?<Pause size={13}/>:<Play size={13}/>} {motion?'Pause motion':'Play motion'}</button><span>VISTA BY AMBIDEXTERS</span></footer>
 </section>;
}
