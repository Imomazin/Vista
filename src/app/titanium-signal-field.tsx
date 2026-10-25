import type {CSSProperties} from "react";
const emissions=[
 {x:450,y:46},{x:672,y:96},{x:831,y:232},
 {x:805,y:427},{x:646,y:554},{x:388,y:554},
 {x:204,y:429},{x:150,y:237},{x:266,y:99}
] as const;
/** Decorative signature circuitry, not a map of measured relationships. */
export default function TitaniumSignalField(){
 return <div className="titanium-signal-field" aria-hidden="true">
  <svg viewBox="0 0 980 600" preserveAspectRatio="xMidYMid meet" focusable="false">
   <defs>
    <linearGradient id="ti-signal-ray" x1="0%" y1="0%" x2="100%" y2="100%">
     <stop offset="0%" stopColor="var(--ti-metal)" stopOpacity=".12"/>
     <stop offset="48%" stopColor="var(--ti-metal)" stopOpacity=".33"/>
     <stop offset="72%" stopColor="var(--ti-emerald)" stopOpacity=".8"/>
     <stop offset="100%" stopColor="var(--ti-metal)" stopOpacity=".24"/>
    </linearGradient>
   </defs>
   <circle className="ti-signal-guide" cx="500" cy="300" r="207"/>
   <circle className="ti-signal-guide outer" cx="500" cy="300" r="264"/>
   {emissions.map((p,i)=>{
    const mx=500+(p.x-500)*.52+(p.y-300)*.09;
    const my=300+(p.y-300)*.50-(p.x-500)*.09;
    const d=`M500 300 Q${mx.toFixed(0)} ${my.toFixed(0)} ${p.x} ${p.y}`;
    return <g key={i} style={{"--order":i} as CSSProperties}>
     <path className="ti-signal-ray" d={d}/>
     <path className="ti-signal-energy" d={d}/>
     <circle className="ti-signal-anchor" cx={p.x} cy={p.y} r={i%3===0?4:3}/>
    </g>;
   })}
  </svg>
 </div>;
}
