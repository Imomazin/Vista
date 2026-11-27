'use client';
import { AlertTriangle, Check, Clock3, Layers, Loader2, Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import type { StageState } from '@/lib/intel/model';

export type PulseProps = {
  title: string;
  status: 'idle' | 'running' | 'paused' | 'cancelled' | 'complete' | 'failed';
  stages: StageState[];
  activity: string;
  elapsedMs: number;
  percent: number | null;
  determinate: boolean;
  counts?: { label: string; value: number }[];
  onCancel?: () => void;
  onResume?: () => void;
  onRetry?: () => void;
  compact?: boolean;
};

export function formatElapsed(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? m + 'm ' + String(s % 60).padStart(2, '0') + 's' : s + 's';
}

const statusLabel: Record<PulseProps['status'], string> = { idle: 'Ready', running: 'Processing', paused: 'Paused', cancelled: 'Cancelled', complete: 'Complete', failed: 'Needs attention' };

/**
 * VisTa Intelligence Pulse: a liquid energy-stream progress experience. Percentages come only
 * from measured units of work; unknown totals show a flowing indeterminate stream instead.
 */
export default function IntelligencePulse(props: PulseProps) {
  const { stages, status, percent, determinate } = props;
  const errors = stages.flatMap(s => s.errors.map(e => ({ ...e, stage: s.label })));
  const value = percent ?? 0;
  const running = status === 'running';
  const showIndeterminate = running && !determinate;
  return <section className={'ipulse ipulse-' + status + (props.compact ? ' ipulse-compact' : '')} aria-label={props.title + ' progress'}>
    <header className="ipulse-head">
      <div><span className="ipulse-eyebrow"><i className="ipulse-dot"/>VisTa Intelligence Pulse</span><h3>{props.title}</h3></div>
      <div className="ipulse-stats">
        <span className={'ipulse-chip chip-' + status}>{running ? <Loader2 size={13} className="ipulse-spin"/> : status === 'complete' ? <Check size={13}/> : status === 'failed' ? <AlertTriangle size={13}/> : status === 'paused' ? <Pause size={13}/> : null}{statusLabel[status]}</span>
        <span title="Elapsed processing time"><Clock3 size={13}/>{formatElapsed(props.elapsedMs)}</span>
        {props.counts?.map(c => <span key={c.label}><Layers size={13}/>{c.value.toLocaleString('en-GB')} {c.label}</span>)}
      </div>
    </header>
    <div className="ipulse-track" role="progressbar" aria-label={props.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={determinate || !running ? value : undefined} aria-valuetext={determinate || !running ? value + '% complete' : 'In progress, total not yet known'} aria-busy={running}>
      <div className="ipulse-fill" style={{ width: Math.max(status === 'idle' ? 0 : 3, value) + '%' }}>
        <svg className="ipulse-wave" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 22 Q 30 10 60 22 T 120 22 T 180 22 T 240 22 V40 H0Z"/><path className="ipulse-wave-2" d="M0 26 Q 30 34 60 26 T 120 26 T 180 26 T 240 26 V40 H0Z"/></svg>
        <span className="ipulse-sheen" aria-hidden="true"/>
        {running && <span className="ipulse-particles" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: (i * 0.37) + 's', top: (18 + (i * 29) % 64) + '%' }}/>)}</span>}
      </div>
      {showIndeterminate && <div className="ipulse-stream" aria-hidden="true"/>}
    </div>
    <div className="ipulse-readout">
      <strong>{showIndeterminate ? 'Measuring…' : value + '%'}</strong>
      <p aria-live="polite">{props.activity}</p>
    </div>
    <ol className="ipulse-stages">
      {stages.map((s, i) => <li key={s.id} className={'ipulse-stage stage-' + s.status} aria-current={s.status === 'active' ? 'step' : undefined}>
        <span className="ipulse-num">{s.status === 'complete' ? <Check size={12}/> : s.status === 'failed' ? <X size={12}/> : String(i + 1).padStart(2, '0')}</span>
        <div>
          <strong>{s.label}</strong>
          <small>{s.status === 'active' ? (s.total ? s.done + ' of ' + s.total : 'In progress') : s.status === 'pending' ? 'Outstanding' : s.status === 'skipped' ? 'Skipped' : s.status === 'partial' ? 'Completed with gaps' : s.status === 'failed' ? 'Failed' : 'Complete'}{s.note && s.status !== 'active' ? ' · ' + s.note : ''}</small>
          {s.status === 'active' && s.total ? <span className="ipulse-mini" aria-hidden="true"><i style={{ width: Math.min(100, s.done / s.total * 100) + '%' }}/></span> : null}
        </div>
      </li>)}
    </ol>
    {errors.length > 0 && <details className="ipulse-errors" open={status === 'failed'}>
      <summary><AlertTriangle size={14}/>{errors.length} source {errors.length === 1 ? 'issue' : 'issues'} explained</summary>
      <ul>{errors.slice(0, 12).map((e, i) => <li key={i}><strong>{e.stage} — {e.source.slice(0, 90)}</strong><span>{e.message}</span>{e.retryable && <em>Retryable</em>}</li>)}</ul>
    </details>}
    {(props.onCancel || props.onResume || props.onRetry) && <footer className="ipulse-actions">
      {running && props.onCancel && <button className="ipulse-button" onClick={props.onCancel}><Square size={14}/>Cancel</button>}
      {(status === 'paused' || status === 'cancelled') && props.onResume && <button className="ipulse-button primary" onClick={props.onResume}><Play size={14}/>Resume</button>}
      {status === 'failed' && props.onRetry && <button className="ipulse-button primary" onClick={props.onRetry}><RotateCcw size={14}/>Retry from the failed stage</button>}
    </footer>}
  </section>;
}
