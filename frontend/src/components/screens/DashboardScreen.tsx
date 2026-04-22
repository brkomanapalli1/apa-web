"use client";
import { useRef } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle, Clock,
  FileText, Pill, RefreshCw, TrendingUp, Upload,
} from "lucide-react";
import { clsx } from "clsx";
import type { Document, FinancialAlert, MedicationEntry, Reminder, Screen } from "@/types";
import type { ToastType } from "@/types";
import { formatDate, formatDeadlineDate, statusBadge, docTypeLabel } from "@/lib/utils";

interface DashboardDeadline {
  title: string; date: string; reason: string; action: string;
  doc_name: string; doc_id: number;
}

interface Stats {
  total: number; analyzing: number; needsAttention: number;
  scamAlerts: number; upcomingDeadlines: number;
}

interface Props {
  docs: Document[];
  stats: Stats;
  allDeadlines: DashboardDeadline[];
  allMedications: (MedicationEntry & { doc_name: string; doc_id: number })[];
  financialAlerts: FinancialAlert[];
  reminders: Reminder[];
  isUploading: boolean;
  uploadProgress: number;
  uploadFileName: string;
  onUpload: (file: File) => void;
  onCancelUpload: () => void;
  onNavigate: (screen: Screen) => void;
  onSelectDoc: (id: number) => void;
  onSetStatusFilter: (f: string | null) => void;
  toast: (type: ToastType, msg: string) => void;
}

export function DashboardScreen({
  docs, stats, allDeadlines, allMedications, financialAlerts,
  isUploading, uploadProgress, uploadFileName,
  onUpload, onCancelUpload, onNavigate, onSelectDoc, onSetStatusFilter,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const STAT_CARDS = [
    {
      label: "Total Documents", val: stats.total,
      icon: FileText, color: "text-gray-700", border: "hover:border-gray-400",
      action: () => { onSetStatusFilter(null); onNavigate("documents"); },
    },
    {
      label: "Analyzing", val: stats.analyzing,
      icon: RefreshCw, color: "text-blue-600", border: "hover:border-blue-300",
      action: () => { onSetStatusFilter("analyzing"); onNavigate("documents"); },
    },
    {
      label: "Needs Attention", val: stats.needsAttention,
      icon: AlertCircle, color: "text-red-600", border: "hover:border-red-300",
      action: () => { onSetStatusFilter("attention"); onNavigate("documents"); },
    },
    {
      label: "Upcoming Deadlines", val: stats.upcomingDeadlines,
      icon: Clock, color: "text-amber-600", border: "hover:border-amber-300",
      action: () => onNavigate("reminders"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Good morning</h1>
          <p className="text-gray-500 mt-1">Here's what needs your attention today.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp,.doc,.docx,.xls,.xlsx,.csv,.txt"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
            disabled={isUploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-md"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? "Uploading…" : "Upload Document"}
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
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          <button onClick={onCancelUpload} className="mt-2 text-xs text-red-500 hover:underline">Cancel</button>
        </div>
      )}

      {/* Scam alert banner */}
      {stats.scamAlerts > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">
              ⚠️ Scam Alert — {stats.scamAlerts} suspicious document{stats.scamAlerts > 1 ? "s" : ""} detected
            </p>
            <p className="text-red-700 text-sm mt-1">
              Do NOT pay or call any numbers in flagged documents. Review them in Documents.
            </p>
            <button onClick={() => onNavigate("documents")}
              className="mt-2 text-red-600 text-sm font-semibold hover:underline">
              Review now →
            </button>
          </div>
        </div>
      )}

      {/* Financial alerts */}
      {financialAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Financial change detected</p>
            {financialAlerts.slice(0, 2).map((a, i) => (
              <p key={i} className="text-amber-700 text-sm mt-1">
                {a.description} ({a.change_pct > 0 ? "+" : ""}{a.change_pct}% change)
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, val, icon: Icon, color, border, action }) => (
          <button key={label} onClick={action}
            className={clsx(
              "bg-white border border-gray-200 rounded-2xl p-5 text-left transition-all cursor-pointer w-full",
              border, "hover:shadow-md active:scale-95"
            )}>
            <Icon className={clsx("w-6 h-6 mb-3", color)} />
            <p className="text-3xl font-bold text-gray-900">{val}</p>
            <div className="flex items-center justify-between mt-1">
              <p className={clsx("text-sm font-medium", color)}>{label}</p>
              <span className="text-xs text-gray-400">View →</span>
            </div>
          </button>
        ))}
      </div>

      {/* Upcoming deadlines */}
      {allDeadlines.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">📅 Upcoming Deadlines</h2>
          <div className="space-y-3">
            {allDeadlines.slice(0, 5).map((d, i) => {
              const { month, day } = formatDeadlineDate(d.date);
              return (
                <div key={i} className="flex items-start gap-4 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="text-center min-w-16 shrink-0">
                    <p className="text-xs text-amber-600 font-medium">{month}</p>
                    <p className="text-lg font-bold text-amber-800">{day}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{d.title}</p>
                    <p className="text-sm text-gray-500 truncate">{d.doc_name}</p>
                    <p className="text-sm text-amber-700 mt-1">→ {d.action}</p>
                  </div>
                  <button onClick={() => { onSelectDoc(d.doc_id); onNavigate("documents"); }}
                    className="text-blue-600 text-xs hover:underline shrink-0">View</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today's medications */}
      {allMedications.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">💊 Today's Medications</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {allMedications.slice(0, 6).map((m, i) => (
              <div key={i} className="p-3 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                <Pill className="w-5 h-5 text-green-600 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-green-900">{m.name}{m.dosage ? ` ${m.dosage}` : ""}</p>
                  <p className="text-xs text-green-700">{m.instructions || m.frequency || "As prescribed"}</p>
                  {m.reminder_times?.length > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">⏰ {m.reminder_times.join(", ")}</p>
                  )}
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
          <button onClick={() => onNavigate("documents")} className="text-blue-600 text-sm hover:underline">
            View all →
          </button>
        </div>
        {docs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No documents yet</p>
            <p className="text-gray-400 text-sm mt-1">Upload your first document to get started</p>
            <button onClick={() => fileInputRef.current?.click()}
              className="mt-4 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition">
              Upload document
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.slice(0, 5).map(d => {
              const { label, cls } = statusBadge(d.status);
              return (
                <button key={d.id}
                  onClick={() => { onSelectDoc(d.id); onNavigate("documents"); }}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition text-left">
                  <FileText className="w-9 h-9 text-blue-500 bg-blue-50 rounded-xl p-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{d.name}</p>
                    <p className="text-sm text-gray-500">{docTypeLabel(d.document_type)} · {formatDate(d.created_at)}</p>
                  </div>
                  {d.scam_analysis?.risk_level === "high" && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />}
                  {["failed", "quarantined"].includes(d.status.toLowerCase()) && <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />}
                  <span className={clsx("text-xs font-medium px-2.5 py-1 rounded-full shrink-0", cls)}>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
