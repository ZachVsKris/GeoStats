"use client";
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import type { DailyDifficulty } from '../lib/gameRules';
export default function ReportProblem({categories,difficulty,challengeDate,initialCategoryId}:{categories:{id:string;name:string}[];difficulty:DailyDifficulty;challengeDate?:string;initialCategoryId?:string}) {
 const [open,setOpen]=useState(false),[kind,setKind]=useState('data'),[categoryId,setCategoryId]=useState(''),[message,setMessage]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[sent,setSent]=useState(false);
 const dialog=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setOpen(false);return;}
   if(event.key!=='Tab')return;
   const controls=[...dialog.current!.querySelectorAll<HTMLElement>('button:not([disabled]),select,textarea,a[href]')];
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
 },[open]);
 async function submit(event:React.FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setStatus('');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try {
   const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({kind,message,categoryId:categoryId||null,difficulty,challengeDate,path:window.location.pathname})});
   const body=await response.json();if(!response.ok)throw Error(body.error||'Your report could not be saved.');
   setSent(true);setStatus('Thank you. Your report is saved for review.');
  }catch(error){setStatus(error instanceof Error&&error.name!=='AbortError'?error.message:'The request timed out. Your text is still here; please try again.');}finally{clearTimeout(timer);setBusy(false);}
 }
 return <><button type="button" className="quietButton" onClick={()=>{setCategoryId(initialCategoryId||'');setSent(false);setStatus('');setOpen(true);}}>Report a problem</button>
 {open&&createPortal(<div className="modal accountModal" onClick={e=>e.target===e.currentTarget&&setOpen(false)}><div ref={dialog} role="dialog" aria-modal="true" aria-label="Report a problem" aria-busy={busy}>
 <button type="button" className="modalClose" aria-label="Close report" onClick={()=>setOpen(false)}>×</button><h2>Report a problem</h2>
 {!sent?<form onSubmit={submit}><label className="emailField">What went wrong?<select value={kind} onChange={e=>setKind(e.target.value)}><option value="data">A statistic or category looks wrong</option><option value="bug">Something isn’t working</option><option value="other">Other feedback</option></select></label>
 <label className="emailField">Category (optional)<select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">The game in general</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label className="emailField">Describe the problem<textarea required minLength={10} maxLength={1500} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="What did you see, and what did you expect?" /></label>
 <p>Your report goes privately to GeoStats. Please don’t include passwords or sign-in links.</p><button type="submit" disabled={busy||message.trim().length<10}>{busy?'Sending…':'Send report'}</button></form>:<button type="button" onClick={()=>setOpen(false)}>Back to the game</button>}
 {status&&<p role="status">{status}</p>}</div></div>, document.body)}</>;
}
