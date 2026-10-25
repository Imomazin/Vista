'use client';
import {useState} from "react";
import {ArrowRight,ArrowUpRight,Check,Compass,Crown,ShieldCheck,Sparkles} from "lucide-react";
import {vistaPlans,planDiscount,planTotal,type VisTaPlan} from "@/lib/pricing-plans";
import "./pricing.css";
const icons={basic:Compass,standard:Sparkles,platinum:Crown};
const email="info@ambidexters.com";
function requestUrl(p:VisTaPlan,annual:boolean){
 const subject=encodeURIComponent(p.name+" | Founding access enquiry");
 const body=encodeURIComponent("Hello Ambidexters,\n\nI would like to discuss early access for "+p.name+" ("+(annual?"annual":"monthly")+" proposal). Please share launch availability, confirmed capabilities and onboarding options.\n\nThank you.");
 return "mailto:"+email+"?subject="+subject+"&body="+body;
}
export default function PricingSection(){
 const [annual,setAnnual]=useState(false);
 return <section className="vista-pricing" aria-labelledby="vista-pricing-title">
  <div className="pricing-atmosphere" aria-hidden="true"><i/><i/><i/></div>
  <header className="pricing-header">
   <span className="pricing-eyebrow"><Sparkles size={15}/> THE ECONOMICS OF SUPERIOR INTELLIGENCE</span>
   <h1 id="vista-pricing-title">Intelligence at every stage.<br/><em>Ambition without limits.</em></h1>
   <p>Three distinctive ways into the VisTa universe. Choose your vantage point, grow your intelligence and build towards enterprise scale.</p>
   <div className="pricing-billing" role="group" aria-label="Billing cycle">
    <button type="button" aria-pressed={!annual} className={!annual?"chosen":""} onClick={()=>setAnnual(false)}>Monthly</button>
    <button type="button" aria-pressed={annual} className={annual?"chosen":""} onClick={()=>setAnnual(true)}>Annual <span>Save around 20%</span></button>
   </div>
  </header>
  <div className="pricing-grid">{vistaPlans.map(p=>{
   const Icon=icons[p.id];const price=annual?p.priceAnnualMonthly:p.priceMonthly;
   return <article key={p.id} className={"pricing-card pricing-"+p.id} aria-labelledby={"price-"+p.id}>
     {p.id==="standard"&&<div className="pricing-highlight">RECOMMENDED FOR GROWTH</div>}
     {p.id==="platinum"&&<div className="pricing-crown" aria-hidden="true"><Crown size={100} strokeWidth={.55}/></div>}
     <div className="pricing-card-top"><span className="pricing-tier-icon"><Icon size={23}/></span><span className="pricing-tier-number">{p.id==="basic"?"I":p.id==="standard"?"II":"III"} / VisTa</span></div>
     <h2 id={"price-"+p.id}>{p.name}</h2><p className="pricing-subline">{p.subline}</p>
     <div className="pricing-amount"><span>£</span><strong>{price}</strong><span className="pricing-frequency">/ month</span></div>
     <p className="pricing-bill-note">{annual?"Billed £"+planTotal(p,true).toLocaleString("en-GB")+" annually. Save "+planDiscount(p)+"%.":"Indicative monthly rate. Cancel terms to be confirmed."}</p>
     <p className="pricing-lead">{p.lead}</p>
     <a className="pricing-cta" href={requestUrl(p,annual)} aria-label={"Request a briefing for "+p.name}>Enquire about {p.name.replace("VisTa ","")} <ArrowUpRight size={17}/></a>
     <div className="pricing-inclusions"><span>PROPOSED PLAN INCLUSIONS</span><ul>{p.features.map(f=><li key={f}><Check size={15}/><span>{f}</span></li>)}</ul></div>
     <div className="pricing-card-footer"><ShieldCheck size={16}/><span>{p.projects} {p.projects===1?"brand workspace":"brand workspaces"} · {p.seats} {p.seats===1?"seat":"seats"}</span></div>
    </article>;
  })}</div>
  <div className="pricing-bridge"><span className="pricing-bridge-mark"><ArrowRight size={23}/></span><div><strong>Need something even more ambitious?</strong><p>Dedicated enterprise arrangements, bespoke intelligence integration and implementation-led services can be discussed with Ambidexters.</p></div><a href={"mailto:"+email+"?subject="+encodeURIComponent("VisTa | Enterprise partnership enquiry")}>Discuss enterprise needs <ArrowUpRight size={16}/></a></div>
  <p className="pricing-disclaimer">Founding pricing proposal for discussion, not a live subscription offer. Rates, taxes, annual terms, capacity limits and included capabilities require commercial confirmation. Some features require future integrations and are not yet activated. No payments are collected on this page.</p>
 </section>;
}
