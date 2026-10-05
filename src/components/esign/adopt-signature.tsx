"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./adopt-signature.module.css";
const FONTS = ["'Brush Script MT', 'Lucida Handwriting', cursive", "'Bradley Hand', 'Comic Sans MS', cursive", "'Snell Roundhand', 'Apple Chancery', cursive", "'Times New Roman', serif"];
const initialsOf = (name:string)=>name.trim().split(/\s+/).map(p=>p[0]??'').join('').toUpperCase();
export function AdoptModal({kind, fullName, setFullName, onCancel, onAdopt, envelopeId}: {
 kind:'signature'|'initial'; fullName:string; setFullName:(s:string)=>void; onCancel:()=>void; onAdopt:(image:string)=>void; envelopeId?:string;
}) {
 const [tab,setTab]=useState<'type'|'draw'|'upload'>('type');
 const [font,setFont]=useState(0);
 const [initials,setInitials]=useState(()=>initialsOf(fullName));
 const [ink,setInk]=useState(false);
 const [uploaded,setUploaded]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null);
 const modal=useRef<HTMLDivElement>(null);
 const last=useRef<{x:number;y:number}|null>(null);
 const label=kind==='initial'?'Adopt and Initial':'Adopt and Sign';
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  modal.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape') onCancel();
   if(e.key==='Tab') {
    const items=modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');
    if(!items?.length) return;
    const first=items[0],end=items[items.length-1];
    if(e.shiftKey && document.activeElement===first){e.preventDefault();end.focus();}
    else if(!e.shiftKey && document.activeElement===end){e.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);previous?.focus();};
 // Keep focus within this instance while callbacks update.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{ if(tab!=='draw'||!canvas.current)return; const c=canvas.current; c.width=1000;c.height=280;setInk(false); },[tab]);
 function point(e:React.PointerEvent<HTMLCanvasElement>){const r=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-r.left)*1000/r.width,y:(e.clientY-r.top)*280/r.height};}
 function draw(e:React.PointerEvent<HTMLCanvasElement>){if(!last.current)return;const ctx=canvas.current?.getContext('2d');if(!ctx)return;const p=point(e);ctx.lineWidth=3;ctx.lineCap='round';ctx.strokeStyle='#171c2c';ctx.beginPath();ctx.moveTo(last.current.x,last.current.y);ctx.lineTo(p.x,p.y);ctx.stroke();last.current=p;setInk(true);}
 async function upload(file:File|undefined){
  setError('');setUploaded('');if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Choose a PNG, JPEG, or WebP image under 5 MB.');return;}
  const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>{if(img.width>8000||img.height>8000){setError('Choose an image smaller than 8000 pixels per side.');URL.revokeObjectURL(url);return;}const c=document.createElement('canvas');c.width=1000;c.height=280;const ctx=c.getContext('2d')!;const ratio=Math.min(1000/img.width,280/img.height);ctx.drawImage(img,(1000-img.width*ratio)/2,(280-img.height*ratio)/2,img.width*ratio,img.height*ratio);setUploaded(c.toDataURL('image/png'));URL.revokeObjectURL(url);};
  img.onerror=()=>{setError('This image could not be opened.');URL.revokeObjectURL(url);};img.src=url;
 }
 async function adopt(){
  if(!fullName.trim()||!initials.trim())return;setBusy(true);
  try{
   const c=document.createElement('canvas');c.width=900;c.height=260;const ctx=c.getContext('2d')!;
   ctx.strokeStyle='#7855ff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(45,24);ctx.lineTo(18,24);ctx.quadraticCurveTo(8,24,8,34);ctx.lineTo(8,216);ctx.quadraticCurveTo(8,226,18,226);ctx.lineTo(45,226);ctx.stroke();
   ctx.fillStyle='#202020';ctx.font='bold 22px Arial';ctx.fillText(kind==='initial'?'Initialed by:':'Signed by:',58,32);
   if(tab==='type'){
    const text=kind==='initial'?initials:fullName.trim();let size=105;ctx.font=`italic ${size}px ${FONTS[font]}`;while(ctx.measureText(text).width>800&&size>20){size-=2;ctx.font=`italic ${size}px ${FONTS[font]}`;}ctx.textBaseline='middle';ctx.fillText(text,58,126);ctx.textBaseline='alphabetic';
   }else{
    const image=new Image();image.src=tab==='upload'?uploaded:canvas.current!.toDataURL('image/png');await image.decode();ctx.drawImage(image,58,48,815,154);
   }
   ctx.font='18px Arial';ctx.fillText(`Coastal Sign · ${(envelopeId??'').slice(0,24)}`,58,238);
   onAdopt(c.toDataURL('image/png'));
  }catch{setError('Could not prepare your signature. Please try again.');}finally{setBusy(false);}
 }
 return <div className={styles.backdrop}><div className={styles.dialog} ref={modal} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="adopt-title">
  <header><h2 id="adopt-title">Adopt Your {kind==='initial'?'Initials':'Signature'}</h2><button onClick={onCancel} aria-label="Close signature dialog">×</button></header>
  <div className={styles.body}>
   <p>Confirm your name, initials, and signature.</p>
   <div className={styles.names}><label>Full Name <span>*</span><input value={fullName} maxLength={120} onChange={e=>{setFullName(e.target.value);setInitials(initialsOf(e.target.value));}}/></label><label>Initials <span>*</span><input value={initials} maxLength={12} onChange={e=>setInitials(e.target.value)}/></label></div>
   <div className={styles.tabs} role="tablist" aria-label="Signature method">{(['type','draw','upload'] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>{setTab(t);setError('');}}>{t==='type'?'SELECT STYLE':t.toUpperCase()}</button>)}</div>
   {tab==='type'?<><div className={styles.previewTitle}><span>PREVIEW</span><button onClick={()=>setFont(v=>(v+1)%FONTS.length)}>Change Style</button></div><div className={styles.preview}>{[fullName,initials].map((name,i)=><div className={styles.signature} key={i}><strong>{i?'Initialed by:':'Signed by:'}</strong><span style={{fontFamily:FONTS[font]}}>{name||'Your name'}</span><small>Coastal Sign{envelopeId?` · ${envelopeId.slice(0,12)}…`:''}</small></div>)}</div></>:tab==='draw'?<><p>Draw your {kind==='initial'?'initials':'signature'} below.</p><canvas className={styles.canvas} ref={canvas} aria-label="Draw your signature" onPointerDown={e=>{last.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={draw} onPointerUp={()=>{last.current=null;}} onPointerCancel={()=>{last.current=null;}}/><button className={styles.textButton} onClick={()=>{canvas.current?.getContext('2d')?.clearRect(0,0,1000,280);setInk(false);}}>Clear</button></>:<><p>Upload an image of your {kind==='initial'?'initials':'signature'}.</p><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload signature" onChange={e=>void upload(e.target.files?.[0])}/>{uploaded&&<img className={styles.uploadPreview} src={uploaded} alt="Uploaded signature preview"/>}</>}
   {error&&<p role="alert">{error}</p>}
  </div>
  <footer><p>By selecting {label}, I adopt this as my electronic {kind==='initial'?'initials':'signature'} for this document.</p><div><button className={styles.adopt} disabled={busy||!fullName.trim()||!initials.trim()||(tab==='draw'&&!ink)||(tab==='upload'&&!uploaded)} onClick={adopt}>{busy?'Preparing…':label}</button><button className={styles.cancel} onClick={onCancel}>Cancel</button></div></footer>
 </div></div>;
}

export function DeclineModal({
  reason,
  setReason,
  onCancel,
  onConfirm,
}: {
  reason: string;
  setReason: (s: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: "0 0 auto",
        height: "var(--signing-height, 100dvh)",
        background: "rgba(8,13,30,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          width: "100%",
          maxWidth: 480,
          maxHeight: "100%",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#131b2e",
            margin: "0 0 8px",
          }}
        >
          Decline to sign
        </h2>
        <p style={{ fontSize: 13, color: "#444656", margin: "0 0 12px" }}>
          The sender will be notified that you declined this document. Please
          share a brief reason.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for declining..."
          style={{
            width: "100%",
            minHeight: 100,
            padding: 10,
            border: "1px solid #c9c9c9",
            borderRadius: 4,
            fontSize: 16,
            color: "#131b2e",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #c9c9c9",
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              color: "#444656",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!reason.trim()}
            style={{
              padding: "8px 20px",
              background: reason.trim() ? "#942b00" : "#c9c9c9",
              color: "#fff",
              border: 0,
              borderRadius: 4,
              fontSize: 13,
              fontWeight: 700,
              cursor: reason.trim() ? "pointer" : "not-allowed",
            }}
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
