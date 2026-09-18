'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Runs only after a record is opened, never on a prefetched server render. */
export function LeadViewTracker({id}: {id:string}) {
  const router=useRouter();
  useEffect(()=>{
    let active=true;
    void fetch(`/api/leads/${encodeURIComponent(id)}/viewed`,{method:'POST',keepalive:true})
      .then(response=>{if(response.ok&&active)router.refresh();}).catch(()=>{});
    return ()=>{active=false;};
  },[id,router]);
  return null;
}
