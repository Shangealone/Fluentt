"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isOversightPage, type OversightPage, type View } from "@/services/oversight-contract";
import styles from "./performance.module.css";

const labels: Record<string,string> = { active_students:"Active school students",active_instructors:"Active instructors",active_classes:"Active classrooms",enrolled_students:"Distinct enrolled students",eligible_memberships:"Eligible class memberships" };
const columns: Record<View, [string,string][]> = {
  summary:[["metric","Metric"],["count","Count"]], users:[["username","Username"],["role","Role"],["status","Status"]],
  classes:[["name","Classroom"],["instructor","Instructor"],["grade","Grade"],["language","Language"],["subject","Subject"],["status","Status"],["eligible_memberships","Eligible memberships"]],
  classwork:[["title","Activity"],["version","Version"],["status","Status"],["lesson","Pinned lesson"],["question_count","Questions"],["submitted_captures","Submitted captures"]],
  algorithms:[["algorithm","Scheduler"],["implementation_version","Saved implementation"],["configuration_version","Config version"],["parameters","Saved numeric parameters"],["registered","Registered"],["model_simulated","Model simulated"],["runtime_identity","Runtime identity"]],
  speech:[["scoring_status","Recorded status"],["simulated","Simulated"],["evaluator_configuration_id","Evaluator configuration"],["attempt_count","Attempts"]],
  audit:[["occurred_at","UTC timestamp"],["action","Action"],["entity_type","Scope"],["actor_id","Actor ID"],["entity_id","Entity ID"]], settings:[["setting","Setting"],["value","Readiness"]],
};
const display = (v: unknown) => v === null || v === undefined ? "N/A" : typeof v === "boolean" ? v ? "Yes" : "No" : typeof v === "object" ? JSON.stringify(v) : String(v);
type Pending = { id:string; username:string; status:string; revision:string; key:string };
export function OversightPanel({ view: initialView, permitted, preview, canWrite=false, canExport=false, csrf="", report=false }: {
  view:View; permitted:boolean; preview:boolean; canWrite?:boolean; canExport?:boolean; csrf?:string; report?:boolean;
}) {
  const [view,setView]=useState(initialView),[classId,setClassId]=useState("");
  const [q,setQ]=useState(""),[search,setSearch]=useState(""),[role,setRole]=useState(""),[status,setStatus]=useState("");
  const [filters,setFilters]=useState({q:"",role:"",status:""}),[offset,setOffset]=useState(0),[reload,setReload]=useState(0);
  const [focused,setFocused]=useState(true),[result,setResult]=useState<{key:string;value:OversightPage}|null>(null),[problem,setProblem]=useState<{key:string;text:string}|null>(null);
  const [pending,setPending]=useState<Pending|null>(null),[saving,setSaving]=useState(false),[mutationError,setMutationError]=useState("");
  const key=JSON.stringify([view,classId,filters,offset,reload]);
  const data=focused&&result?.key===key?result.value:null,error=problem?.key===key?problem.text:"";
  useEffect(()=>{
    const hide=()=>{setFocused(false);setResult(null);setProblem(null);};
    const focus=()=>{if(!document.hidden)setFocused(true);};
    const visible=()=>document.hidden?hide():focus();
    window.addEventListener("blur",hide);window.addEventListener("focus",focus);document.addEventListener("visibilitychange",visible);visible();
    return()=>{window.removeEventListener("blur",hide);window.removeEventListener("focus",focus);document.removeEventListener("visibilitychange",visible);};
  },[]);
  useEffect(()=>{
    if(!permitted||preview||!focused)return;
    let active=true;const control=new AbortController();
    const query=new URLSearchParams({offset:String(offset)});
    if(view==="users"||view==="classes")query.set("q",filters.q);
    if(view==="users"){query.set("role",filters.role);query.set("status",filters.status);}
    if(view==="classwork")query.set("class_id",classId);
    void(async()=>{try{
      const response=await fetch(`/api/admin/oversight/${view}?${query}`,{cache:"no-store",signal:AbortSignal.any([control.signal,AbortSignal.timeout(40000)])});
      if(!active)return;if(response.status===401){window.location.replace("/login?expired=1");return;}
      if(!response.ok)throw new Error(response.status===403?"This account needs explicit read access to this module.":"Data is unavailable. Refresh to try again.");
      const value:unknown=await response.json();if(!isOversightPage(value)||value.view!==view)throw new Error("Unexpected server response. Please retry.");
      if(active){setResult({key,value});setProblem(null);}
    }catch(cause){if(active){setResult(null);setProblem({key,text:cause instanceof Error?cause.message:"Data unavailable."});}}})();
    return()=>{active=false;control.abort();};
  },[view,classId,filters,offset,reload,key,permitted,preview,focused]);
  async function saveStatus(){
    if(!pending||saving||!data)return;setSaving(true);setMutationError("");
    try{
      const response=await fetch(`/api/admin/oversight/users/${encodeURIComponent(pending.id)}/status`,{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrf,"If-Match":pending.revision,"Idempotency-Key":pending.key},body:JSON.stringify({status:pending.status,confirm:true}),signal:AbortSignal.timeout(40000)});
      if(response.status===401){window.location.replace("/login?expired=1");return;}
      if(response.status===403){setResult(null);setPending(null);setProblem({key,text:"Access was revoked. Refresh to verify administrator permissions."});return;}
      if(!response.ok)throw new Error("Change not confirmed. Retry this same request, or refresh to reconcile the account before another action.");
      setPending(null);setReload(v=>v+1);
    }catch(cause){setMutationError(cause instanceof Error?cause.message:"Outcome unknown. Retry the original change.");}
    finally{setSaving(false);}
  }
  const reason=preview?"Preview mode · live records and account changes are unavailable.":!permitted?"Access required · an operator must grant this module’s permission.":error;
  return <>
    {!!reason&&<div className={styles.notice} role={error?"alert":"status"}>{reason}</div>}
    <div className={styles.toolbar}><button className={styles.refresh} disabled={preview||!permitted||saving} onClick={()=>{setPending(null);setMutationError("");setReload(v=>v+1);}}>Refresh records</button>{view==="classwork"&&<button onClick={()=>{setView("classes");setOffset(0);}}>Back to classes</button>}</div>
    {(view==="users"||view==="classes")&&<form className={styles.filters} onSubmit={e=>{e.preventDefault();setFilters({q:search.trim(),role,status});setQ(search.trim());setOffset(0);setReload(v=>v+1);}}>
      <label>Search {view}<input maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or username" /></label>
      {view==="users"&&<><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="">Students and instructors</option><option value="school_student">School students</option><option value="instructor">Instructors</option></select></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="onboarding">Onboarding</option></select></label></>}
      <button type="submit">Apply filters</button>{q&&<span>Search: {q}</span>}
    </form>}
    {view==="users"&&<p className={styles.caption}>Account creation uses existing learner/instructor onboarding. This page cannot create device credentials, edit roles, activate unfinished onboarding or manage personal profiles.</p>}
    {view==="summary"&&<div className={styles.metrics}>{Object.entries(labels).map(([metric,label])=><article className={styles.metric} key={metric}><p>{label}</p><strong>{data?display(data.summary[metric]):"—"}</strong></article>)}</div>}
    {data&&Object.keys(data.summary).length>0&&view!=="summary"&&<section className={styles.card}><h2>Data and implementation status</h2>{Object.entries(data.summary).map(([label,value])=><p className={styles.caption} key={label}><strong>{label.replaceAll("_"," ")}: </strong>{display(value)}</p>)}</section>}
    {!!pending&&focused&&data&&<section className={styles.card} role="region" aria-label="Confirm account status change"><h2>Change {pending.username} to {pending.status}?</h2><p>Disabling revokes current device sessions and removes live classroom access. Reactivation does not restore revoked credentials or replace onboarding.</p>{mutationError&&<p role="alert">{mutationError}</p>}<button disabled={saving} onClick={()=>void saveStatus()}>{saving?"Saving…":mutationError?"Retry original change":"Confirm status change"}</button>{!mutationError&&<button disabled={saving} onClick={()=>setPending(null)}>Cancel</button>}</section>}
    <section className={styles.card} aria-busy={permitted&&!preview&&focused&&!data&&!error}>
      <div className={styles.tableWrap}><table><thead><tr>{columns[view].map(([field,label])=><th scope="col" key={field}>{label}</th>)}{(view==="classes"||view==="users"&&canWrite)&&<th scope="col">Actions</th>}</tr></thead><tbody>
        {data?.items.map((row,index)=><tr key={typeof row.id==="string"?row.id:index}>{columns[view].map(([field])=><td key={field} style={{whiteSpace:"normal",overflowWrap:"anywhere",maxWidth:300}}>{field==="metric"?labels[String(row[field])]??display(row[field]):display(row[field])}</td>)}
          {view==="classes"&&<td><button onClick={()=>{setClassId(String(row.id));setView("classwork");setOffset(0);}}>Inspect activities</button></td>}
          {view==="users"&&canWrite&&<td>{["active","disabled"].includes(String(row.status))&&<button disabled={saving||!!pending} onClick={()=>{setMutationError("");setPending({id:String(row.id),username:String(row.username),status:row.status==="active"?"disabled":"active",revision:String(row.revision),key:crypto.randomUUID()});}}>{row.status==="active"?"Deactivate":"Reactivate"}</button>}</td>}
        </tr>)}
        {!data?.items.length&&<tr><td colSpan={columns[view].length+1} className={styles.emptyRow}>{data?"No records match this view.":reason?"No live records loaded.":focused?"Loading records…":"Return to this window to refresh protected records."}</td></tr>}
      </tbody></table></div>
      <div className={styles.pagination}><span>{data?`${data.items.length} records · ${data.metric_version}`:"Records unavailable"}</span><div><button disabled={!data||offset===0||saving} onClick={()=>setOffset(v=>Math.max(0,v-20))}>Previous</button><button disabled={!data?.has_more||saving} onClick={()=>setOffset(v=>v+20)}>Next</button></div></div>
      {data&&<p className={styles.caption}>Snapshot: {data.as_of} · School-only oversight. Submitted captures are participation records, not mastery, grades or attendance.</p>}
    </section>
    {report&&<section className={styles.card}><h2>Operational summary CSV</h2><p>Columns: metric_version, as_of_utc, metric, count. Current active school scope; no individual or research records. N/A means unavailable; zero is an observed count. Export is audited. Fixed metric identifiers and integer counts cannot form spreadsheet formulas.</p>{canExport&&!preview?<a className="button" href="/api/admin/oversight/summary.csv" download>Download school summary CSV</a>:<p>Explicit oversight.export permission and a real session are required.</p>}<p><Link href="/research">Study-specific research reports and export readiness →</Link></p><p>Historical offline benchmarks are separate from live learner outcomes. No supplied benchmark figure is inserted into this dataset.</p></section>}
  </>;
}
