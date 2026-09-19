"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, List, RefreshCw, ArrowDownUp, Pencil, Filter } from "lucide-react";
import { toast } from "sonner";
import { Modal, ModalButton } from "./modal";
import type { SfColumn } from "./sf-list-page";
import type { SfMassToolbarConfig } from "./sf-list-client";

type SavedView = {id:string;name:string;baseView?:string|null;isSystem:boolean;isShared:boolean;filters:{field:string;op:string;value?:unknown}[];columns?:string[];sortField?:string;sortDir?:string};
export function ListControls({pathname,subtitle,columns,selectedColumns,defaultColumns,onColumns,config,currentView,allowKanban}:{pathname:string;subtitle:string;columns:SfColumn[];selectedColumns:string[];defaultColumns?:string[];onColumns:(v:string[])=>void;config:SfMassToolbarConfig;currentView?:string;allowKanban?:boolean}) {
  const router=useRouter();const sp=useSearchParams();
  const [panel,setPanel]=useState<string|null>(null);const [name,setName]=useState("");const [shared,setShared]=useState(false);
  const [saved,setSaved]=useState<SavedView|null>(null);const [busy,setBusy]=useState(false);
  const [draftColumns,setDraftColumns]=useState<string[]>([]);
  const [filters,setFilters]=useState<Record<string,string>>({});const [sort,setSort]=useState("");const [dir,setDir]=useState("asc");
  const entity=config.entity[0].toUpperCase()+config.entity.slice(1);
  const filterFields=config.entity==='lead'?['status','source','recordType','assignedToId']:config.entity==='opportunity'?['stage','recordType']:config.entity==='account'?['recordType']:[];
  function navigate(changes:Record<string,string|undefined>){const next=new URLSearchParams(sp.toString());next.delete('page');for(const[k,v]of Object.entries(changes)){if(v)next.set(k,v);else next.delete(k);}router.push(`${pathname}?${next}`);}
  async function manage(nextPanel='manage'){setBusy(true);try{const res=await fetch(`/api/list-views?entity=${entity}`);if(!res.ok)throw Error('Could not load views');const data=await res.json();const view=data.items.find((v:SavedView & {developerName?:string})=>currentView===`custom:${v.id}`||currentView===`view:${v.developerName}`);setSaved(view??null);setName(subtitle);setShared(view?.isShared??false);setFilters(Object.fromEntries(filterFields.map(f=>[f,sp.get(f)??String(view?.filters.find((item:{field:string;op:string})=>item.field===f&&item.op==='EQ')?.value??'')])));setPanel(nextPanel);}catch(e){toast.error(e instanceof Error?e.message:'Could not load views');}finally{setBusy(false);}}
  async function save(mode:'create'|'update'|'delete'){
    if(mode!=='delete'&&!name.trim()){toast.error('Enter a list name');return;}
    setBusy(true);try{
      const baseFilters=saved&&!saved.isSystem?saved.filters:[];
      const queryFilters=filterFields.filter(f=>sp.get(f)).map(f=>({field:f,op:'EQ',value:sp.get(f)}));
      const data={entity,name:name.trim(),isShared:shared,baseView:saved?.baseView??currentView??null,filters:[...baseFilters.filter(b=>!queryFilters.some(f=>b.field===f.field)),...queryFilters],columns:selectedColumns,sortField:sp.get('sort')||saved?.sortField||null,sortDir:sp.get('dir')||saved?.sortDir||'asc'};
      const res=await fetch(mode==='create'?'/api/list-views':`/api/list-views/${saved?.id}`,{method:mode==='create'?'POST':mode==='delete'?'DELETE':'PATCH',headers:{'Content-Type':'application/json'},...(mode==='delete'?{}:{body:JSON.stringify(data)})});
      const result=await res.json();if(!res.ok)throw Error(result.error||'Could not save view');
      setPanel(null);toast.success(mode==='delete'?'List deleted':'List saved');router.push(`${pathname}?view=${mode==='delete'?'all':`custom:${result.id}`}`);router.refresh();
    }catch(e){toast.error(e instanceof Error?e.message:'Could not save view');}finally{setBusy(false);}
  }
  async function applyFilters(clear=false){
    const next=clear?Object.fromEntries(filterFields.map(f=>[f,''])):filters;
    if(currentView?.startsWith('custom:')&&saved){
      setBusy(true);try{
        const updated=[...saved.filters.filter(f=>!filterFields.includes(f.field)),...filterFields.filter(f=>next[f]).map(f=>({field:f,op:'EQ',value:next[f]}))];
        const response=await fetch(`/api/list-views/${saved.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({filters:updated})});
        const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save filters');
        navigate(Object.fromEntries(filterFields.map(f=>[f,undefined])));router.refresh();setPanel(null);
      }catch(e){toast.error(e instanceof Error?e.message:'Could not save filters');}finally{setBusy(false);}
    }else{navigate(next);setPanel(null);}
  }
  const buttonClass='flex h-8 w-8 items-center justify-center rounded border border-[#c9c9c9] bg-white text-[#747474] hover:bg-slate-50';
  return <>
    {['lead','account','opportunity'].includes(config.entity)&&<button className={buttonClass} aria-label="List controls" disabled={busy} onClick={()=>manage()}><Settings size={15}/></button>}
    {allowKanban&&<button className={buttonClass} aria-label="Choose view" onClick={()=>setPanel('display')}><List size={15}/></button>}
    <button className={buttonClass} aria-label="Refresh" onClick={()=>{router.refresh();toast.success('List refreshed');}}><RefreshCw size={15}/></button>
    <button className={buttonClass} aria-label="Sort" onClick={()=>{setSort(sp.get('sort')||columns.find(c=>c.sortable)?.key||'');setDir(sp.get('dir')||'asc');setPanel('sort');}}><ArrowDownUp size={15}/></button>
    <button className={buttonClass} aria-label="Select fields to display" onClick={()=>{setDraftColumns(selectedColumns);setPanel('columns');}}><Pencil size={15}/></button>
    {filterFields.length>0&&<button className={buttonClass} aria-label="Filters" onClick={()=>manage('filters')}><Filter size={15}/></button>}
    {panel==='manage'&&<Modal open title="List View Controls" onClose={()=>setPanel(null)} footer={<><ModalButton onClick={()=>setPanel(null)}>Cancel</ModalButton><ModalButton onClick={()=>save('create')} disabled={busy}>Save as New List</ModalButton>{saved&&!saved.isSystem&&<><ModalButton onClick={()=>setPanel('delete')} disabled={busy}>Delete</ModalButton><ModalButton variant="brand" onClick={()=>save('update')} disabled={busy}>Save Changes</ModalButton></>}</>}>
      <label className="block text-sm">List name<input className="mt-1 w-full rounded border p-2" value={name} onChange={e=>setName(e.target.value)}/></label>
      <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={shared} onChange={e=>setShared(e.target.checked)}/>Share with all CRM users</label>
      <p className="mt-3 text-sm text-slate-500">Saved lists include the current filters, columns, and sorting. Record permissions still apply. Only the owner can change a saved list.</p>
    </Modal>}
    {panel==='delete'&&<Modal open title="Delete list view?" onClose={()=>setPanel(null)} footer={<><ModalButton onClick={()=>setPanel(null)}>Cancel</ModalButton><ModalButton onClick={()=>save('delete')} disabled={busy}>Delete List</ModalButton></>}><p>Delete “{saved?.name}”? The records will remain in the CRM.</p></Modal>}
    {panel==='display'&&<Modal open title="Display as" onClose={()=>setPanel(null)}><div className="flex gap-3">{['table','kanban'].map(v=><ModalButton key={v} onClick={()=>{navigate({display:v});setPanel(null);}}>{v==='table'?'Table':'Kanban'}</ModalButton>)}</div></Modal>}
    {panel==='sort'&&<Modal open title="Sort list" onClose={()=>setPanel(null)} footer={<ModalButton variant="brand" onClick={()=>{navigate({sort,dir});setPanel(null);}}>Apply</ModalButton>}><label>Sort by<select className="m-2 rounded border p-2" value={sort} onChange={e=>setSort(e.target.value)}>{columns.filter(c=>c.sortable).map(c=><option key={c.key} value={c.key}>{c.label}</option>)}</select></label><label>Direction<select className="m-2 rounded border p-2" value={dir} onChange={e=>setDir(e.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label></Modal>}
    {panel==='filters'&&<Modal open title="Filter list" onClose={()=>setPanel(null)} footer={<><ModalButton disabled={busy} onClick={()=>applyFilters(true)}>Clear Additional Filters</ModalButton><ModalButton variant="brand" disabled={busy} onClick={()=>applyFilters()}>Apply</ModalButton></>}><p className="mb-3 text-sm text-slate-500">These exact-match filters narrow the selected list.</p>{filterFields.map(f=><label className="mb-3 block text-sm" key={f}>{f==='assignedToId'?'Owner user ID':f==='recordType'?'Record type':f[0].toUpperCase()+f.slice(1)}{f===config.statusField&&config.statusOptions?<select className="mt-1 w-full rounded border p-2" value={filters[f]} onChange={e=>setFilters({...filters,[f]:e.target.value})}><option value="">All</option>{config.statusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input className="mt-1 w-full rounded border p-2" value={filters[f]} onChange={e=>setFilters({...filters,[f]:e.target.value})}/>}</label>)}</Modal>}
    {panel==='columns'&&<Modal open title="Select fields to display" onClose={()=>setPanel(null)} footer={<><ModalButton onClick={()=>setDraftColumns(defaultColumns??columns.map(c=>c.key))}>Reset</ModalButton><ModalButton variant="brand" disabled={!draftColumns.length} onClick={()=>{onColumns(draftColumns);setPanel(null);}}>Apply</ModalButton></>}><p className="mb-3 text-sm text-slate-500">Select fields, then use the arrows to change their order.</p><div className="max-h-96 overflow-auto">{[...draftColumns,...columns.map(c=>c.key).filter(k=>!draftColumns.includes(k))].map((key,i)=><div className="flex items-center gap-2 border-b py-2 text-sm" key={key}><input aria-label={`Show ${columns.find(c=>c.key===key)?.label}`} type="checkbox" checked={draftColumns.includes(key)} onChange={e=>setDraftColumns(e.target.checked?[...draftColumns,key]:draftColumns.filter(k=>k!==key))}/><span className="flex-1">{columns.find(c=>c.key===key)?.label}</span>{draftColumns.includes(key)&&<><button aria-label={`Move ${key} up`} disabled={i===0} onClick={()=>{const n=[...draftColumns];[n[i-1],n[i]]=[n[i],n[i-1]];setDraftColumns(n);}}>↑</button><button aria-label={`Move ${key} down`} disabled={i===draftColumns.length-1} onClick={()=>{const n=[...draftColumns];[n[i+1],n[i]]=[n[i],n[i+1]];setDraftColumns(n);}}>↓</button></>}</div>)}</div></Modal>}
  </>;
}
