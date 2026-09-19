'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Pin, ChevronDown, Check } from 'lucide-react';
import { LEAD_LIST_VIEWS, type LeadListDefinition } from '@/lib/lead-list-catalog';

const empty = () => '';
const subscribe = (notify:()=>void) => {
  window.addEventListener('storage',notify); window.addEventListener('lead-list-preference',notify);
  return ()=>{window.removeEventListener('storage',notify);window.removeEventListener('lead-list-preference',notify);};
};
export function LeadListPicker({current,userId,views=LEAD_LIST_VIEWS}:{current:string;userId:string;views?:LeadListDefinition[]}) {
  const router=useRouter();const searchParams=useSearchParams();const ref=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);const [search,setSearch]=useState('');
  const key=`crm:lead-lists:${userId}`;
  const raw=useSyncExternalStore(subscribe,()=>{try{return localStorage.getItem(key)??'';}catch{return '';}},empty);
  let pinned='recent';let recent:string[]=[];
  try{const data=JSON.parse(raw);if(views.some(v=>v.value===data.pinned))pinned=data.pinned;if(Array.isArray(data.recent))recent=data.recent.filter((v:unknown)=>typeof v==='string').slice(0,5);}catch{}
  function save(next:{pinned:string;recent:string[]}){try{localStorage.setItem(key,JSON.stringify(next));window.dispatchEvent(new Event('lead-list-preference'));}catch{}}
  const label=views.find(v=>v.value===current)?.label??'Recently Viewed';
  useEffect(()=>{
    if(!searchParams.has('view')&&pinned!=='recent'){
      const sp=new URLSearchParams(searchParams.toString());sp.set('view',pinned);sp.delete('page');router.replace(`/leads?${sp}`);
    }
  },[pinned,router,searchParams]);
  useEffect(()=>{
    if(!open)return;
    const close=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false);};
    document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);
  },[open]);
  function select(value:string){
    save({pinned,recent:[value,...recent.filter(v=>v!==value)].slice(0,5)});
    const sp=new URLSearchParams();sp.set('view',value);if(searchParams.get('display')==='kanban')sp.set('display','kanban');
    router.push(`/leads?${sp}`);setOpen(false);setSearch('');
  }
  const matches=views.filter(v=>v.label.toLowerCase().includes(search.trim().toLowerCase()));
  const recentViews=recent.map(id=>views.find(v=>v.value===id)).filter(v=>!!v);
  function option(v:typeof LEAD_LIST_VIEWS[number]){return <button key={v.value} type="button" role="option" aria-selected={current===v.value} onClick={()=>select(v.value)} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] hover:bg-[#f3f2f2] focus:bg-[#eef4ff]" style={{background:current===v.value?'#eef4ff':undefined}}><Check size={14} style={{visibility:current===v.value?'visible':'hidden'}}/><span className="flex-1">{v.label}</span>{pinned===v.value&&<Pin size={13} aria-label="Pinned list"/>}</button>;}
  return <div ref={ref} className="relative inline-flex items-center gap-3" onKeyDown={e=>{if(e.key==='Escape')setOpen(false);}}>
    <button type="button" aria-label="Select a List View: Leads" aria-haspopup="listbox" aria-expanded={open} onClick={()=>{setOpen(!open);setSearch('');}} className="inline-flex items-center gap-2 text-[18px] font-bold text-[#181818]">{label}<ChevronDown size={14}/></button>
    <button type="button" aria-label={pinned===current?'Unpin this list view':'Pin this list view'} title={pinned===current?'Pinned list':'Pin this list view'} aria-pressed={pinned===current} onClick={()=>save({pinned:pinned===current?'recent':current,recent})} className="rounded-full p-1" style={{color:pinned===current?'#0176d3':'#747474',background:pinned===current?'#eaf5fe':'transparent'}}><Pin size={15}/></button>
    {open&&<div className="absolute left-0 top-full z-50 mt-1 w-[340px] rounded border border-[#c9c9c9] bg-white py-2 shadow-lg">
      <div className="px-3 pb-2"><input autoFocus type="search" aria-label="Search lists" placeholder="Search lists..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded border border-[#c9c9c9] px-3 py-2 text-[13px]"/></div>
      <div role="listbox" aria-label="Lead list views" className="max-h-[420px] overflow-y-auto">
        {!search&&recentViews.length>0&&<div role="group" aria-label="Recent Lists"><div className="px-4 py-2 text-[11px] font-bold uppercase text-[#747474]">Recent Lists</div>{recentViews.map(option)}</div>}
        <div role="group" aria-label="All Lists"><div className="px-4 py-2 text-[11px] font-bold uppercase text-[#747474]">All Lists</div>{matches.map(option)}</div>
        {!matches.length&&<p className="px-4 py-2 text-[13px] text-[#747474]">No lists match.</p>}
      </div>
    </div>}
  </div>;
}
