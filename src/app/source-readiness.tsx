'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,RefreshCw,PlugZap} from 'lucide-react';
import {parseReadiness,sourceDefinitions,sourcePresentation,type Readiness} from '@/lib/source-readiness';
import './source-readiness.css';
export default function SourceReadiness({onOpen}:{onOpen:()=>void}){
 const [data,setData]=useState<Readiness|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[checked,setChecked]=useState('');
 const request=useRef<AbortController|null>(null);
 async function refresh(){
  request.current?.abort();const controller=new AbortController();request.current=controller;
  setBusy(true);setError('');setData(null);setChecked('');
  const timeout=window.setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('/api/integrations',{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Source configuration is temporarily unavailable.');
   const next=parseReadiness(await response.json());
   if(request.current===controller&&!controller.signal.aborted){setData(next);setChecked(new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}));}
  }catch(e){if(request.current===controller)setError(controller.signal.aborted?'The status check timed out. Try again.':e instanceof Error?e.message:'Source configuration is unavailable.');}
  finally{window.clearTimeout(timeout);if(request.current===controller)setBusy(false);}
 }
 useEffect(()=>{void refresh();return()=>{const active=request.current;request.current=null;active?.abort();};},[]);
 const configured=data?Object.values(data).filter(Boolean).length:0;
 return <section className="source-readiness" aria-label="Connected intelligence readiness" aria-busy={busy}>
  <div className="source-readiness-heading"><div><span className="pulse-overline">CONNECTED INTELLIGENCE</span><h3>Activate your sources</h3></div><PlugZap size={20}/></div>
  <div className="source-readiness-summary"><span>{busy?'Checking configuration…':data?`${configured} of 4 sources configured`:'Configuration not verified'}</span><button type="button" onClick={()=>void refresh()} disabled={busy} aria-label="Refresh source configuration"><RefreshCw size={14}/> Refresh</button></div>
  <div className="source-readiness-list">{sourceDefinitions.map(source=>{const state=sourcePresentation(data?.[source.id]);return <article key={source.id} className={'source-readiness-row '+state.tone}>
   <div className="source-readiness-name"><span className="source-readiness-dot" aria-hidden="true"/><h4>{source.name}</h4><span className="source-readiness-badge">{busy?'Checking…':state.label}</span></div>
   <p>{source.purpose}</p><div className="source-readiness-next"><small>{data?.[source.id]?source.next:data?.[source.id]===false?'Authorised provider credentials are required.':'Open Connections to inspect source access.'}</small><button type="button" onClick={onOpen} aria-label={`${state.action}: ${source.name}`}>{state.action}<ArrowUpRight size={13}/></button></div>
  </article>;})}</div>
  {error&&<p className="source-readiness-error" role="alert">{error}</p>}
  <p className="source-readiness-footnote" role="status">{checked?`Configuration checked at ${checked}. `:''}Deployment-wide configuration. Credentials alone do not verify access or available data. Project evidence is shown separately.</p>
 </section>;
}
