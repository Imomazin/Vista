'use client';
import type { CSSProperties } from 'react';
import CinematicPearl from './cinematic-pearl';

export default function Pearl({ compact = false, motion = true }: { compact?: boolean; motion?: boolean }) {
  if (!compact) return <div className="pearl-stage"><CinematicPearl motion={motion}/></div>;
  return <div className={compact ? 'pearl-stage compact' : 'pearl-stage'} aria-label="VISTA iridescent pearl emblem" role="img">
    <div className="pearl-aura" />
    {!compact && <><div className="orbital-track track-one"><i /></div><div className="orbital-track track-two"><i /></div><div className="orbital-track track-three" /><div className="pearl-coordinate coordinate-one">V / VISIBILITY</div><div className="pearl-coordinate coordinate-two">I / INTELLIGENCE</div><div className="pearl-coordinate coordinate-three">A / AI EXPOSURE</div></>}
    <div className="pearl-float"><div className="pearl-body"><div className="pearl-caustic"/><div className="pearl-specular"/>
      <div className="sculpted-v">{Array.from({length:28},(_,i)=><span aria-hidden="true" key={i} style={{'--depth':i} as CSSProperties}/>)}<span className="v-face" aria-hidden="true"/></div>
      <div className="pearl-rim"/>
    </div></div>
    {!compact && <><div className="pearl-ground"/><span className="orbital-point point-one"/><span className="orbital-point point-two"/><span className="orbital-point point-three"/></>}
  </div>;
}
