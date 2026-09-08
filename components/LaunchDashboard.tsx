"use client";
import { useCallback, useEffect, useState } from 'react';
type Report={id:string;created_at:string;status:'new'|'resolved';kind:string;message:string;category_id:string|null;challenge_date:string|null;difficulty:string|null;page_path:string};
type Data={reports:Report[];reportsError:string|null;funnel:Record<string,number|null>|null;funnelError:string|null};
export default function LaunchDashboard(){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{setBusy(true);try{const r=await fetch('/api/admin/reports',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Launch dashboard could not be loaded.');setData(await r.json());setError('');}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}},[]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer);},[load]);
 async function update(report:Report){setBusy(true);try{const response=await fetch('/api/admin/reports',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:report.id,status:report.status==='new'?'resolved':'new'}),signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('Report could not be updated.');await load();}catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}
 const metrics=[['Visitors','visitors'],['Started a game','starters'],['Finished a game','finishers'],['Started another after finishing','second_game_players'],['Created an account','account_creators'],['Returned next day','next_day_returners'],['Eligible retention cohort','retention_eligible'],['Next-day retention %','next_day_retention_rate']] as const;
 return <section className="launchDashboard"><h2>Launch funnel and player reports</h2><button disabled={busy} onClick={()=>void load()}>{busy?'Refreshing…':'Refresh'}</button>{error&&<p role="alert">{error}</p>}
 <h3>Player funnel · last 30 days</h3><p>Counts distinct browser identifiers, not people. Tracking starts with this release; older visits cannot be reconstructed. A second game means a different board started after a finish. Next-day retention uses New York dates and includes only cohorts whose full next day has ended. Admin and tester activity is excluded.</p>
 {data?.funnelError&&<p role="status">{data.funnelError}</p>}{data?.funnel&&<dl className="launchMetrics">{metrics.map(([label,key])=><div key={key}><dt>{label}</dt><dd>{data.funnel?.[key]??'—'}</dd></div>)}</dl>}
 <h3>Latest 100 player reports</h3>{data?.reportsError&&<p role="status">{data.reportsError}</p>}{data&&!data.reportsError&&!data.reports.length&&<p>No reports yet.</p>}
 {data?.reports.map(report=><article key={report.id} className="playerReport"><strong>{report.kind} · {report.status}</strong><small>{new Date(report.created_at).toLocaleString()} · {report.challenge_date} · {report.difficulty} · {report.category_id||'General'} · {report.page_path}</small><p>{report.message}</p><button disabled={busy} onClick={()=>void update(report)}>{report.status==='new'?'Mark resolved':'Reopen'}</button></article>)}
 </section>;
}
