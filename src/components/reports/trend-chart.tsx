"use client";
export function TrendChart({ points, onSelect }: { points: { key: string; label: string; value: number }[]; onSelect?: (key: string) => void }) {
  const values = points.filter(p => Number.isFinite(p.value));
  if (!values.length) return <p className="text-xs text-gray-600">No history available yet.</p>;
  const min = Math.min(0, ...values.map(p=>p.value)), max = Math.max(1,...values.map(p=>p.value));
  const x=(i:number)=>50+i*500/Math.max(1,values.length-1), y=(value:number)=>180-(value-min)/(max-min)*150;
  return <div className="w-full min-w-0"><svg role="img" aria-label="Trend across report groups" viewBox="0 0 600 220" className="w-full max-h-72"><line x1="50" y1="180" x2="550" y2="180" stroke="#aaa"/><text x="2" y="30" fontSize="11">{max.toLocaleString(undefined,{maximumFractionDigits:0})}</text><text x="2" y="180" fontSize="11">{min.toLocaleString(undefined,{maximumFractionDigits:0})}</text><polyline fill="none" stroke="#0176d3" strokeWidth="2" points={values.map((p,i)=>`${x(i)},${y(p.value)}`).join(" ")}/>{values.map((p,i)=><circle key={p.key} cx={x(i)} cy={y(p.value)} r="4" fill="#0176d3" tabIndex={onSelect?0:undefined} role={onSelect?"button":undefined} aria-label={`${p.label}: ${p.value}`} onClick={()=>onSelect?.(p.key)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")onSelect?.(p.key);}}><title>{p.label}: {p.value.toLocaleString()}</title></circle>)}<text x="50" y="210" fontSize="11">{values[0].label.slice(0,24)}</text><text x="550" y="210" textAnchor="end" fontSize="11">{values[values.length-1].label.slice(0,24)}</text></svg></div>;
}
