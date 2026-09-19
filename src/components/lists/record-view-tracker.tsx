'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
export function RecordViewTracker({entity,id}:{entity:'account'|'opportunity';id:string}){
 const router=useRouter();
 useEffect(()=>{let active=true;void fetch(`/api/recent/${entity}/${encodeURIComponent(id)}`,{method:'POST',keepalive:true}).then(r=>{if(r.ok&&active)router.refresh();}).catch(()=>{});return()=>{active=false;};},[entity,id,router]);return null;
}
