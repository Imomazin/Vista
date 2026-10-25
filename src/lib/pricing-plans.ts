export type VisTaPlanId="basic"|"standard"|"platinum";
export type VisTaPlan={
 id:VisTaPlanId;name:string;subline:string;who:string;
 priceMonthly:number;priceAnnualMonthly:number;projects:number;seats:number;
 lead:string;features:readonly string[];accent:string;
};
export const vistaPlans:readonly VisTaPlan[]=[
 {id:"basic",name:"VisTa Basic",subline:"The essential intelligence advantage",who:"Founders, creators and small businesses",
  priceMonthly:49,priceAnnualMonthly:39,projects:1,seats:1,accent:"titanium",
  lead:"Understand your digital presence. Identify where to move next.",
  features:["One brand workspace","Website intelligence and evidence-led site audits","Search visibility and opportunity reviews","Content intelligence and editorial briefs","Manual AI-exposure observation ledger","Action register and evidence export"]},
 {id:"standard",name:"VisTa Standard",subline:"Connected marketing intelligence",who:"Growing businesses and ambitious marketing teams",
  priceMonthly:149,priceAnnualMonthly:119,projects:5,seats:3,accent:"emerald",
  lead:"See the connections. Turn evidence into coordinated strategic action.",
  features:["Everything in VisTa Basic","Five brand workspaces and three team seats","Advanced comparative intelligence views","Search, site, authority and reputation studios","Analytics import, attribution context and impact reviews","Expanded content and AI-exposure workflows","Team decision, review and action capabilities"]},
 {id:"platinum",name:"VisTa Platinum",subline:"The executive intelligence universe",who:"Agencies, multi-brand groups and executive teams",
  priceMonthly:399,priceAnnualMonthly:319,projects:20,seats:10,accent:"violet",
  lead:"Orchestrate superior intelligence across brands, markets and teams.",
  features:["Everything in VisTa Standard","Up to twenty brand workspaces and ten team seats","Executive command and agency operations","Cross-brand intelligence and strategic oversight","Advanced evidence and decision governance","Priority onboarding and implementation support","Enterprise integrations and bespoke capacity scoping"]}
];
export function planTotal(plan:VisTaPlan,annual:boolean){return (annual?plan.priceAnnualMonthly:plan.priceMonthly)*(annual?12:1);}
export function planDiscount(plan:VisTaPlan){return Math.round((1-plan.priceAnnualMonthly/plan.priceMonthly)*100);}
