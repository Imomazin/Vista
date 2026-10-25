'use client';
import {Moon,Sun} from "lucide-react";
import type {Appearance} from "@/lib/appearance";
import {nextAppearance} from "@/lib/appearance";

export default function AppearanceSwitch({appearance,onChange,compact=false}:{appearance:Appearance;onChange:(value:Appearance)=>void;compact?:boolean}){
 const light=appearance==="light";
 return <button type="button" className={"vista-appearance-switch"+(compact?" appearance-compact":"")} onClick={()=>onChange(nextAppearance(appearance))} aria-label={light?"Switch to Obsidian dark mode":"Switch to Porcelain light mode"} aria-pressed={light} title={light?"Switch to Obsidian dark":"Switch to Porcelain light"}>
  <span className="appearance-track" aria-hidden="true"><span className={"appearance-track-icon"+(!light?" current":"")}><Moon size={13}/></span><span className={"appearance-track-icon"+(light?" current":"")}><Sun size={13}/></span><i className="appearance-thumb"/></span>
  {!compact&&<span className="appearance-name">{light?"PORCELAIN":"OBSIDIAN"}</span>}
 </button>;
}
