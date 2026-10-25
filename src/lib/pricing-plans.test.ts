import test from "node:test";import assert from "node:assert/strict";
import {vistaPlans,planTotal,planDiscount} from "./pricing-plans";
test("Basic, Standard and Platinum are an ascending transparent pricing ladder",()=>{
 assert.deepEqual(vistaPlans.map(x=>x.name),["VisTa Basic","VisTa Standard","VisTa Platinum"]);
 for(let i=1;i<vistaPlans.length;i++){assert.ok(vistaPlans[i].priceMonthly>vistaPlans[i-1].priceMonthly);
 assert.ok(vistaPlans[i].projects>vistaPlans[i-1].projects);assert.ok(vistaPlans[i].seats>vistaPlans[i-1].seats);}
});
test("annual rates are lower without concealing full commitment",()=>{
 for(const p of vistaPlans){assert.ok(planDiscount(p)>0);assert.ok(planTotal(p,true)===p.priceAnnualMonthly*12);
 assert.ok(planTotal(p,false)===p.priceMonthly); }
});
