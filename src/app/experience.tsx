'use client';
import { useState } from 'react';
import { ArrowUpRight, ArrowRight, Pause, Play } from 'lucide-react';
import Pearl from './pearl';
const destinations = [
 {id:'investigation',name:'Investigate',detail:'Explore a website. Connect the evidence.',number:'01'},
 {id:'benchmark',name:'Compare',detail:'Put three competitors under the same lens.',number:'02'},
 {id:'content',name:'Create',detail:'Shape sharper content and editorial briefs.',number:'03'},
 {id:'workspace',name:'Execute',detail:'Assign, track and verify your next move.',number:'04'}
] as const;
export default function Experience({navigate,motion,toggleMotion}:{navigate:(view:'command'|'investigation'|'benchmark'|'content'|'workspace')=>void;motion:boolean;toggleMotion:()=>void}) {
 const [selected,setSelected]=useState(0);
 return <section className="vista-experience" onPointerMove={e=>{if(!motion||e.pointerType==='touch')return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--field-x',`${(e.clientX-r.left)/r.width*100}%`);e.currentTarget.style.setProperty('--field-y',`${(e.clientY-r.top)/r.height*100}%`);}}>
  <div className="experience-noise" aria-hidden="true"/><div className="experience-aurora" aria-hidden="true"/>
  <header className="experience-header"><button className="experience-brand" onClick={()=>navigate('command')}>VISTA<span>®</span></button><span>AN AMBIDEXTERS TECHNOLOGY</span><button className="experience-menu" onClick={()=>navigate('command')}>Command centre <ArrowUpRight size={18}/></button></header>
  <div className="experience-editorial"><span className="eyebrow">MARKETING SUPERIOR INTELLIGENCE</span><h1>See beyond.<br/><em>Move ahead.</em></h1><p>A wider universe of possibilities.<br/>Your next move starts with a signal.</p></div>
  <div className={`experience-sculpture sculpture-${selected}`}><div className="experience-orbit orbit-a"/><div className="experience-orbit orbit-b"/><div className="experience-orbit orbit-c"/><Pearl/></div>
  <div className="experience-index" aria-hidden="true"><span>V / 001</span><span>THE INTELLIGENCE FIELD</span><span>EXPLORATION MODE</span></div>
  <div className="experience-destination"><span className="eyebrow">EXPLORE / {destinations[selected].number}</span><h2>{destinations[selected].name}<span>.</span></h2><p>{destinations[selected].detail}</p><button className="experience-enter" onClick={()=>navigate(destinations[selected].id)}>Enter {destinations[selected].name.toLowerCase()} <ArrowRight size={24}/></button></div>
  <nav className="experience-selector" aria-label="Explore Vista">{destinations.map((d,i)=><button key={d.id} aria-pressed={selected===i} onClick={()=>setSelected(i)} className={selected===i?'selected':''}><span>{d.number}</span><strong>{d.name}</strong><ArrowUpRight size={17}/></button>)}</nav>
  <footer className="experience-footer"><span>INTELLIGENCE, WITH INTENTION.</span><button onClick={toggleMotion}>{motion?<Pause size={13}/>:<Play size={13}/>} {motion?'Pause motion':'Play motion'}</button><span>SELECT A WORLD. FIND YOUR EDGE.</span></footer>
 </section>;
}
