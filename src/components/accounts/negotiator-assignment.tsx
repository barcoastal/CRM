'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function NegotiatorAssignment({ accountId, currentId, currentName, importedName, options, canAssign }: { accountId: string; currentId: string | null; currentName: string | null; importedName?: string | null; options: { label: string; value: string }[]; canAssign: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentId ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/accounts/${accountId}/negotiator`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selected || null, previousUserId: currentId }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Unable to save assignment.');
      setEditing(false); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save assignment.'); }
    finally { setBusy(false); }
  }
  const button = { border:'1px solid #c9c9c9',borderRadius:4,background:'white',color:'#0176d3',fontSize:12,padding:'4px 8px',cursor:'pointer' } as const;
  return <div style={{fontSize:13}}>
    {!editing ? <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><span>{currentName || 'Unassigned'}</span>{canAssign && <button type="button" style={button} onClick={() => {setSelected(currentId ?? '');setError('');setEditing(true);}}>Assign negotiator</button>}</div> : <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <select aria-label="Debt negotiator" value={selected} disabled={busy} onChange={e=>setSelected(e.target.value)} style={{border:'1px solid #c9c9c9',borderRadius:4,padding:5,maxWidth:'100%',background:'white'}}><option value="">Unassigned</option>{currentId && !options.some(o=>o.value===currentId) && <option value={currentId}>{currentName} (inactive)</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <button type="button" style={button} disabled={busy || selected === (currentId ?? '')} onClick={save}>{busy?'Saving…':'Save'}</button><button type="button" style={button} disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>
    </div>}
    {importedName && <div style={{color:'#706e6b',fontSize:11,marginTop:4}}>Salesforce assignment: {importedName}</div>}
    {error && <p role="alert" style={{color:'#ba0517',fontSize:12,marginTop:5}}>{error}</p>}
  </div>;
}
