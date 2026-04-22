"use client";
import { useState, useMemo } from "react";
import { AlertCircle, AlertTriangle, FileText, RefreshCw, Search } from "lucide-react";
import { clsx } from "clsx";
import { DocumentDetail } from "@/components/document/DocumentDetail";
import type { Document, User } from "@/types";
import type { ToastType } from "@/types";
import { docTypeLabel, statusBadge, formatDate } from "@/lib/utils";

interface Props {
  docs: Document[];
  users: User[];
  statusFilter: string | null;
  onSetStatusFilter: (f: string | null) => void;
  onRefetch: () => void;
  onDelete: (id: number) => void;
  onGenerateLetter: (id: number) => void;
  onWorkflowChange: (id: number, state: string) => void;
  toast: (type: ToastType, msg: string) => void;
  isAdmin: boolean;
}

const CATEGORIES = [
  { value: "all",                    label: "All categories" },
  { value: "medicare",               label: "Medicare & Medicaid" },
  { value: "explanation_of_benefits",label: "Insurance EOBs" },
  { value: "itemized_medical",       label: "Medical Bills" },
  { value: "electricity",            label: "Electricity" },
  { value: "natural_gas",            label: "Natural Gas" },
  { value: "water",                  label: "Water & Sewer" },
  { value: "telecom",                label: "Phone & Internet" },
  { value: "property_tax",           label: "Property Tax" },
  { value: "credit_card",            label: "Credit Card" },
  { value: "collection_notice",      label: "Collection" },
  { value: "irs_notice",             label: "IRS" },
];

export function DocumentsScreen({
  docs, users, statusFilter, onSetStatusFilter,
  onRefetch, onDelete, onGenerateLetter, onWorkflowChange, toast, isAdmin,
}: Props) {
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredDocs = useMemo(() => {
    let list = docs;
    if (searchQuery)
      list = list.filter(d =>
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        docTypeLabel(d.document_type).toLowerCase().includes(searchQuery.toLowerCase())
      );
    if (selectedCategory !== "all")
      list = list.filter(d => d.document_type.includes(selectedCategory));
    if (statusFilter === "attention")
      list = list.filter(d =>
        ["failed", "quarantined"].includes(d.status.toLowerCase()) ||
        ["needs_review", "waiting_on_user"].includes(d.workflow_state?.toLowerCase() ?? "") ||
        d.scam_analysis?.is_suspicious
      );
    if (statusFilter === "analyzing")
      list = list.filter(d => ["uploaded", "processing", "queued"].includes(d.status.toLowerCase()));
    if (statusFilter === "deadlines")
      list = list.filter(d => d.deadlines?.length > 0);
    return list;
  }, [docs, searchQuery, selectedCategory, statusFilter]);

  const selectedDoc = useMemo(
    () => docs.find(d => d.id === selectedDocId) ?? null,
    [docs, selectedDocId]
  );

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ── Document list ──────────────────────────────────────────────── */}
      <div className="col-span-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Documents</h2>
          <button onClick={onRefetch} className="p-2 hover:bg-gray-100 rounded-xl transition">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Active filter banner */}
        {statusFilter && (
          <div className={clsx(
            "flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium",
            statusFilter === "attention" ? "bg-red-50 text-red-700 border border-red-200"
            : statusFilter === "analyzing" ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "bg-amber-50 text-amber-700 border border-amber-200"
          )}>
            <span>
              {statusFilter === "attention" ? "⚠️ Needs attention"
               : statusFilter === "analyzing" ? "🔄 Analyzing"
               : "📅 Has deadlines"}
            </span>
            <button onClick={() => onSetStatusFilter(null)} className="ml-2 underline text-xs">Clear</button>
          </div>
        )}

        {/* Search + category filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search documents…"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Document list */}
        <div className="space-y-2">
          {filteredDocs.map(d => {
            const { label, cls } = statusBadge(d.status);
            return (
              <button
                key={d.id}
                onClick={() => setSelectedDocId(d.id)}
                className={clsx(
                  "w-full text-left p-3.5 rounded-xl border transition-all",
                  selectedDocId === d.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-blue-300"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 truncate text-sm flex-1">{d.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.scam_analysis?.is_suspicious && (
                      <AlertTriangle className="w-4 h-4 text-red-500" title="Scam risk detected" />
                    )}
                    {["failed", "quarantined"].includes(d.status.toLowerCase()) && (
                      <AlertCircle className="w-4 h-4 text-red-500" title="Needs attention" />
                    )}
                    <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", cls)}>{label}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">{docTypeLabel(d.document_type)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(d.created_at)}</p>
              </button>
            );
          })}
          {!filteredDocs.length && (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No documents found</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Document detail ────────────────────────────────────────────── */}
      <div className="col-span-8">
        {selectedDoc ? (
          <DocumentDetail
            doc={selectedDoc}
            users={users}
            isAdmin={isAdmin}
            onDelete={() => {
              if (confirm(`Delete "${selectedDoc.name}"?`)) {
                onDelete(selectedDoc.id);
                setSelectedDocId(null);
              }
            }}
            onGenerateLetter={() => onGenerateLetter(selectedDoc.id)}
            onWorkflowChange={s => onWorkflowChange(selectedDoc.id, s)}
            toast={toast}
          />
        ) : (
          <div className="flex items-center justify-center h-full min-h-64 text-gray-400">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-3 opacity-20" />
              <p className="text-lg">Select a document to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
