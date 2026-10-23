'use client';
import { useEffect, useRef, useState } from 'react';
import Pearl from './pearl';

export default function CinematicPearl({motion}:{motion:boolean}) {
 const host=useRef<HTMLDivElement>(null);const moving=useRef(motion);const [ready,setReady]=useState(false);
 useEffect(()=>{moving.current=motion;},[motion]);
 useEffect(()=>{
  let disposed=false;let release=()=>{};
  async function initialise(){
   const [THREE,{RoomEnvironment}]=await Promise.all([import('three'),import('three/examples/jsm/environments/RoomEnvironment.js')]);
   if(disposed||!host.current)return;
   const element=host.current;
   let renderer:InstanceType<typeof THREE.WebGLRenderer>;
   try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return;}
   renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.7));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
   element.appendChild(renderer.domElement);
   const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(0,.15,7.8);
   const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
   const sculpture=new THREE.Group();scene.add(sculpture);
   const pearlMaterial=new THREE.MeshPhysicalMaterial({color:0xa5b9bd,metalness:.65,roughness:.2,clearcoat:1,clearcoatRoughness:.1,iridescence:1,iridescenceIOR:1.4,iridescenceThicknessRange:[180,420]});
   const sphere=new THREE.Mesh(new THREE.SphereGeometry(1.42,64,48),pearlMaterial);sculpture.add(sphere);
   // A closed, bevelled solid with thick shoulders and a sharp lower point.
   const shape=new THREE.Shape();shape.moveTo(-.93,.83);shape.lineTo(-.48,.83);shape.lineTo(0,-.35);shape.lineTo(.48,.83);shape.lineTo(.93,.83);shape.lineTo(.23,-.92);shape.lineTo(-.23,-.92);shape.closePath();
   const geometry=new THREE.ExtrudeGeometry(shape,{depth:.28,bevelEnabled:true,bevelThickness:.065,bevelSize:.055,bevelSegments:4,steps:1,curveSegments:1});
   const face=new THREE.MeshPhysicalMaterial({color:0xe2f0ee,metalness:1,roughness:.21,clearcoat:1});const sides=new THREE.MeshPhysicalMaterial({color:0x526a73,metalness:1,roughness:.26});
   const emblem=new THREE.Mesh(geometry,[face,sides]);emblem.position.z=1.17;sculpture.add(emblem);
   const inset=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x0b2029,metalness:.85,roughness:.3}));inset.scale.set(1.06,1.06,.55);inset.position.z=1.1;sculpture.add(inset);
   const ringMaterial=new THREE.MeshStandardMaterial({color:0x91a9ac,metalness:.9,roughness:.26});
   const rim=new THREE.Mesh(new THREE.TorusGeometry(1.44,.019,12,120),ringMaterial);rim.position.z=.06;sculpture.add(rim);
   const orbit=new THREE.Mesh(new THREE.TorusGeometry(1.9,.008,8,160),new THREE.MeshBasicMaterial({color:0x8ca9a5,transparent:true,opacity:.4}));orbit.rotation.set(1.08,.35,-.45);scene.add(orbit);
   scene.add(new THREE.HemisphereLight(0xd7f9ff,0x19213a,2));
   const key=new THREE.DirectionalLight(0xf3ffed,5);key.position.set(-3,4,4);scene.add(key);
   const edge=new THREE.DirectionalLight(0x9b93ff,4);edge.position.set(4,1,-2);scene.add(edge);
   const strip=new THREE.PointLight(0xc8ffec,35,15);strip.position.set(2,2,4);scene.add(strip);
   const resize=()=>{const w=element.clientWidth,h=element.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(element);resize();
   let frame=0,last=0,elapsed=0;const render=(now:number)=>{if(disposed)return;if(last&&moving.current&&!document.hidden)elapsed+=Math.min((now-last)/1000,.05);last=now;sculpture.rotation.set(.08+Math.sin(elapsed*.32)*.09,Math.sin(elapsed*.36)*.65-.12,-.08+Math.sin(elapsed*.21)*.06);sculpture.position.y=Math.sin(elapsed*.5)*.06;strip.position.x=2+Math.sin(elapsed*.5)*3;renderer.render(scene,camera);frame=requestAnimationFrame(render);};frame=requestAnimationFrame(render);setReady(true);
   release=()=>{cancelAnimationFrame(frame);observer.disconnect();scene.traverse(obj=>{if(obj instanceof THREE.Mesh){obj.geometry.dispose();const materials=Array.isArray(obj.material)?obj.material:[obj.material];materials.forEach(m=>m.dispose());}});environment.dispose();renderer.dispose();renderer.domElement.remove();};
  }
  void initialise().catch(()=>{});return()=>{disposed=true;release();};
 },[]);
 return <div className={`cinematic-pearl ${ready?'is-ready':''}`} role="img" aria-label="Solid bevelled titanium Vista V embossed on a rotating iridescent pearl"><div ref={host} className="cinematic-canvas"/>{!ready&&<Pearl/>}</div>;
}
