'use client';
import { useEffect } from 'react';

/** Runs only after a record is opened, never on a prefetched server render. */
export function LeadViewTracker({id}: {id:string}) {
  useEffect(()=>{ void fetch(`/api/leads/${encodeURIComponent(id)}/viewed`,{method:'POST',keepalive:true}).catch(()=>{}); },[id]);
  return null;
}
