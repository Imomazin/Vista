'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,CheckCircle2,KeyRound,Mail,ShieldCheck} from 'lucide-react';
import '../auth/callback/callback.css';
import './login.css';

type Session={configured:boolean;authenticated:boolean;email?:string;memberships?:{organisation_id:string;role:string;vista_organisations:{name:string}}[]};
type Stage='checking'|'ready'|'sent'|'connected'|'unavailable';

async function api(path:string,init?:RequestInit){
 const res=await fetch(path,{...init,cache:'no-store',credentials:'same-origin'});
 const data=await res.json();
 if(!res.ok)throw new Error(data.error||'Unable to complete this request.');
 return data;
}
export default function VisTaLogin(){
 const [email,setEmail]=useState('Ambidexters.llc@gmail.com');
 const [stage,setStage]=useState<Stage>('checking');
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [code,setCode]=useState('');
 const [session,setSession]=useState<Session|null>(null);
 useEffect(()=>{let active=true;
  api('/api/cloud/session').then((s:Session)=>{if(!active)return;setSession(s);setStage(!s.configured?'unavailable':s.authenticated?'connected':'ready');}).catch(()=>{if(active){setStage('unavailable');setMessage('Unable to check VisTa cloud access. Please try again.');}});
  return()=>{active=false;};
 },[]);
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   const result=await api('/api/cloud/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'request-code',email:email.trim()})});
   setStage('sent');setMessage(result.message||'Check your email for a VisTa sign-in link.');
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to request a sign-in email.');}
  finally{setBusy(false);}
 }
 async function verify(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  try{
   const result=await api('/api/cloud/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',email:email.trim(),code:code.trim()})});
   if(!result.signedIn)throw Error('The code could not be verified.');
   window.location.replace('/#workspace/connections');
  }catch(e){setMessage(e instanceof Error?e.message:'The email code could not be verified.');}
  finally{setBusy(false);}
 }
 return <main className="vista-auth-callback vista-login-screen">
  <section className="vista-auth-card vista-login-card" aria-live="polite">
   <div className="vista-login-brand"><span className="vista-auth-eyebrow">VIS<span>TA</span> / SECURE ACCESS</span><span className="vista-login-badge"><ShieldCheck size={14}/> Supabase verified identity</span></div>
   <div className="vista-auth-orb" aria-hidden="true"/>
   <h1>{stage==='connected'?'Welcome back.':stage==='sent'?'Check your inbox.':'Your intelligence. Securely connected.'}</h1>
   <p className="vista-login-lede">{stage==='connected'?'Your VisTa account is authenticated. Open the workspace to review your organisation and cloud data.':stage==='sent'?'We have requested a sign-in email for your VisTa account. Open the newest message from Supabase and follow its secure link to return to VisTa.':'Use your approved Ambidexters account to access secure workspaces, saved evidence and live provider connections.'}</p>
   {stage==='checking'&&<p className="vista-login-status">Checking secure workspace access…</p>}
   {stage==='unavailable'&&<div className="vista-login-alert" role="alert">Cloud authentication is temporarily unavailable. {message}</div>}
   {stage==='connected'&&<div className="vista-login-signed-in"><CheckCircle2 size={21}/><div><strong>{session?.email||'Verified user'}</strong><span>{session?.memberships?.[0]?.vista_organisations?.name||'VisTa workspace'} · {session?.memberships?.[0]?.role||'Signed in'}</span></div></div>}
   {stage==='ready'&&<form className="vista-login-form" onSubmit={send}><label htmlFor="vista-email">Administrator email</label><input id="vista-email" type="email" value={email} required maxLength={254} autoComplete="email" onChange={e=>setEmail(e.target.value)}/><button disabled={busy} type="submit"><Mail size={18}/>{busy?'Requesting sign-in email…':'Email me a secure sign-in link'}<ArrowRight size={17}/></button></form>}
   {stage==='sent'&&<div className="vista-login-delivery"><p className="vista-login-status"><Mail size={16}/> Email requested for <strong>{email}</strong></p><p>Open the latest sign-in email in your browser. The link expires, so please use a fresh message rather than your earlier invitation.</p><details><summary>Received a six-digit code instead?</summary><form onSubmit={verify} className="vista-login-form"><label htmlFor="vista-otp">Email verification code</label><input id="vista-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" value={code} required onChange={e=>setCode(e.target.value)}/><button type="submit" disabled={busy}>{busy?'Verifying code…':'Verify and enter VisTa'}<ArrowRight size={16}/></button></form></details><button className="vista-login-reset" type="button" onClick={()=>{setStage('ready');setCode('');setMessage('');}}>Use another email or request a new link</button></div>}
   {message&&stage!=='unavailable'&&stage!=='sent'&&<p className="vista-login-feedback" role="status">{message}</p>}
   <a className="vista-login-back" href="/#workspace/connections">{stage==='connected'?'Open my VisTa workspace':'Return to VisTa workspace'} <ArrowRight size={15}/></a>
   <small>VisTa uses verified Supabase accounts. Your password and login token are not stored in your browser workspace. Website hosting and GitHub ownership remain separate.</small>
  </section>
 </main>;
}
