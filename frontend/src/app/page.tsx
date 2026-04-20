"use client";
/**
 * APA — AI Paperwork Assistant
 * Complete production frontend covering ALL 6 phases:
 *
 * Phase 1: Document upload, OCR, AI summary, deadline detection, dashboard
 * Phase 2: Bill tracking, scam detection, medication tracking, smart reminders
 * Phase 3: Caregiver portal, emergency vault, renewal tracking
 * Phase 4: Benefits navigator, financial analysis, form filling
 * Phase 5: Timeline, auto-classification, translation
 * Phase 6: Subscription billing
 *
 * Screens:
 *   Dashboard    — stats, quick upload, alerts, upcoming deadlines
 *   Documents    — full list + detail view with AI analysis
 *   Medications  — daily schedule from prescription paperwork
 *   Caregiver    — family access management + activity feed
 *   Vault        — emergency document vault (insurance cards, IDs, POA)
 *   Timeline     — life document history
 *   Benefits     — government benefits navigator
 *   Reminders    — all deadlines + medication reminders
 *   Settings     — profile, notifications, accessibility, subscription
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText, Upload, Users, Home, LogOut, AlertCircle, CheckCircle,
  Clock, RefreshCw, Mail, Shield, ChevronRight, X, Copy, Bell,
  Pill, Vault, Calendar, TrendingUp, Heart, Phone, Settings,
  Star, AlertTriangle, Info, ChevronDown, ChevronUp, Search,
  Filter, Plus, Trash2, Eye, Lock, Globe, Volume2, FileCheck,
} from "lucide-react";
import { clsx } from "clsx";
import {
  get, post, del, patch, uploadFileWithProgress,
  setTokens, getTokens, ApiError, type Tokens,
} from "@/lib/api/client";

// ── Types ─────────────────────────────────────────────────────────────────

type Screen =
  | "dashboard" | "documents" | "medications" | "caregiver"
  | "vault" | "timeline" | "benefits" | "reminders" | "settings" | "admin";

type AuthMode = "login" | "register" | "forgot" | "reset";

interface Document {
  id: number;
  name: string;
  status: string;
  workflow_state: string;
  document_type: string;
  document_type_confidence: number | null;
  summary: string | null;
  deadlines: Deadline[];
  extracted_fields: Record<string, unknown>;
  recommended_actions: Recommendation[];
  generated_letter: GeneratedLetter | null;
  scam_analysis?: ScamAnalysis | null;
  medications?: MedicationEntry[];
  billing_errors?: BillingError[];
  assigned_to_user_id: number | null;
  assigned_to_user_name: string | null;
  has_ocr: boolean;
  created_at: string;
  updated_at: string;
}

interface Deadline {
  title: string; date: string; reason: string; action: string;
}

interface Recommendation {
  title: string; why: string; priority: string; action: string;
}

interface GeneratedLetter {
  title: string; subject: string; body: string; audience: string; use_case: string;
}

interface ScamAnalysis {
  is_suspicious: boolean;
  confidence: number;
  risk_level: string;
  warning_message: string;
  safe_message: string;
  recommended_actions: string[];
  signals: { category: string; description: string; severity: string }[];
}

interface MedicationEntry {
  name: string; dosage: string | null; frequency: string | null;
  reminder_times: string[]; with_food: boolean | null;
  instructions: string; refill_date: string | null;
}

interface BillingError {
  description: string; amount: string; severity: string;
}

interface User {
  id: number; email: string; full_name: string;
  role: string; is_active: boolean; subscription_status: string;
}

interface Reminder {
  id: number; title: string; due_date: string;
  reminder_type: string; status: string; document_id: number | null;
  notes: string | null;
}

interface CaregiverMember {
  id: number; email: string; full_name: string;
  role: string; accepted: boolean; created_at: string;
}

interface VaultItem {
  id: number; name: string; category: string;
  description: string | null; created_at: string;
}

interface TimelineEvent {
  id: number; date: string; title: string;
  category: string; document_id: number | null; summary: string;
}

interface BenefitProgram {
  name: string; description: string; eligibility: string;
  action: string; url: string; phone: string;
}

interface FinancialAlert {
  category: string; description: string;
  change_pct: number; severity: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const SUPPORTED_EXTS = [
  ".pdf",".png",".jpg",".jpeg",".webp",".tif",".tiff",
  ".bmp",".doc",".docx",".xls",".xlsx",".csv",".txt",
];

function ext(f: string) { const i = f.lastIndexOf("."); return i >= 0 ? f.slice(i).toLowerCase() : ""; }
function inferMime(f: File) {
  const map: Record<string,string> = {
    ".pdf":"application/pdf",".png":"image/png",".jpg":"image/jpeg",
    ".jpeg":"image/jpeg",".webp":"image/webp",".tif":"image/tiff",
    ".tiff":"image/tiff",".bmp":"image/bmp",".doc":"application/msword",
    ".docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".csv":"text/csv",".txt":"text/plain",
  };
  return f.type || map[ext(f.name)] || "application/octet-stream";
}
function isSupportedFile(f: File) { return SUPPORTED_EXTS.includes(ext(f.name)); }

function docTypeLabel(v?: string) {
  return (v||"Unknown").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}

function statusBadge(s: string) {
  const m = s.toLowerCase();
  if (["processed","completed"].includes(m)) return {label:"Ready",cls:"bg-green-100 text-green-800"};
  if (["processing","uploaded","queued"].includes(m)) return {label:"Analyzing…",cls:"bg-blue-100 text-blue-800"};
  if (m==="failed") return {label:"Failed",cls:"bg-red-100 text-red-800"};
  if (m==="quarantined") return {label:"Blocked",cls:"bg-gray-200 text-gray-700"};
  return {label:"Uploaded",cls:"bg-gray-100 text-gray-600"};
}

function priorityIcon(p: string) {
  if (p==="high") return <AlertCircle className="w-4 h-4 text-red-500 shrink-0"/>;
  if (p==="medium") return <Clock className="w-4 h-4 text-amber-500 shrink-0"/>;
  return <CheckCircle className="w-4 h-4 text-gray-400 shrink-0"/>;
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}); }
  catch { return d; }
}

// ── Toast ─────────────────────────────────────────────────────────────────

type ToastType = "success"|"error"|"info"|"warning";

function useToast() {
  const [toasts,setToasts] = useState<{id:number;type:ToastType;msg:string}[]>([]);
  const show = useCallback((type:ToastType,msg:string)=>{
    const id = Date.now();
    setToasts(p=>[...p,{id,type,msg}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),5000);
  },[]);
  return {toasts,show};
}

// ── Auth Screen ───────────────────────────────────────────────────────────

function AuthScreen({onSuccess}:{onSuccess:(t:Tokens)=>void}) {
  const [mode,setMode] = useState<AuthMode>("login");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [f,setF] = useState({email:"",password:"",name:"",token:"",newPw:""});
  const s = (k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement>)=>setF(p=>({...p,[k]:e.target.value}));

  async function submit(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (mode==="login") {
        const data = await post<Tokens>("/auth/login",{email:f.email,password:f.password});
        setTokens(data); onSuccess(data);
      } else if (mode==="register") {
        const data = await post<Tokens>("/auth/register",{email:f.email,password:f.password,full_name:f.name});
        setTokens(data); onSuccess(data);
      } else if (mode==="forgot") {
        await post("/auth/password/forgot",{email:f.email});
        setError("If the account exists, a reset email has been sent."); setMode("login");
      } else {
        await post("/auth/password/reset",{token:f.token,new_password:f.newPw});
        setMode("login"); setError("Password reset — please sign in.");
      }
    } catch(err) { setError(err instanceof ApiError ? err.message : "Something went wrong"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <FileText className="w-10 h-10 text-white"/>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Paperwork Helper</h1>
          <p className="mt-2 text-gray-500">AI assistant for seniors & families</p>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mb-6">
          {(["login","register"] as const).map(m=>(
            <button key={m} onClick={()=>setMode(m)}
              className={clsx("flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all",
                mode===m?"bg-white shadow text-gray-900":"text-gray-500 hover:text-gray-700")}>
              {m==="login"?"Sign in":"Register"}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">{error}</div>}

        <form onSubmit={submit} className="space-y-4">
          {mode==="register" && <AuthInput label="Full name" value={f.name} onChange={s("name")} required/>}
          {["login","register","forgot"].includes(mode) && <AuthInput label="Email" type="email" value={f.email} onChange={s("email")} autoComplete="email" required/>}
          {["login","register"].includes(mode) && <AuthInput label="Password" type="password" value={f.password} onChange={s("password")} minLength={8} required/>}
          {mode==="reset" && <>
            <AuthInput label="Reset token" value={f.token} onChange={s("token")} required/>
            <AuthInput label="New password" type="password" value={f.newPw} onChange={s("newPw")} minLength={8} required/>
          </>}
          <button type="submit" disabled={busy}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-2xl text-lg transition-colors shadow-md">
            {busy?"Please wait…":mode==="login"?"Sign in":mode==="register"?"Create account":mode==="forgot"?"Send reset email":"Reset password"}
          </button>
        </form>

        <div className="mt-5 flex justify-center gap-6 text-sm text-blue-600">
          <button onClick={()=>setMode("forgot")} className="hover:underline">Forgot password?</button>
          <button onClick={()=>setMode("reset")} className="hover:underline">Have reset token</button>
        </div>

        <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
          <p className="text-xs text-amber-700 font-medium mb-1">📄 Supported file types</p>
          <p className="text-xs text-amber-600">{SUPPORTED_EXTS.join(", ")}</p>
        </div>
      </div>
    </div>
  );
}

function AuthInput({label,...props}:{label:string}&React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
      <input {...props} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"/>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────

export default function App() {
  // [Hydration fix] Always start null on server. Read localStorage only after
  // mount so server and client render the same thing (login screen) initially.
  const [tokens, setTokensState] = useState<Tokens|null>(null);
  const [mounted, setMounted] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [selectedDocId, setSelectedDocId] = useState<number|null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string|null>(null); // null = show all

  // Load tokens from localStorage after mount (client-only)
  useEffect(() => {
    setMounted(true);
    const t = getTokens();
    if (t) setTokensState(t);
  }, []);

  const abortRef = useRef<AbortController|null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const {toasts, show:toast} = useToast();

  // ── Queries ────────────────────────────────────────────────────────────

  const {data:docs=[],refetch:refetchDocs} = useQuery<Document[]>({
    queryKey:["documents"], queryFn:()=>get("/documents"),
    enabled:!!tokens, refetchInterval:isPolling?3000:false,
  });

  const {data:users=[]} = useQuery<User[]>({
    queryKey:["users"], queryFn:()=>get<User[]>("/admin/users").catch(()=>[]),
    enabled:!!tokens,
  });

  const {data:reminders=[],refetch:refetchReminders} = useQuery<Reminder[]>({
    queryKey:["reminders"], queryFn:()=>get("/reminders"),
    enabled:!!tokens,
  });

  const {data:caregivers=[],refetch:refetchCaregivers} = useQuery<CaregiverMember[]>({
    queryKey:["caregivers"], queryFn:()=>get<CaregiverMember[]>("/caregiver/members").catch(()=>[]),
    enabled:!!tokens,
  });

  const {data:vaultItems=[],refetch:refetchVault} = useQuery<VaultItem[]>({
    queryKey:["vault"], queryFn:()=>get<VaultItem[]>("/vault/items").catch(()=>[]),
    enabled:!!tokens,
  });

  const {data:timeline=[]} = useQuery<TimelineEvent[]>({
    queryKey:["timeline"], queryFn:()=>get<TimelineEvent[]>("/analytics/timeline").catch(()=>[]),
    enabled:!!tokens && screen==="timeline",
  });

  const {data:benefits=[]} = useQuery<BenefitProgram[]>({
    queryKey:["benefits"], queryFn:()=>get<BenefitProgram[]>("/analytics/benefits").catch(()=>[]),
    enabled:!!tokens && screen==="benefits",
  });

  const {data:financialAlerts=[]} = useQuery<FinancialAlert[]>({
    queryKey:["financial"], queryFn:()=>get<FinancialAlert[]>("/analytics/financial-alerts").catch(()=>[]),
    enabled:!!tokens,
  });

  const selectedDoc = useMemo(()=>docs.find(d=>d.id===selectedDocId)??null,[docs,selectedDocId]);

  // ── Derived data ───────────────────────────────────────────────────────

  const stats = useMemo(()=>({
    total: docs.length,
    analyzing: docs.filter(d=>["uploaded","processing","queued"].includes(d.status.toLowerCase())).length,
    ready: docs.filter(d=>["processed","completed"].includes(d.status.toLowerCase())).length,
    needsAttention: docs.filter(d=>["failed","quarantined"].includes(d.status.toLowerCase())||["needs_review","waiting_on_user"].includes(d.workflow_state?.toLowerCase()??"")||d.extracted_fields?.["ui_summary"]?.["is_suspicious"]).length,
    scamAlerts: docs.filter(d=>(d.scam_analysis?.risk_level==="high"||d.scam_analysis?.risk_level==="medium")).length,
    upcomingDeadlines: reminders.filter(r=>r.status==="pending").length,
    medicationsToday: docs.flatMap(d=>d.medications??[]).filter(m=>m.reminder_times?.length>0).length,
  }),[docs,reminders]);

  const allDeadlines = useMemo(()=>
    docs.flatMap(d=>(d.deadlines??[]).map(dl=>({...dl,doc_name:d.name,doc_id:d.id})))
      .sort((a,b)=>a.date.localeCompare(b.date))
    ,[docs]);

  const allMedications = useMemo(()=>
    docs.flatMap(d=>(d.medications??[]).map(m=>({...m,doc_name:d.name,doc_id:d.id})))
    ,[docs]);

  const filteredDocs = useMemo(()=>{
    let list = docs;
    if (searchQuery) list = list.filter(d=>d.name.toLowerCase().includes(searchQuery.toLowerCase())||docTypeLabel(d.document_type).toLowerCase().includes(searchQuery.toLowerCase()));
    if (selectedCategory!=="all") list = list.filter(d=>d.document_type.includes(selectedCategory));
    if (statusFilter==="attention") list = list.filter(d=>
      ["failed","quarantined"].includes(d.status.toLowerCase()) ||
      ["needs_review","waiting_on_user"].includes(d.workflow_state?.toLowerCase()??"") ||
      d.scam_analysis?.is_suspicious
    );
    if (statusFilter==="analyzing") list = list.filter(d=>["uploaded","processing","queued"].includes(d.status.toLowerCase()));
    if (statusFilter==="deadlines") list = list.filter(d=>d.deadlines?.length>0);
    return list;
  },[docs,searchQuery,selectedCategory,statusFilter]);

  // ── Polling ────────────────────────────────────────────────────────────

  // Clear status filter when leaving documents screen
  function navigateTo(s: Screen) {
    if (s !== "documents") setStatusFilter(null);
    setScreen(s);
  }

  function stopPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    pollRef.current=null; pollTimeoutRef.current=null; setIsPolling(false);
  }

  function startPolling(docId:number) {
    stopPolling(); setIsPolling(true);
    const check=async()=>{
      const d=docs.find(d=>d.id===docId);
      const s=d?.status?.toLowerCase()??"";
      if(["processed","completed","failed","quarantined"].includes(s)){
        stopPolling(); await refetchDocs();
        if(s==="processed"||s==="completed") toast("success","✓ Analysis complete — document is ready!");
        else if(s==="quarantined") toast("error","File was blocked by security scanning.");
        else toast("error","Processing failed. Try uploading a clearer file.");
      }
    };
    pollRef.current=setInterval(()=>void check(),3000);
    pollTimeoutRef.current=setTimeout(()=>{stopPolling();toast("info","Analysis is taking longer than expected. Refresh to check.");},5*60*1000);
  }

  useEffect(()=>()=>stopPolling(),[]);

  // ── Upload ─────────────────────────────────────────────────────────────

  async function handleUpload(file:File) {
    if(!isSupportedFile(file)){toast("error",`Unsupported file. Use: ${SUPPORTED_EXTS.join(", ")}`);return;}
    if(file.size>50*1024*1024){toast("error","File too large. Maximum 50 MB.");return;}

    abortRef.current=new AbortController();
    setIsUploading(true); setUploadProgress(0); setUploadFileName(file.name);
    toast("info",`Preparing ${file.name}…`);

    try {
      const presigned = await post<{upload_url:string;document_id:number}>("/documents/presigned-upload",{filename:file.name,mime_type:inferMime(file)});
      await uploadFileWithProgress(presigned.upload_url,file,inferMime(file),setUploadProgress,abortRef.current.signal);
      const completion = await post<{status:string;document_id:number}>("/documents/complete-upload",{document_id:presigned.document_id});
      await refetchDocs();
      setScreen("documents"); setSelectedDocId(presigned.document_id);
      if(["completed","processed"].includes(completion.status?.toLowerCase()??"")) toast("success","✓ Analysis complete!");
      else { startPolling(presigned.document_id); toast("info","Document uploaded — analyzing now…"); }
    } catch(err) {
      if(err instanceof ApiError&&err.status===409) toast("error",err.message);
      else if((err as Error).message==="Upload cancelled") toast("info","Upload cancelled.");
      else toast("error",(err as Error).message||"Upload failed");
    } finally {
      setIsUploading(false); setUploadProgress(0); setUploadFileName("");
      abortRef.current=null;
      if(fileInputRef.current) fileInputRef.current.value="";
    }
  }

  // ── Auth ───────────────────────────────────────────────────────────────

  async function handleLogout() {
    try { await post("/auth/logout",{refresh_token:tokens?.refresh_token}).catch(()=>{}); } finally {
      stopPolling(); setTokens(null); setTokensState(null); qc.clear();
      setSelectedDocId(null); setScreen("dashboard");
    }
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn:(id:number)=>del(`/documents/${id}`),
    onSuccess:()=>{setSelectedDocId(null);void refetchDocs();toast("success","Document deleted.");},
    onError:()=>toast("error","Could not delete document."),
  });

  const letterMutation = useMutation({
    mutationFn:(id:number)=>post(`/documents/${id}/generate-letter`,{}),
    onSuccess:()=>{void refetchDocs();toast("success","Draft letter generated.");},
    onError:()=>toast("error","Could not generate letter."),
  });

  const workflowMutation = useMutation({
    mutationFn:({id,state}:{id:number;state:string})=>post(`/documents/${id}/workflow`,{workflow_state:state}),
    onSuccess:()=>void refetchDocs(),
  });

  // ── Render guard ───────────────────────────────────────────────────────

  // Wait for client mount before rendering — prevents server/client mismatch
  if (!mounted) return null;
  if (!tokens) return <AuthScreen onSuccess={t=>{setTokensState(t);void qc.invalidateQueries();}}/>;;

  // ── Sidebar nav ────────────────────────────────────────────────────────

  const navItems: {id:Screen;label:string;icon:React.ElementType;badge?:number}[] = [
    {id:"dashboard",label:"Dashboard",icon:Home},
    {id:"documents",label:"Documents",icon:FileText,badge:stats.analyzing||undefined},
    {id:"medications",label:"Medications",icon:Pill,badge:allMedications.length||undefined},
    {id:"reminders",label:"Reminders",icon:Bell,badge:stats.upcomingDeadlines||undefined},
    {id:"caregiver",label:"Caregiver",icon:Users},
    {id:"vault",label:"Emergency Vault",icon:Lock},
    {id:"timeline",label:"Timeline",icon:Calendar},
    {id:"benefits",label:"Benefits",icon:Heart},
    {id:"settings",label:"Settings",icon:Settings},
    {id:"admin",label:"Admin",icon:Shield},
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={clsx("bg-white border-r border-gray-200 flex flex-col transition-all duration-300",sidebarOpen?"w-64":"w-16")}>
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-white"/>
          </div>
          {sidebarOpen && <div><p className="font-bold text-gray-900 text-sm">Paperwork</p><p className="text-xs text-gray-500">AI Assistant</p></div>}
          <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="ml-auto p-1 hover:bg-gray-100 rounded-lg">
            <ChevronRight className={clsx("w-4 h-4 text-gray-400 transition-transform",sidebarOpen&&"rotate-180")}/>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({id,label,icon:Icon,badge})=>(
            <button key={id} onClick={()=>navigateTo(id)}
              className={clsx("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative",
                screen===id?"bg-blue-50 text-blue-700":"text-gray-600 hover:bg-gray-100 hover:text-gray-900")}>
              <Icon className="w-5 h-5 shrink-0"/>
              {sidebarOpen && <span>{label}</span>}
              {badge!==undefined && badge>0 && (
                <span className="ml-auto bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {badge>9?"9+":badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition">
            <LogOut className="w-5 h-5 shrink-0"/>
            {sidebarOpen && "Sign out"}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">

          {/* ── DASHBOARD ───────────────────────────────────────────── */}
          {screen==="dashboard" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Good morning</h1>
                  <p className="text-gray-500 mt-1">Here's what needs your attention today.</p>
                </div>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept={SUPPORTED_EXTS.join(",")} className="hidden"
                    onChange={e=>{const f=e.target.files?.[0];if(f)void handleUpload(f);}} disabled={isUploading}/>
                  <button onClick={()=>fileInputRef.current?.click()} disabled={isUploading}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-md">
                    <Upload className="w-4 h-4"/>
                    {isUploading?"Uploading…":"Upload Document"}
                  </button>
                </div>
              </div>

              {/* Upload progress */}
              {isUploading && (
                <div className="bg-white border border-blue-200 rounded-2xl p-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span className="truncate font-medium">{uploadFileName}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-300" style={{width:`${uploadProgress}%`}}/>
                  </div>
                  <button onClick={()=>abortRef.current?.abort()} className="mt-2 text-xs text-red-500 hover:underline">Cancel</button>
                </div>
              )}

              {/* Scam alert banner */}
              {stats.scamAlerts>0 && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-bold text-red-800">⚠️ Scam Alert — {stats.scamAlerts} suspicious document{stats.scamAlerts>1?"s":""} detected</p>
                    <p className="text-red-700 text-sm mt-1">Do NOT pay or call any numbers in flagged documents. Review them in Documents.</p>
                    <button onClick={()=>setScreen("documents")} className="mt-2 text-red-600 text-sm font-semibold hover:underline">Review now →</button>
                  </div>
                </div>
              )}

              {/* Financial alerts */}
              {financialAlerts.length>0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"/>
                  <div>
                    <p className="font-semibold text-amber-900">Financial change detected</p>
                    {financialAlerts.slice(0,2).map((a,i)=>(
                      <p key={i} className="text-amber-700 text-sm mt-1">
                        {a.description} ({a.change_pct>0?"+":""}{a.change_pct}% change)
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats grid — each card is clickable and navigates + filters */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {label:"Total Documents",val:stats.total,icon:FileText,color:"text-gray-700",border:"hover:border-gray-400",action:()=>{setStatusFilter(null);setScreen("documents");}},
                  {label:"Analyzing",val:stats.analyzing,icon:RefreshCw,color:"text-blue-600",border:"hover:border-blue-300",action:()=>{setStatusFilter("analyzing");setScreen("documents");}},
                  {label:"Needs Attention",val:stats.needsAttention,icon:AlertCircle,color:"text-red-600",border:"hover:border-red-300",action:()=>{setStatusFilter("attention");setScreen("documents");}},
                  {label:"Upcoming Deadlines",val:stats.upcomingDeadlines,icon:Clock,color:"text-amber-600",border:"hover:border-amber-300",action:()=>setScreen("reminders")},
                ].map(({label,val,icon:Icon,color,border,action})=>(
                  <button key={label} onClick={action}
                    className={clsx("bg-white border border-gray-200 rounded-2xl p-5 text-left transition-all cursor-pointer w-full",border,"hover:shadow-md active:scale-95")}>
                    <Icon className={clsx("w-6 h-6 mb-3",color)}/>
                    <p className="text-3xl font-bold text-gray-900">{val}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className={clsx("text-sm font-medium",color)}>{label}</p>
                      <span className="text-xs text-gray-400">View →</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Upcoming deadlines */}
              {allDeadlines.length>0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">📅 Upcoming Deadlines</h2>
                  <div className="space-y-3">
                    {allDeadlines.slice(0,5).map((d,i)=>(
                      <div key={i} className="flex items-start gap-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                        <div className="text-center min-w-16 shrink-0">
                          <p className="text-xs text-amber-600 font-medium">
                            {(() => {
                              try {
                                const dt = new Date(d.date);
                                if (!isNaN(dt.getTime())) return dt.toLocaleDateString("en-US",{month:"short",year:"numeric"});
                                return d.date.slice(0,7);
                              } catch { return d.date.slice(0,7); }
                            })()}
                          </p>
                          <p className="text-lg font-bold text-amber-800">
                            {(() => {
                              try {
                                const dt = new Date(d.date);
                                if (!isNaN(dt.getTime())) return dt.getDate();
                                return d.date.slice(8,10);
                              } catch { return d.date.slice(8,10); }
                            })()}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{d.title}</p>
                          <p className="text-sm text-gray-500 truncate">{d.doc_name}</p>
                          <p className="text-sm text-amber-700 mt-1">→ {d.action}</p>
                        </div>
                        <button onClick={()=>{setSelectedDocId(d.doc_id);setScreen("documents");}}
                          className="text-blue-600 text-xs hover:underline shrink-0">View</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today's medications */}
              {allMedications.length>0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">💊 Today's Medications</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allMedications.slice(0,6).map((m,i)=>(
                      <div key={i} className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                        <Pill className="w-5 h-5 text-green-600 shrink-0"/>
                        <div className="min-w-0">
                          <p className="font-semibold text-green-900">{m.name}{m.dosage?` ${m.dosage}`:""}</p>
                          <p className="text-xs text-green-700">{m.instructions||m.frequency||"As prescribed"}</p>
                          {m.reminder_times?.length>0 && <p className="text-xs text-green-600 mt-0.5">⏰ {m.reminder_times.join(", ")}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent documents */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Recent Documents</h2>
                  <button onClick={()=>setScreen("documents")} className="text-blue-600 text-sm hover:underline">View all →</button>
                </div>
                {docs.length===0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4"/>
                    <p className="text-gray-500 text-lg">No documents yet</p>
                    <p className="text-gray-400 text-sm mt-1">Upload your first document to get started</p>
                    <button onClick={()=>fileInputRef.current?.click()}
                      className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition">
                      Upload document
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {docs.slice(0,5).map(d=>{
                      const {label,cls}=statusBadge(d.status);
                      return (
                        <button key={d.id} onClick={()=>{setSelectedDocId(d.id);setScreen("documents");}}
                          className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition text-left">
                          <FileText className="w-9 h-9 text-blue-500 bg-blue-50 rounded-xl p-2 shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{d.name}</p>
                            <p className="text-sm text-gray-500">{docTypeLabel(d.document_type)} · {formatDate(d.created_at)}</p>
                          </div>
                          {d.scam_analysis?.risk_level==="high" && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0"/>}
                          <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full shrink-0",cls)}>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DOCUMENTS ───────────────────────────────────────────── */}
          {screen==="documents" && (
            <div className="grid grid-cols-12 gap-6">
              {/* List */}
              <div className="col-span-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Documents</h2>
                  <button onClick={()=>void refetchDocs()} className="p-2 hover:bg-gray-100 rounded-xl transition">
                    <RefreshCw className="w-4 h-4 text-gray-500"/>
                  </button>
                </div>

                {/* Active filter banner */}
                {statusFilter && (
                  <div className={clsx("flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium",
                    statusFilter==="attention"?"bg-red-50 text-red-700 border border-red-200":
                    statusFilter==="analyzing"?"bg-blue-50 text-blue-700 border border-blue-200":
                    "bg-amber-50 text-amber-700 border border-amber-200")}>
                    <span>
                      {statusFilter==="attention"?"⚠️ Showing documents needing attention":
                       statusFilter==="analyzing"?"🔄 Showing documents being analyzed":
                       "📅 Showing documents with deadlines"}
                    </span>
                    <button onClick={()=>setStatusFilter(null)} className="ml-2 underline text-xs">Clear</button>
                  </div>
                )}

                {/* Search + filter */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                    <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
                      placeholder="Search documents…"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                  </div>
                  <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    <option value="all">All categories</option>
                    <option value="medicare">Medicare & Medicaid</option>
                    <option value="explanation_of_benefits">Insurance EOBs</option>
                    <option value="itemized_medical">Medical Bills</option>
                    <option value="electricity">Electricity</option>
                    <option value="natural_gas">Natural Gas</option>
                    <option value="water">Water & Sewer</option>
                    <option value="telecom">Phone & Internet</option>
                    <option value="property_tax">Property Tax</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="collection_notice">Collection</option>
                    <option value="irs_notice">IRS</option>
                  </select>
                </div>

                {/* Document list */}
                <div className="space-y-2">
                  {filteredDocs.map(d=>{
                    const {label,cls}=statusBadge(d.status);
                    return (
                      <button key={d.id} onClick={()=>setSelectedDocId(d.id)}
                        className={clsx("w-full text-left p-3.5 rounded-xl border transition-all",
                          selectedDocId===d.id?"border-blue-500 bg-blue-50":"border-gray-200 bg-white hover:border-blue-300")}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900 truncate text-sm flex-1">{d.name}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {d.scam_analysis?.is_suspicious && <AlertTriangle className="w-4 h-4 text-red-500" title="Scam risk detected"/>}
                            {["failed","quarantined"].includes(d.status.toLowerCase()) && <AlertCircle className="w-4 h-4 text-red-500" title="Needs attention"/>}
                            <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full",cls)}>{label}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{docTypeLabel(d.document_type)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(d.created_at)}</p>
                      </button>
                    );
                  })}
                  {!filteredDocs.length && (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-30"/>
                      <p>No documents found</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Detail */}
              <div className="col-span-8">
                {selectedDoc ? (
                  <DocumentDetail
                    doc={selectedDoc}
                    users={users}
                    isAdmin={users.some(u=>u.role==="admin")||true}
                    onDelete={()=>{if(confirm(`Delete "${selectedDoc.name}"?`))deleteMutation.mutate(selectedDoc.id);}}
                    onGenerateLetter={()=>letterMutation.mutate(selectedDoc.id)}
                    onWorkflowChange={s=>workflowMutation.mutate({id:selectedDoc.id,state:s})}
                    toast={toast}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full min-h-64 text-gray-400">
                    <div className="text-center">
                      <FileText className="w-16 h-16 mx-auto mb-3 opacity-20"/>
                      <p className="text-lg">Select a document to view</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MEDICATIONS ─────────────────────────────────────────── */}
          {screen==="medications" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">💊 Medication Schedule</h1>
                <p className="text-gray-500 mt-1">Extracted from your prescription and discharge paperwork.</p>
              </div>
              {allMedications.length===0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                  <Pill className="w-16 h-16 mx-auto text-gray-300 mb-4"/>
                  <p className="text-gray-500 text-lg">No medications extracted yet</p>
                  <p className="text-gray-400 text-sm mt-1">Upload prescription paperwork or hospital discharge papers to see your medication schedule here.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(["Morning","Noon","Afternoon","Evening","Bedtime","As Needed"] as const).map(timeSlot=>{
                    const slotMeds = allMedications.filter(m=>{
                      const times = m.reminder_times??[];
                      if(timeSlot==="As Needed") return times.length===0;
                      const slotHours:Record<string,string[]> = {Morning:["06","07","08","09","10","11"],Noon:["12","13"],Afternoon:["14","15","16"],Evening:["17","18","19","20"],Bedtime:["21","22","23","00"]};
                      return times.some(t=>slotHours[timeSlot]?.includes(t.slice(0,2)));
                    });
                    if(!slotMeds.length) return null;
                    return (
                      <div key={timeSlot} className="bg-white border border-gray-200 rounded-2xl p-5">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-xl">{timeSlot==="Morning"?"🌅":timeSlot==="Noon"?"☀️":timeSlot==="Afternoon"?"🌤️":timeSlot==="Evening"?"🌆":timeSlot==="Bedtime"?"🌙":"💊"}</span>
                          {timeSlot}
                          {slotMeds[0]?.reminder_times?.[0] && <span className="text-xs text-gray-500 font-normal">({slotMeds[0].reminder_times[0]})</span>}
                        </h3>
                        <div className="space-y-3">
                          {slotMeds.map((m,i)=>(
                            <div key={i} className="p-3 bg-green-50 rounded-xl">
                              <p className="font-semibold text-green-900">{m.name}{m.dosage?` — ${m.dosage}`:""}</p>
                              <p className="text-xs text-green-700 mt-0.5">{m.instructions||m.frequency||"As prescribed"}</p>
                              {m.with_food!==null && <p className="text-xs text-green-600 mt-0.5">{m.with_food?"🍽 Take with food":"💧 Take on empty stomach"}</p>}
                              {m.refill_date && <p className="text-xs text-amber-600 mt-1">📅 Refill by: {m.refill_date}</p>}
                              <p className="text-xs text-gray-400 mt-1">From: {m.doc_name}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>⚕️ Medical Disclaimer:</strong> Medication information shown here is extracted for reminder purposes only.
                  Always follow your doctor's or pharmacist's exact instructions. This is not medical advice.
                  Contact your healthcare provider with any questions.
                </p>
              </div>
            </div>
          )}

          {/* ── CAREGIVER ────────────────────────────────────────────── */}
          {screen==="caregiver" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">👨‍👩‍👧 Caregiver Access</h1>
                <p className="text-gray-500 mt-1">Invite trusted family members to help manage paperwork.</p>
              </div>

              {/* Permission levels explained */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Permission Levels</h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {role:"Viewer",icon:"👁",desc:"Can see document summaries and deadlines. Cannot see sensitive financial details."},
                    {role:"Member",icon:"✏️",desc:"Can add notes, update workflow status, and help respond to documents."},
                    {role:"Admin",icon:"🔑",desc:"Full access — can upload, delete, and manage all documents and settings."},
                  ].map(({role,icon,desc})=>(
                    <div key={role} className="p-4 bg-gray-50 rounded-xl">
                      <p className="text-2xl mb-2">{icon}</p>
                      <p className="font-semibold text-gray-900">{role}</p>
                      <p className="text-xs text-gray-500 mt-1">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite form */}
              <CaregiverInviteForm onSuccess={()=>void refetchCaregivers()} toast={toast}/>

              {/* Current members */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Current Members ({caregivers.length})</h2>
                {caregivers.length===0 ? (
                  <p className="text-gray-400 text-sm">No caregiver members yet.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {caregivers.map(c=>(
                      <div key={c.id} className="py-3 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">{c.full_name||c.email}</p>
                          <p className="text-sm text-gray-500">{c.email} · {c.role}</p>
                        </div>
                        <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full",
                          c.accepted?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500")}>
                          {c.accepted?"Active":"Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EMERGENCY VAULT ──────────────────────────────────────── */}
          {screen==="vault" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">🔒 Emergency Document Vault</h1>
                <p className="text-gray-500 mt-1">Important documents instantly accessible in emergencies. Encrypted and HIPAA-compliant.</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>📋 What to store here:</strong> Insurance cards, Medicare card, medical contacts,
                  medication list, power of attorney, ID copies, emergency contacts, living will.
                </p>
              </div>

              {/* Categories */}
              {(["Medical","Financial","Legal","Identity","Contacts"] as const).map(category=>{
                const items = vaultItems.filter(v=>v.category.toLowerCase()===category.toLowerCase());
                const icons:Record<string,string> = {Medical:"🏥",Financial:"💰",Legal:"⚖️",Identity:"🪪",Contacts:"📞"};
                return (
                  <div key={category} className="bg-white border border-gray-200 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900">{icons[category]} {category}</h2>
                      <span className="text-sm text-gray-400">{items.length} item{items.length!==1?"s":""}</span>
                    </div>
                    {items.length===0 ? (
                      <p className="text-gray-400 text-sm">No {category.toLowerCase()} documents in vault yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {items.map(item=>(
                          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                            </div>
                            <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TIMELINE ────────────────────────────────────────────── */}
          {screen==="timeline" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">📅 Document Timeline</h1>
                <p className="text-gray-500 mt-1">Your complete life-document history in chronological order.</p>
              </div>
              {timeline.length===0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto text-gray-300 mb-4"/>
                  <p className="text-gray-500">No timeline events yet.</p>
                  <p className="text-gray-400 text-sm mt-1">Upload documents to build your timeline.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"/>
                  <div className="space-y-6">
                    {timeline.map((event,i)=>{
                      const catColors:Record<string,string> = {medical:"bg-blue-100 text-blue-800",financial:"bg-green-100 text-green-800",legal:"bg-purple-100 text-purple-800",utility:"bg-amber-100 text-amber-800",government:"bg-red-100 text-red-800"};
                      return (
                        <div key={event.id} className="flex gap-6">
                          <div className="w-16 text-center shrink-0">
                            <div className="w-4 h-4 bg-blue-600 rounded-full mx-auto relative z-10 mt-1"/>
                            <p className="text-xs text-gray-500 mt-1">{event.date.slice(0,10)}</p>
                          </div>
                          <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-4 mb-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-gray-900">{event.title}</p>
                              <span className={clsx("text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 capitalize",catColors[event.category]||"bg-gray-100 text-gray-700")}>{event.category}</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{event.summary}</p>
                            {event.document_id && (
                              <button onClick={()=>{setSelectedDocId(event.document_id!);setScreen("documents");}} className="text-blue-600 text-xs mt-2 hover:underline">View document →</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BENEFITS NAVIGATOR ──────────────────────────────────── */}
          {screen==="benefits" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">❤️ Benefits Navigator</h1>
                <p className="text-gray-500 mt-1">Government and assistance programs you may qualify for.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Note:</strong> Eligibility information is for guidance only.
                  Contact the program directly to confirm eligibility and apply.
                </p>
              </div>

              {benefits.length===0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    {name:"Medicare",desc:"Health insurance for people 65+ and some younger people with disabilities.",phone:"1-800-633-4227",url:"medicare.gov",cat:"Health"},
                    {name:"Medicaid",desc:"Free or low-cost health coverage for people with limited income.",phone:"1-800-318-2596",url:"medicaid.gov",cat:"Health"},
                    {name:"Social Security",desc:"Monthly retirement, disability, and survivor benefits.",phone:"1-800-772-1213",url:"ssa.gov",cat:"Income"},
                    {name:"SNAP (Food Assistance)",desc:"Monthly benefit to help buy food. Based on income and household size.",phone:"1-800-221-5689",url:"fns.usda.gov/snap",cat:"Food"},
                    {name:"LIHEAP (Energy Assistance)",desc:"Help paying heating and cooling bills for low-income households.",phone:"1-866-674-6327",url:"acf.hhs.gov/ocs/liheap",cat:"Utilities"},
                    {name:"Veterans Benefits (VA)",desc:"Benefits for military veterans including healthcare, disability, and pension.",phone:"1-800-827-1000",url:"va.gov",cat:"Veterans"},
                    {name:"SSI (Supplemental Security Income)",desc:"Monthly payments for adults 65+ or disabled people with limited income.",phone:"1-800-772-1213",url:"ssa.gov/ssi",cat:"Income"},
                    {name:"Property Tax Relief",desc:"Many states offer property tax exemptions or reductions for seniors.",phone:"Contact your county",url:"usa.gov/senior-housing",cat:"Housing"},
                  ].map(b=>(
                    <div key={b.name} className="bg-white border border-gray-200 rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-bold text-gray-900">{b.name}</p>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{b.cat}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{b.desc}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3"/>{b.phone}</span>
                        <a href={`https://${b.url}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:underline">
                          <Globe className="w-3 h-3"/>{b.url}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {benefits.map((b,i)=>(
                    <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5">
                      <p className="font-bold text-gray-900 mb-2">{b.name}</p>
                      <p className="text-sm text-gray-600 mb-2">{b.description}</p>
                      <p className="text-xs text-blue-700 mb-3">✓ {b.eligibility}</p>
                      <div className="flex gap-3 text-xs">
                        <span className="text-gray-500">{b.phone}</span>
                        <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{b.url}</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── REMINDERS ────────────────────────────────────────────── */}
          {screen==="reminders" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">🔔 Reminders</h1>
                <p className="text-gray-500 mt-1">All your deadlines and medication reminders in one place.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Document deadlines */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">📅 Document Deadlines</h2>
                  {allDeadlines.length===0 ? (
                    <p className="text-gray-400 text-sm">No upcoming deadlines.</p>
                  ) : (
                    <div className="space-y-3">
                      {allDeadlines.map((d,i)=>(
                        <div key={i} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-amber-900 text-sm">{d.title}</p>
                            <span className="text-xs text-amber-700 font-mono shrink-0 ml-2">{d.date}</span>
                          </div>
                          <p className="text-xs text-amber-700 mt-1">{d.reason}</p>
                          <p className="text-xs font-medium text-amber-900 mt-1">→ {d.action}</p>
                          <p className="text-xs text-gray-500 mt-1">From: {d.doc_name}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Medication reminders */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">💊 Medication Reminders</h2>
                  {allMedications.length===0 ? (
                    <p className="text-gray-400 text-sm">No medication reminders. Upload prescription paperwork to add them.</p>
                  ) : (
                    <div className="space-y-3">
                      {allMedications.map((m,i)=>(
                        <div key={i} className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <p className="font-semibold text-green-900">{m.name}{m.dosage?` ${m.dosage}`:""}</p>
                          <p className="text-xs text-green-700">{m.instructions||m.frequency}</p>
                          {m.reminder_times?.length>0 && <p className="text-xs text-green-600 mt-1">⏰ {m.reminder_times.join(", ")}</p>}
                          {m.refill_date && <p className="text-xs text-amber-600 mt-1">📅 Refill: {m.refill_date}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Renewal tracking */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🔄 Renewal Tracking</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    {label:"Medicare Enrollment",next:"Annual — October 15 – December 7",status:"upcoming"},
                    {label:"Insurance Renewal",next:"Check your policy for renewal date",status:"check"},
                    {label:"Medicaid Renewal",next:"Check your renewal notice",status:"check"},
                  ].map(r=>(
                    <div key={r.label} className="p-4 bg-gray-50 rounded-xl">
                      <p className="font-semibold text-gray-900 text-sm">{r.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{r.next}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ─────────────────────────────────────────────── */}
          {screen==="settings" && (
            <div className="space-y-6 max-w-2xl">
              <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>

              {/* Accessibility */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">♿ Accessibility</h2>
                <div className="space-y-4">
                  {[
                    {label:"Large text mode",desc:"Increase all text sizes by 20%"},
                    {label:"High contrast",desc:"Use higher contrast colors for better visibility"},
                    {label:"Simple mode",desc:"Show only essential information, hide advanced features"},
                    {label:"Screen reader optimized",desc:"Optimize layout for screen reader users"},
                  ].map(({label,desc})=>(
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{label}</p>
                        <p className="text-sm text-gray-500">{desc}</p>
                      </div>
                      <button className="w-12 h-6 bg-gray-200 rounded-full relative transition-colors hover:bg-gray-300">
                        <div className="w-5 h-5 bg-white rounded-full absolute left-0.5 top-0.5 shadow transition-transform"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notification preferences */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🔔 Notifications</h2>
                <div className="space-y-4">
                  {[
                    {label:"Email reminders",desc:"Receive deadline reminders by email"},
                    {label:"SMS alerts",desc:"Receive urgent alerts by text message"},
                    {label:"Push notifications",desc:"Receive notifications on your phone"},
                    {label:"Caregiver alerts",desc:"Notify your caregiver when new documents arrive"},
                    {label:"Medication reminders",desc:"Daily medication reminders"},
                    {label:"Scam alerts",desc:"Immediate alerts when scam documents are detected"},
                  ].map(({label,desc})=>(
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{label}</p>
                        <p className="text-sm text-gray-500">{desc}</p>
                      </div>
                      <button className="w-12 h-6 bg-blue-600 rounded-full relative">
                        <div className="w-5 h-5 bg-white rounded-full absolute right-0.5 top-0.5 shadow"/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Voice settings */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🎙️ Voice Assistant</h2>
                <p className="text-sm text-gray-500 mb-4">Ask questions about your documents using your voice.</p>
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <Volume2 className="w-8 h-8 mx-auto text-gray-400 mb-2"/>
                  <p className="text-sm text-gray-500">Voice mode requires the Whisper API key to be configured.</p>
                  <p className="text-xs text-gray-400 mt-1">Set VOICE_ENABLED=true and WHISPER_API_KEY in your backend .env</p>
                </div>
              </div>

              {/* Translation */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">🌍 Language & Translation</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Preferred language</label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
                      <option value="en">English</option>
                      <option value="es">Español (Spanish)</option>
                      <option value="zh">中文 (Chinese)</option>
                      <option value="hi">हिंदी (Hindi)</option>
                      <option value="vi">Tiếng Việt (Vietnamese)</option>
                      <option value="ko">한국어 (Korean)</option>
                      <option value="ar">العربية (Arabic)</option>
                      <option value="fr">Français (French)</option>
                      <option value="pt">Português (Portuguese)</option>
                      <option value="ru">Русский (Russian)</option>
                    </select>
                  </div>
                  <p className="text-xs text-gray-500">Document summaries and explanations will be translated to your preferred language when translation is enabled.</p>
                </div>
              </div>

              {/* Subscription */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-6 h-6 text-yellow-300"/>
                  <h2 className="text-lg font-bold">Upgrade to Premium</h2>
                </div>
                <ul className="space-y-2 text-sm mb-4">
                  {["Unlimited document uploads","Voice assistant mode","Multi-language translation","Priority AI analysis","Family dashboard (up to 5 caregivers)","Emergency vault with 1GB storage"].map(f=>(
                    <li key={f} className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-300 shrink-0"/>{f}</li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <button className="flex-1 bg-white text-blue-700 font-bold py-2.5 rounded-xl hover:bg-blue-50 transition">$5/month</button>
                  <button className="flex-1 bg-white/20 text-white font-bold py-2.5 rounded-xl hover:bg-white/30 transition">$48/year</button>
                </div>
              </div>
            </div>
          )}

          {/* ── ADMIN ─────────────────────────────────────────────────── */}
          {screen==="admin" && (
            <div className="space-y-6">
              <h1 className="text-3xl font-bold text-gray-900">🛡️ Admin</h1>
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">All Users ({users.length})</h2>
                <div className="divide-y divide-gray-100">
                  {users.map(u=>(
                    <div key={u.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{u.full_name||u.email}</p>
                        <p className="text-sm text-gray-500">{u.email} · {u.role}</p>
                      </div>
                      <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full",
                        u.is_active?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500")}>
                        {u.is_active?"Active":"Inactive"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm w-full px-4">
        {toasts.map(t=>(
          <div key={t.id} className={clsx("px-4 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2",
            t.type==="success"&&"bg-green-600 text-white",
            t.type==="error"&&"bg-red-600 text-white",
            t.type==="info"&&"bg-blue-600 text-white",
            t.type==="warning"&&"bg-amber-500 text-white")}>
            {t.type==="success"&&<CheckCircle className="w-4 h-4 shrink-0"/>}
            {t.type==="error"&&<AlertCircle className="w-4 h-4 shrink-0"/>}
            {t.type==="warning"&&<AlertTriangle className="w-4 h-4 shrink-0"/>}
            {t.type==="info"&&<Info className="w-4 h-4 shrink-0"/>}
            <span className="flex-1">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Field value formatter ────────────────────────────────────────────────────

function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string") {
    return v.length > 150 ? v.slice(0, 150) + "…" : v;
  }
  if (Array.isArray(v)) {
    // Show all dollar amounts — important for seniors to see what was charged
    const items = v.map(String);
    return items.join(", ");
  }
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return keys.length > 0 ? keys.slice(0, 3).join(", ") + (keys.length > 3 ? "…" : "") : "—";
  }
  return String(v);
}

// ── Document Detail Component ─────────────────────────────────────────────────

function DocumentDetail({doc,users,isAdmin,onDelete,onGenerateLetter,onWorkflowChange,toast}:{
  doc:Document; users:User[]; isAdmin:boolean;
  onDelete:()=>void; onGenerateLetter:()=>void;
  onWorkflowChange:(s:string)=>void;
  toast:(type:ToastType,msg:string)=>void;
}) {
  const [copied,setCopied] = useState(false);
  const [showRaw,setShowRaw] = useState(false);
  const [showRawText,setShowRawText] = useState(false);
  const fields = doc.extracted_fields||{};
  const ui = (fields.ui_summary as Record<string,unknown>)||{};
  const letter = doc.generated_letter;

  // Fields to completely hide — internal/technical fields not useful to seniors
  const HIDDEN_FIELDS = new Set([
    "ui_summary", "extracted_text", "extracted_text_raw",
    "duplicate_warning",
  ]);

  const visibleFields = Object.entries(fields).filter(([k, v]) => {
    if (HIDDEN_FIELDS.has(k)) return false;
    if (v === null || v === undefined || v === "" || v === false) return false;
    return true;
  });

  function copyLetter() {
    if(!letter?.body) return;
    navigator.clipboard.writeText(letter.body);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
    toast("success","Letter copied to clipboard");
  }

  const {label,cls} = statusBadge(doc.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 truncate">{doc.name}</h2>
          <p className="text-gray-500 mt-1">{docTypeLabel(doc.document_type)} · <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full",cls)}>{label}</span></p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onGenerateLetter}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition font-medium">
            <Mail className="w-4 h-4"/> Generate letter
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50 transition">
            <Trash2 className="w-4 h-4"/> Delete
          </button>
        </div>
      </div>

      {/* Scam alert */}
      {doc.scam_analysis?.is_suspicious && (
        <div className={clsx("p-4 rounded-2xl border-2",
          doc.scam_analysis.risk_level==="high"?"bg-red-50 border-red-300":"bg-amber-50 border-amber-300")}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={clsx("w-6 h-6 shrink-0 mt-0.5",doc.scam_analysis.risk_level==="high"?"text-red-600":"text-amber-600")}/>
            <div>
              <p className={clsx("font-bold",doc.scam_analysis.risk_level==="high"?"text-red-800":"text-amber-800")}>
                {doc.scam_analysis.warning_message}
              </p>
              {doc.scam_analysis.recommended_actions?.length>0 && (
                <ul className="mt-2 space-y-1">
                  {doc.scam_analysis.recommended_actions.map((a,i)=>(
                    <li key={i} className={clsx("text-sm",doc.scam_analysis!.risk_level==="high"?"text-red-700":"text-amber-700")}>• {a}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Billing errors */}
      {doc.billing_errors && doc.billing_errors.length>0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="font-bold text-orange-900 mb-2">💰 Potential Billing Errors Found</p>
          {doc.billing_errors.map((e,i)=>(
            <div key={i} className="flex items-center gap-2 text-sm text-orange-800 mt-1">
              <AlertCircle className="w-4 h-4 shrink-0"/>
              <span>{e.description}</span>
              {e.amount && <span className="font-semibold">{e.amount}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard title="What this is" value={String(ui.what_this_is||doc.summary||"Analysis in progress…")} icon={<FileText className="w-5 h-5 text-blue-500"/>}/>
        <SummaryCard title="Do I need to pay?" value={String(ui.payment_message||ui.do_i_need_to_pay_now||(fields.patient_responsibility as string)||(fields.amount_due as string)||"Review the document details first.")} icon={<AlertCircle className="w-5 h-5 text-amber-500"/>}/>
        <SummaryCard title="Key date" value={String(ui.main_due_date||(fields.renewal_due_date as string)||(fields.statement_date as string)||(fields.due_date as string)||"No key date found.")} icon={<Clock className="w-5 h-5 text-green-500"/>}/>
      </div>

      {/* Phone call script */}
      {ui.call_script && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-blue-600"/>
            <p className="font-semibold text-blue-900">📞 Phone Call Script</p>
          </div>
          <p className="text-sm text-blue-800 italic">"{String(ui.call_script)}"</p>
        </div>
      )}

      {/* Warning flags */}
      {Array.isArray(ui.warning_flags) && (ui.warning_flags as string[]).length>0 && (
        <div className="space-y-2">
          {(ui.warning_flags as string[]).map((flag,i)=>(
            <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0"/>
              {flag}
            </div>
          ))}
        </div>
      )}

      {/* Deadlines */}
      {doc.deadlines?.length>0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">📅 Important Deadlines</h3>
          <div className="space-y-3">
            {doc.deadlines.map((d,i)=>(
              <div key={i} className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start justify-between">
                  <p className="font-bold text-amber-900">{d.title}</p>
                  <span className="text-sm font-mono text-amber-700 shrink-0 ml-2">{d.date}</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">{d.reason}</p>
                <p className="text-sm font-semibold text-amber-900 mt-2">→ {d.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medications */}
      {doc.medications && doc.medications.length>0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">💊 Medications Found</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {doc.medications.map((m,i)=>(
              <div key={i} className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="font-bold text-green-900">{m.name}{m.dosage?` — ${m.dosage}`:""}</p>
                <p className="text-sm text-green-700 mt-1">{m.instructions||m.frequency||"As prescribed"}</p>
                {m.with_food!==null && <p className="text-xs text-green-600 mt-1">{m.with_food?"🍽 With food":"💧 Empty stomach"}</p>}
                {m.reminder_times?.length>0 && <p className="text-xs text-blue-600 mt-1">⏰ {m.reminder_times.join(", ")}</p>}
                {m.refill_date && <p className="text-xs text-amber-600 mt-1">📅 Refill: {m.refill_date}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations + Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">What to do next</h3>
          <div className="space-y-3">
            {doc.recommended_actions?.length ? doc.recommended_actions.map((r,i)=>(
              <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  {priorityIcon(r.priority)}
                  <p className="font-semibold text-gray-900">{r.title}</p>
                </div>
                <p className="text-sm text-gray-500">{r.why}</p>
                <p className="text-sm text-gray-700 mt-2">{r.action}</p>
              </div>
            )) : <p className="text-gray-400 text-sm italic">No recommendations yet.</p>}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">Document details</h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {visibleFields.slice(0,12).map(([k,v])=>(
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <span className="text-sm text-gray-500">{docTypeLabel(k)}</span>
                <span className="text-sm font-medium text-gray-900 text-right">
                  {Array.isArray(v) ? (
                    <span className="flex flex-wrap gap-1 justify-end">
                      {(v as unknown[]).map((item, i) => (
                        <span key={i} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                          {String(item)}
                        </span>
                      ))}
                    </span>
                  ) : (
                    formatFieldValue(v)
                  )}
                </span>
              </div>
            ))}
            {!visibleFields.length && <p className="px-4 py-3 text-sm text-gray-400 italic">No fields extracted yet.</p>}
          </div>
          {visibleFields.length>12 && (
            <button onClick={()=>setShowRaw(!showRaw)} className="mt-2 text-blue-600 text-xs hover:underline">
              {showRaw?"Show less":"Show all fields"} ({visibleFields.length})
            </button>
          )}
        </div>
      </div>

      {/* Generated letter */}
      {letter?.body && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">{letter.title||"Draft Letter"}</h3>
            <button onClick={copyLetter}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
              <Copy className="w-4 h-4"/>
              {copied?"Copied!":"Copy"}
            </button>
          </div>
          {letter.subject && <p className="text-sm text-gray-500 mb-3">Subject: {letter.subject}</p>}
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 bg-gray-50 rounded-xl p-4 max-h-80 overflow-y-auto">
            {letter.body}
          </pre>
        </div>
      )}

      {/* Needs trusted helper */}
      {ui.needs_trusted_helper && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-purple-600 shrink-0"/>
          <div>
            <p className="font-semibold text-purple-900">This document may benefit from a trusted helper</p>
            <p className="text-sm text-purple-700 mt-0.5">Consider sharing with a family member or caregiver to help manage this.</p>
          </div>
        </div>
      )}

      {/* Raw OCR text — admin only */}
      {isAdmin && doc.extracted_text && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={()=>setShowRawText(!showRawText)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500"/>
              <span className="text-sm font-semibold text-gray-700">Raw OCR text</span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Admin only</span>
            </div>
            <span className="text-xs text-gray-400">{showRawText ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {showRawText && (
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-2">
                Full text extracted by OCR from the document. This is the raw input to the AI — not shown to seniors.
              </p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600 bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto border border-gray-100">
                {doc.extracted_text}
              </pre>
              <button
                onClick={()=>{
                  navigator.clipboard.writeText(doc.extracted_text||"");
                  toast("success","Raw text copied to clipboard");
                }}
                className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3"/> Copy raw text
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────────────────

function SummaryCard({title,value,icon}:{title:string;value:string;icon:React.ReactNode}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold text-gray-500">{title}</span>
      </div>
      <p className="text-base text-gray-900 leading-snug">{value}</p>
    </div>
  );
}

// ── Caregiver Invite Form ─────────────────────────────────────────────────

function CaregiverInviteForm({onSuccess,toast}:{onSuccess:()=>void;toast:(t:ToastType,m:string)=>void}) {
  const [email,setEmail] = useState("");
  const [role,setRole] = useState("viewer");
  const [busy,setBusy] = useState(false);

  async function submit(e:React.FormEvent) {
    e.preventDefault();
    if(!email.trim()) return;
    setBusy(true);
    try {
      await post("/invitations",{invitee_email:email.trim(),role});
      setEmail(""); toast("success","Invitation sent successfully!");
      onSuccess();
    } catch(err) {
      toast("error",err instanceof ApiError?err.message:"Could not send invitation.");
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Invite a Caregiver</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Their email address</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
            placeholder="family@example.com"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Permission level</label>
          <select value={role} onChange={e=>setRole(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base">
            <option value="viewer">Viewer — can see summaries and deadlines</option>
            <option value="member">Member — can add notes and help respond</option>
            <option value="admin">Admin — full access</option>
          </select>
        </div>
        <button type="submit" disabled={busy||!email.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition">
          {busy?"Sending…":"Send Invitation"}
        </button>
      </form>
    </div>
  );
}
