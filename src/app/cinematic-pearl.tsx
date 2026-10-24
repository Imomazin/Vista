'use client';
import { useEffect, useRef, useId } from 'react';

type Point = {x:number;y:number;z:number};
type Face = {points:Point[];kind:'face'|'bevel'|'side'};
const outline=[[-1.04,.91],[-.43,.91],[0,-.25],[.43,.91],[1.04,.91],[.28,-1.02],[-.28,-1.02]];
// Inset each edge, then intersect neighbours to form a continuous machined bevel.
function insetPolygon(points:number[][],distance:number){
 const lines=points.map((p,i)=>{const q=points[(i+1)%points.length],dx=q[0]-p[0],dy=q[1]-p[1],length=Math.hypot(dx,dy);return{x:p[0]+dy/length*distance,y:p[1]-dx/length*distance,dx,dy};});
 return lines.map((b,i)=>{const a=lines[(i+lines.length-1)%lines.length],cross=a.dx*b.dy-a.dy*b.dx;const t=((b.x-a.x)*b.dy-(b.y-a.y)*b.dx)/cross;return[a.x+t*a.dx,a.y+t*a.dy];});
}
const inset=insetPolygon(outline,.065);
const vertex=(p:number[],z:number):Point=>({x:p[0],y:p[1],z});
const mesh:Face[]=[{points:inset.map(p=>vertex(p,.43)),kind:'face'},{points:inset.map(p=>vertex(p,-.43)).reverse(),kind:'face'}];
for(let i=0;i<outline.length;i++){
 const j=(i+1)%outline.length;
 mesh.push({points:[vertex(outline[i],-.34),vertex(outline[j],-.34),vertex(outline[j],.34),vertex(outline[i],.34)],kind:'side'});
 mesh.push({points:[vertex(outline[i],.34),vertex(outline[j],.34),vertex(inset[j],.43),vertex(inset[i],.43)],kind:'bevel'});
 mesh.push({points:[vertex(outline[j],-.34),vertex(outline[i],-.34),vertex(inset[i],-.43),vertex(inset[j],-.43)],kind:'bevel'});
}

export default function CinematicPearl({motion}:{motion:boolean}){
 const gradientId=useId().replaceAll(":", "");
 const canvas=useRef<HTMLCanvasElement>(null);const moving=useRef(motion);
 useEffect(()=>{moving.current=motion;},[motion]);
 useEffect(()=>{
  const target=canvas.current;if(!target)return;const el=target;const ctx=el.getContext('2d');if(!ctx)return;
  let width=1,height=1,frame=0,last=0,elapsed=0,dirty=true;let pointerYaw=0,pointerPitch=0,targetYaw=0,targetPitch=0;const ratio=Math.min(window.devicePixelRatio||1,2);
  const resize=()=>{const box=el.getBoundingClientRect();width=box.width;height=box.height;if(width<1||height<1)return;const w=Math.round(width*ratio),h=Math.round(height*ratio);if(el.width!==w)el.width=w;if(el.height!==h)el.height=h;dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(el);resize();
  function draw(time:number){
   if(!ctx||width<1||height<1)return;
   ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
   const unit=Math.min(width,height)*.255,cx=width*.5,cy=height*.48+Math.sin(time*.9)*unit*.035,r=unit*1.52;
   const glow=ctx.createRadialGradient(cx,cy,r*.5,cx,cy,r*1.5);glow.addColorStop(0,'#b6ffe91a');glow.addColorStop(.7,'#939bdf10');glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
   // Iridescent pearl shell. The V is the solid, fully closed metal core.
   const pearl=ctx.createRadialGradient(cx-r*.45,cy-r*.6,r*.02,cx,cy,r);pearl.addColorStop(0,'#d9fff147');pearl.addColorStop(.24,'#648b864a');pearl.addColorStop(.55,'#172c32d9');pearl.addColorStop(.82,'#3c4258e8');pearl.addColorStop(.94,'#b6b5da99');pearl.addColorStop(1,'#d7f6e5b3');ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=pearl;ctx.fill();
   const ring=ctx.createLinearGradient(cx-r,cy-r,cx+r,cy+r);ring.addColorStop(0,'#e5fffabf');ring.addColorStop(.35,'#a2c2c622');ring.addColorStop(.7,'#baaeff88');ring.addColorStop(1,'#e5fffabf');ctx.strokeStyle=ring;ctx.lineWidth=1.3;ctx.stroke();
   ctx.save();ctx.translate(cx,cy);ctx.rotate(-.4);ctx.scale(1,.34);ctx.beginPath();ctx.arc(0,0,r*1.2,0,Math.PI*2);ctx.strokeStyle='#b8e6d84a';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
   // One complete turn per twelve seconds, with a smooth frontal pause.
   const phase=(time%12)/12;const yaw=-.42+Math.PI*2*(phase-Math.sin(phase*Math.PI*2)*.11)+pointerYaw;const pitch=.17+Math.sin(time*.65)*.07+pointerPitch;const roll=-.10;
   const transform=(p:Point)=>{const x=p.x*Math.cos(yaw)+p.z*Math.sin(yaw),z=-p.x*Math.sin(yaw)+p.z*Math.cos(yaw),y=p.y*Math.cos(pitch)-z*Math.sin(pitch),depth=p.y*Math.sin(pitch)+z*Math.cos(pitch);return{x:x*Math.cos(roll)-y*Math.sin(roll),y:x*Math.sin(roll)+y*Math.cos(roll),z:depth};};
   const project=(p:Point)=>{const scale=5/(5-p.z);return{x:cx+p.x*unit*scale,y:cy-p.y*unit*scale};};
   const surfaces=mesh.map(f=>{const points=f.points.map(transform);const a=points[0],b=points[1],c=points[2];const u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-b.x,y:c.y-b.y,z:c.z-b.z};let normal={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};const length=Math.hypot(normal.x,normal.y,normal.z);normal={x:normal.x/length,y:normal.y/length,z:normal.z/length};return{...f,points,normal,depth:points.reduce((n,p)=>n+p.z,0)/points.length};}).sort((a,b)=>a.depth-b.depth);
   // Painter ordering retains the closed back, sidewalls, and bevels through a full turn.
   for(const surface of surfaces){
    const p=surface.points.map(project);ctx.beginPath();p.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();
    const n=surface.normal;const light=Math.abs(n.x*-.42+n.y*.64+n.z*.66);const brightness=.4+.6*light;
    const colour=(v:number,tint=0)=>`rgb(${Math.round(v*brightness)} ${Math.round((v+8)*brightness)} ${Math.round((v+12+tint)*brightness)})`;
    const gradient=ctx.createLinearGradient(cx-unit*1.1,cy-unit*1.2,cx+unit,cy+unit);
    if(surface.kind==='face'){gradient.addColorStop(0,'#f3ffff');gradient.addColorStop(.24,colour(211));gradient.addColorStop(.44,colour(116));gradient.addColorStop(.48,'#f7ffff');gradient.addColorStop(.56,colour(218));gradient.addColorStop(.82,colour(143,10));gradient.addColorStop(1,'#e2fffa');}
    else if(surface.kind==='bevel'){gradient.addColorStop(0,colour(250));gradient.addColorStop(.42,colour(157));gradient.addColorStop(.7,colour(237));gradient.addColorStop(1,colour(93));}
    else{gradient.addColorStop(0,colour(106));gradient.addColorStop(.4,colour(42));gradient.addColorStop(.72,colour(132,8));gradient.addColorStop(1,colour(61));}
    ctx.fillStyle=gradient;ctx.fill();ctx.lineWidth=.65;ctx.strokeStyle=surface.kind==='side'?'#859ca366':'#efffff66';ctx.stroke();
   }
   // Moving specular edge around the pearl, independent of the core rotation.
   ctx.beginPath();ctx.arc(cx,cy,r-2,-2.8+time*.38,-2.1+time*.38);ctx.strokeStyle='#d9fff8';ctx.shadowColor='#b4ffe7';ctx.shadowBlur=14;ctx.lineWidth=2;ctx.stroke();ctx.shadowBlur=0;
   for(let i=0;i<3;i++){const angle=time*.45+i*2.1;const x=cx+Math.cos(angle)*r*1.2,y=cy+Math.sin(angle)*r*.4;ctx.beginPath();ctx.arc(x,y,i===0?3:1.5,0,Math.PI*2);ctx.fillStyle=i===0?'#d6ffed':'#a5bbdb';ctx.fill();}
   const floor=ctx.createRadialGradient(cx,cy+r*1.27,0,cx,cy+r*1.27,r*.7);floor.addColorStop(0,'#9bd7c32e');floor.addColorStop(1,'#9bd7c300');ctx.save();ctx.translate(0,(cy+r*1.27)*.88);ctx.scale(1,.12);ctx.fillStyle=floor;ctx.fillRect(cx-r,0,r*2,height*10);ctx.restore();
   el.dataset.rotation=String(Math.round(phase*360));
  }
  const scene=el.closest<HTMLElement>('.premium-entrance');
  const pointerMove=(event:PointerEvent)=>{if(!moving.current||event.pointerType==='touch')return;const bounds=el.getBoundingClientRect();if(!bounds.width||!bounds.height)return;targetYaw=Math.max(-.25,Math.min(.25,((event.clientX-bounds.left)/bounds.width-.5)*.35));targetPitch=Math.max(-.11,Math.min(.11,-((event.clientY-bounds.top)/bounds.height-.5)*.22));};
  const pointerLeave=()=>{targetYaw=0;targetPitch=0;};
  scene?.addEventListener('pointermove',pointerMove);scene?.addEventListener('pointerleave',pointerLeave);
  function tick(now:number){const delta=last?Math.min((now-last)/1000,.06):0;last=now;if(moving.current&&!document.hidden){elapsed+=delta;pointerYaw+=(targetYaw-pointerYaw)*Math.min(1,delta*4);pointerPitch+=(targetPitch-pointerPitch)*Math.min(1,delta*4);dirty=true;}if(dirty){draw(elapsed);dirty=false;}frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(frame);observer.disconnect();scene?.removeEventListener('pointermove',pointerMove);scene?.removeEventListener('pointerleave',pointerLeave);};
 },[]);
 return <div className="cinematic-pearl is-ready solid-core"><svg className="pearl-resilience" viewBox="0 0 640 760" aria-hidden="true"><defs>
  <radialGradient id={gradientId+'shell'} cx="30%" cy="20%"><stop stopColor="#819b95"/><stop offset=".38" stopColor="#253d3f"/><stop offset=".8" stopColor="#131e27"/><stop offset="1" stopColor="#9ca7bf"/></radialGradient>
  <linearGradient id={gradientId+'metal'} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f3fffb"/><stop offset=".3" stopColor="#a3babd"/><stop offset=".48" stopColor="#435d68"/><stop offset=".51" stopColor="#f4ffff"/><stop offset=".76" stopColor="#99aab8"/><stop offset="1" stopColor="#ecfff5"/></linearGradient>
  <linearGradient id={gradientId+'edge'}><stop stopColor="#263d48"/><stop offset=".5" stopColor="#b1ceca"/><stop offset="1" stopColor="#344652"/></linearGradient>
 </defs><circle cx="320" cy="365" r="247" fill={'url(#'+gradientId+'shell)'} stroke="#afc7c8" strokeWidth="1"/><ellipse cx="320" cy="365" rx="292" ry="89" transform="rotate(-22 320 365)" fill="none" stroke="#a4d4c5" opacity=".3"/>
 <g className="pearl-relief"><path d="M139 224 L217 224 L313 422 L389 224 L469 224 L352 527 L275 527 Z" transform="translate(24 22)" fill={'url(#'+gradientId+'edge)'} stroke="#b0c2c9"/><path d="M139 224 L217 224 L313 422 L389 224 L469 224 L352 527 L275 527 Z" fill={'url(#'+gradientId+'metal)'} stroke="#e1f7ed" strokeWidth="4"/><path d="M151 235 L207 235 L313 450 L398 235 L454 235 L344 515 L283 515 Z" fill="none" stroke="#e9fff4" opacity=".45" strokeWidth="2"/></g></svg><canvas ref={canvas} className="solid-v-canvas" role="img" aria-label="Solid titanium VisTa V with deep sidewalls and polished bevels, turning through 360 degrees inside an iridescent pearl"/></div>;
}
