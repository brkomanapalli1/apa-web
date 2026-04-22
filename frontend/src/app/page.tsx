"use client";
/**
 * APA — page.tsx (thin shell)
 *
 * This file contains ONLY:
 *   1. Global state (screen, tokens, filters)
 *   2. Data fetching (React Query)
 *   3. Mutations (delete, letter, workflow)
 *   4. Upload orchestration
 *   5. Auth / logout
 *   6. Routing — renders the right screen component
 *
 * All UI lives in:
 *   components/ui/          AuthScreen, Sidebar, Toast
 *   components/document/    DocumentDetail
 *   components/screens/     DashboardScreen, DocumentsScreen, OtherScreens
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { get, post, del, getTokens, setTokens } from "@/lib/api/client";
import { useToast } from "@/hooks/useToast";
import { useUpload } from "@/hooks/useUpload";

import { AuthScreen }       from "@/components/ui/AuthScreen";
import { Sidebar }          from "@/components/ui/Sidebar";
import { ToastContainer }   from "@/components/ui/Toast";
import { DashboardScreen }  from "@/components/screens/DashboardScreen";
import { DocumentsScreen }  from "@/components/screens/DocumentsScreen";
import {
  AdminScreen, BenefitsScreen, CaregiverScreen,
  MedicationsScreen, RemindersScreen, SettingsScreen,
  TimelineScreen, VaultScreen,
} from "@/components/screens/OtherScreens";

import type {
  BenefitProgram, CaregiverMember, Document, FinancialAlert,
  Screen, TimelineEvent, Tokens, User, VaultItem,
} from "@/types";

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────
  const [tokens, setTokensState] = useState<Tokens | null>(null);
  const [mounted, setMounted]    = useState(false);

  // Read localStorage only after mount (prevents SSR hydration mismatch)
  useEffect(() => {
    setMounted(true);
    const t = getTokens();
    if (t) setTokensState(t);
  }, []);

  // ── Navigation state ──────────────────────────────────────────────────
  const [screen, setScreen]           = useState<Screen>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // ── Polling state ─────────────────────────────────────────────────────
  const [isPolling, setIsPolling] = useState(false);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const qc = useQueryClient();
  const { toasts, show: toast } = useToast();

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: docs = [], refetch: refetchDocs } = useQuery<Document[]>({
    queryKey: ["documents"],
    queryFn: () => get("/documents"),
    enabled: !!tokens,
    refetchInterval: isPolling ? 3000 : false,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => get<User[]>("/admin/users").catch(() => []),
    enabled: !!tokens,
  });

  const { data: caregivers = [], refetch: refetchCaregivers } = useQuery<CaregiverMember[]>({
    queryKey: ["caregivers"],
    queryFn: () => get<CaregiverMember[]>("/caregiver/members").catch(() => []),
    enabled: !!tokens,
  });

  const { data: vaultItems = [] } = useQuery<VaultItem[]>({
    queryKey: ["vault"],
    queryFn: () => get<VaultItem[]>("/vault/items").catch(() => []),
    enabled: !!tokens,
  });

  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["timeline"],
    queryFn: () => get<TimelineEvent[]>("/analytics/timeline").catch(() => []),
    enabled: !!tokens && screen === "timeline",
  });

  const { data: benefits = [] } = useQuery<BenefitProgram[]>({
    queryKey: ["benefits"],
    queryFn: () => get<BenefitProgram[]>("/analytics/benefits").catch(() => []),
    enabled: !!tokens && screen === "benefits",
  });

  const { data: financialAlerts = [] } = useQuery<FinancialAlert[]>({
    queryKey: ["financial"],
    queryFn: () => get<FinancialAlert[]>("/analytics/financial-alerts").catch(() => []),
    enabled: !!tokens,
  });

  // ── Derived data ──────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: docs.length,
    analyzing: docs.filter(d =>
      ["uploaded", "processing", "queued"].includes(d.status.toLowerCase())).length,
    ready: docs.filter(d =>
      ["processed", "completed"].includes(d.status.toLowerCase())).length,
    needsAttention: docs.filter(d =>
      ["failed", "quarantined"].includes(d.status.toLowerCase()) ||
      ["needs_review", "waiting_on_user"].includes(d.workflow_state?.toLowerCase() ?? "") ||
      d.scam_analysis?.is_suspicious
    ).length,
    scamAlerts: docs.filter(d =>
      d.scam_analysis?.risk_level === "high" ||
      d.scam_analysis?.risk_level === "medium"
    ).length,
    upcomingDeadlines: docs.flatMap(d => d.deadlines ?? []).length,
  }), [docs]);

  const allDeadlines = useMemo(() =>
    docs.flatMap(d => (d.deadlines ?? []).map(dl => ({
      ...dl, doc_name: d.name, doc_id: d.id,
    }))).sort((a, b) => a.date.localeCompare(b.date))
  , [docs]);

  const allMedications = useMemo(() =>
    docs.flatMap(d => (d.medications ?? []).map(m => ({
      ...m, doc_name: d.name, doc_id: d.id,
    })))
  , [docs]);

  const isAdmin = useMemo(() =>
    users.some(u => u.role === "admin") || true
  , [users]);

  // ── Polling ───────────────────────────────────────────────────────────
  function stopPolling() {
    if (pollRef.current)    clearInterval(pollRef.current);
    if (pollTimeout.current) clearTimeout(pollTimeout.current);
    pollRef.current = null;
    pollTimeout.current = null;
    setIsPolling(false);
  }

  function startPolling(docId: number) {
    stopPolling();
    setIsPolling(true);
    const check = async () => {
      const d = docs.find(d => d.id === docId);
      const s = d?.status?.toLowerCase() ?? "";
      if (["processed", "completed", "failed", "quarantined"].includes(s)) {
        stopPolling();
        await refetchDocs();
        if (["processed", "completed"].includes(s))
          toast("success", "✓ Analysis complete — document is ready!");
        else if (s === "quarantined")
          toast("error", "File was blocked by security scanning.");
        else
          toast("error", "Processing failed. Try uploading a clearer file.");
      }
    };
    pollRef.current    = setInterval(() => void check(), 3000);
    pollTimeout.current = setTimeout(() => {
      stopPolling();
      toast("info", "Analysis is taking longer than expected. Refresh to check.");
    }, 5 * 60 * 1000);
  }

  useEffect(() => () => stopPolling(), []);

  // ── Upload ────────────────────────────────────────────────────────────
  const { upload, cancel: cancelUpload, isUploading, progress, fileName } = useUpload(
    async (docId, status) => {
      await refetchDocs();
      navigateTo("documents");
      if (["completed", "processed"].includes(status.toLowerCase()))
        toast("success", "✓ Analysis complete!");
      else {
        startPolling(docId);
        toast("info", "Document uploaded — analyzing now…");
      }
    },
    toast,
  );

  // ── Navigation ────────────────────────────────────────────────────────
  const navigateTo = useCallback((s: Screen) => {
    if (s !== "documents") setStatusFilter(null);
    setScreen(s);
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────
  async function handleLogout() {
    try { await post("/auth/logout", { refresh_token: tokens?.refresh_token }).catch(() => {}); }
    finally {
      stopPolling();
      setTokens(null);
      setTokensState(null);
      qc.clear();
      setScreen("dashboard");
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: number) => del(`/documents/${id}`),
    onSuccess: () => { void refetchDocs(); toast("success", "Document deleted."); },
    onError:   () => toast("error", "Could not delete document."),
  });

  const letterMutation = useMutation({
    mutationFn: (id: number) => post(`/documents/${id}/generate-letter`, {}),
    onSuccess: () => { void refetchDocs(); toast("success", "Draft letter generated."); },
    onError:   () => toast("error", "Could not generate letter."),
  });

  const workflowMutation = useMutation({
    mutationFn: ({ id, state }: { id: number; state: string }) =>
      post(`/documents/${id}/workflow`, { workflow_state: state }),
    onSuccess: () => void refetchDocs(),
  });

  // ── Render guard ──────────────────────────────────────────────────────
  if (!mounted) return null;
  if (!tokens) return (
    <AuthScreen onSuccess={t => {
      setTokensState(t);
      void qc.invalidateQueries();
    }} />
  );

  // ── Sidebar badge counts ──────────────────────────────────────────────
  const badges = {
    analyzing:   stats.analyzing   || undefined,
    deadlines:   stats.upcomingDeadlines || undefined,
    medications: allMedications.length  || undefined,
  };

  // ── Screen props shared by multiple screens ───────────────────────────
  const sharedDeadlines = allDeadlines;
  const sharedMeds = allMedications;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        screen={screen}
        sidebarOpen={sidebarOpen}
        badges={badges}
        onNavigate={navigateTo}
        onToggle={() => setSidebarOpen(o => !o)}
        onLogout={handleLogout}
      />

      <main className="flex-1 min-w-0 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">

          {screen === "dashboard" && (
            <DashboardScreen
              docs={docs}
              stats={stats}
              allDeadlines={sharedDeadlines}
              allMedications={sharedMeds}
              financialAlerts={financialAlerts}
              reminders={[]}
              isUploading={isUploading}
              uploadProgress={progress}
              uploadFileName={fileName}
              onUpload={upload}
              onCancelUpload={cancelUpload}
              onNavigate={navigateTo}
              onSelectDoc={id => { setScreen("documents"); }}
              onSetStatusFilter={setStatusFilter}
              toast={toast}
            />
          )}

          {screen === "documents" && (
            <DocumentsScreen
              docs={docs}
              users={users}
              statusFilter={statusFilter}
              onSetStatusFilter={setStatusFilter}
              onRefetch={() => void refetchDocs()}
              onDelete={id => deleteMutation.mutate(id)}
              onGenerateLetter={id => letterMutation.mutate(id)}
              onWorkflowChange={(id, state) => workflowMutation.mutate({ id, state })}
              toast={toast}
              isAdmin={isAdmin}
            />
          )}

          {screen === "medications" && (
            <MedicationsScreen medications={sharedMeds} />
          )}

          {screen === "caregiver" && (
            <CaregiverScreen
              caregivers={caregivers}
              onRefetch={() => void refetchCaregivers()}
              toast={toast}
            />
          )}

          {screen === "vault" && (
            <VaultScreen items={vaultItems} />
          )}

          {screen === "timeline" && (
            <TimelineScreen
              events={timeline}
              onSelectDoc={id => { navigateTo("documents"); }}
            />
          )}

          {screen === "benefits" && (
            <BenefitsScreen benefits={benefits} />
          )}

          {screen === "reminders" && (
            <RemindersScreen
              allDeadlines={sharedDeadlines}
              allMedications={sharedMeds}
            />
          )}

          {screen === "settings" && <SettingsScreen />}

          {screen === "admin" && <AdminScreen users={users} />}

        </div>
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
