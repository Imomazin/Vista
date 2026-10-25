'use client';
import {useEffect,useRef,useState} from 'react';
import './callback.css';
type Status='working'|'failed'|'success';
export default function AuthCallback(){
 const started=useRef(false);
 const [status,setStatus]=useState<Status>('working');
 const [message,setMessage]=useState('Verifying your email sign-in with Supabase.');
 useEffect(()=>{
  if(started.current)return;
  started.current=true;
  const values=new URLSearchParams(window.location.hash.replace(/^#/,''));
  const accessToken=values.get('access_token');
  const providerError=values.get('error_description')||values.get('error');
  // Remove the one-use authentication fragment immediately, before any UI is rendered.
  window.history.replaceState(null,'','/auth/callback');
  if(!accessToken){
   setMessage(providerError||'This page was opened without a valid sign-in token. Request a fresh sign-in email from VisTa.');
   setStatus('failed');
   return;
  }
  void(async()=>{
   try{
    const response=await fetch('/api/cloud/session',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     credentials:'same-origin',
     cache:'no-store',
     body:JSON.stringify({action:'accept-link',accessToken})
    });
    const result=await response.json();
    if(!response.ok||!result.signedIn)throw new Error(result.error||'Your sign-in could not be verified.');
    setStatus('success');
    setMessage('Your account has been verified. Opening the VisTa cloud workspace.');
    window.location.replace('/#workspace/connections');
   }catch(e){
    setStatus('failed');
    setMessage(e instanceof Error?e.message:'Unable to verify this sign-in. Request a fresh email.');
   }
  })();
 },[]);
 return <main className="vista-auth-callback">
  <section className="vista-auth-card" aria-live="polite">
   <span className="vista-auth-eyebrow">VIS<span>TA</span> / AUTHENTICATION</span>
   <div className="vista-auth-orb" aria-hidden="true"/>
   <h1>{status==='working'?'Establishing your session':status==='success'?'Identity verified':'Unable to sign in'}</h1>
   <p>{message}</p>
   {status==='working'&&<div className="vista-auth-progress" role="progressbar" aria-label="Verifying session"/>}
   {status==='failed'&&<a className="vista-auth-action" href="/#workspace/connections">Return to VisTa sign-in</a>}
   <small>Your sign-in is verified server-side. Authentication tokens are not retained in browser storage.</small>
  </section>
 </main>;
}
