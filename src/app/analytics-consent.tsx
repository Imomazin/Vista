'use client';
import {useEffect,useState} from 'react';
import './analytics-consent.css';

type Choice='allow'|'reject'|null;
const storageKey='vista-analytics-consent';
const measurementId=process.env.NEXT_PUBLIC_VISTA_GA4_MEASUREMENT_ID||'';
const enabled=/^G-[A-Z0-9]{5,20}$/.test(measurementId);
type AnalyticsWindow=Window&{dataLayer?:unknown[];gtag?:(...args:unknown[])=>void;[key:string]:unknown};

function clearAnalyticsCookies(){
 if(typeof document==='undefined')return;
 const parentDomain=window.location.hostname.endsWith('.ambidexters.com')?'.ambidexters.com':null;
 document.cookie.split(';').forEach(cookie=>{
  const name=cookie.split('=')[0].trim();
  if(!/^(_ga|_gid|_gat)(_|$)/.test(name))return;
  for(const domain of [undefined,parentDomain]){
   document.cookie=name+'=; Max-Age=0; path=/; SameSite=Lax'+(domain?'; domain='+domain:'');
  }
 });
}

export default function AnalyticsConsent(){
 const [choice,setChoice]=useState<Choice>(null);
 const [loaded,setLoaded]=useState(false);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  if(!enabled)return;
  try{
   const raw=localStorage.getItem(storageKey);
   const value:Choice=raw==='allow'||raw==='reject'?raw:null;
   setChoice(value);
   setVisible(!value);
  }catch{setVisible(true);}
 },[]);
 useEffect(()=>{
  if(!enabled||choice!=='allow')return;
  const a=window as AnalyticsWindow;
  a['ga-disable-'+measurementId]=false;
  a.dataLayer=a.dataLayer||[];
  a.gtag=a.gtag||function(...args:unknown[]){a.dataLayer!.push(args);};
  a.gtag('js',new Date());
  a.gtag('config',measurementId,{send_page_view:false,anonymize_ip:true});
  const pageView=()=>{
   const location=window.location.origin+window.location.pathname;
   const view=new URLSearchParams({view:window.location.hash.replace(/^#/,'').slice(0,80)});
   a.gtag?.('event','page_view',{page_location:location+'?'+view.toString(),page_title:document.title});
  };
  let script=document.querySelector<HTMLScriptElement>('script[data-vista-analytics]');
  if(!script){
   script=document.createElement('script');
   script.async=true;
   script.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurementId);
   script.dataset.vistaAnalytics='enabled';
   document.head.appendChild(script);
  }
  pageView();
  window.addEventListener('hashchange',pageView);
  setLoaded(true);
  return()=>{window.removeEventListener('hashchange',pageView);};
 },[choice]);
 function decide(next:Exclude<Choice,null>){
  if(!enabled)return;
  try{localStorage.setItem(storageKey,next);}catch{/* Consent is still enforced in memory. */}
  setChoice(next);
  setVisible(false);
  if(next==='reject'){
   (window as AnalyticsWindow)['ga-disable-'+measurementId]=true;
   clearAnalyticsCookies();
   document.querySelector<HTMLScriptElement>('script[data-vista-analytics]')?.remove();
   setLoaded(false);
  }
 }
 if(!enabled)return null;
 return <>
  {!visible&&<button className="vista-analytics-pref" type="button" onClick={()=>setVisible(true)} aria-label="Review analytics cookie preferences">Analytics preferences</button>}
  {visible&&<section className="vista-analytics-consent" role="dialog" aria-modal="false" aria-label="Optional website analytics cookies">
   <div className="vista-analytics-copy"><strong>Help us improve VisTa</strong><p>We use optional Google Analytics cookies to understand visits and improve the experience. Analytics stays off until you choose to allow it. You can change your choice anytime.</p>
   <a href="/analytics-privacy">How VisTa uses analytics</a></div>
   <div className="vista-analytics-actions">
    <button type="button" onClick={()=>decide('reject')}>Reject analytics</button>
    <button type="button" onClick={()=>decide('allow')}>Allow analytics</button>
   </div>
  </section>}
  {loaded&&<span className="sr-only" role="status">Optional analytics are active with your permission.</span>}
 </>;
}
