"use client";
import { useState } from "react";
import {
  AlertCircle, AlertTriangle, Copy, Mail, Phone,
  Shield, Trash2, Users, FileText, Clock, CheckCircle,
} from "lucide-react";
import { clsx } from "clsx";
import type { Document, User } from "@/types";
import type { ToastType } from "@/types";
import { docTypeLabel, statusBadge, formatFieldValue, HIDDEN_FIELDS } from "@/lib/utils";

// ── Sub-components ────────────────────────────────────────────────────────

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
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

function priorityIcon(p: string) {
  if (p === "high")   return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (p === "medium") return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
  return <CheckCircle className="w-4 h-4 text-gray-400 shrink-0" />;
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  doc: Document;
  users: User[];
  isAdmin: boolean;
  onDelete: () => void;
  onGenerateLetter: () => void;
  onWorkflowChange: (s: string) => void;
  toast: (type: ToastType, msg: string) => void;
}

export function DocumentDetail({ doc, users, isAdmin, onDelete, onGenerateLetter, onWorkflowChange, toast }: Props) {
  const [copied, setCopied] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const fields = doc.extracted_fields || {};
  const ui = (fields.ui_summary as Record<string, unknown>) || {};
  const letter = doc.generated_letter;

  const visibleFields = Object.entries(fields).filter(([k, v]) => {
    if (HIDDEN_FIELDS.has(k)) return false;
    if (v === null || v === undefined || v === "" || v === false) return false;
    return true;
  });

  const { label, cls } = statusBadge(doc.status);

  function copyLetter() {
    if (!letter?.body) return;
    navigator.clipboard.writeText(letter.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast("success", "Letter copied to clipboard");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 truncate">{doc.name}</h2>
          <p className="text-gray-500 mt-1">
            {docTypeLabel(doc.document_type)} ·{" "}
            <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full", cls)}>{label}</span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onGenerateLetter}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 transition font-medium">
            <Mail className="w-4 h-4" /> Generate letter
          </button>
          <button onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 text-sm rounded-xl hover:bg-red-50 transition">
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>

      {/* Scam alert */}
      {doc.scam_analysis?.is_suspicious && (
        <div className={clsx("p-4 rounded-2xl border-2",
          doc.scam_analysis.risk_level === "high"
            ? "bg-red-50 border-red-300"
            : "bg-amber-50 border-amber-300")}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={clsx("w-6 h-6 shrink-0 mt-0.5",
              doc.scam_analysis.risk_level === "high" ? "text-red-600" : "text-amber-600")} />
            <div>
              <p className={clsx("font-bold",
                doc.scam_analysis.risk_level === "high" ? "text-red-800" : "text-amber-800")}>
                {doc.scam_analysis.warning_message}
              </p>
              {doc.scam_analysis.recommended_actions?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {doc.scam_analysis.recommended_actions.map((a, i) => (
                    <li key={i} className={clsx("text-sm",
                      doc.scam_analysis!.risk_level === "high" ? "text-red-700" : "text-amber-700")}>
                      • {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Billing errors */}
      {doc.billing_errors && doc.billing_errors.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="font-bold text-orange-900 mb-2">💰 Potential Billing Errors Found</p>
          {doc.billing_errors.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-orange-800 mt-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{e.description}</span>
              {e.amount && <span className="font-semibold">{e.amount}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="What this is"
          value={String(ui.what_this_is || doc.summary || "Analysis in progress…")}
          icon={<FileText className="w-5 h-5 text-blue-500" />}
        />
        <SummaryCard
          title="Do I need to pay?"
          value={String(
            ui.payment_message || ui.do_i_need_to_pay_now ||
            (fields.patient_responsibility as string) ||
            (fields.amount_due as string) ||
            "Review the document details first."
          )}
          icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
        />
        <SummaryCard
          title="Key date"
          value={String(
            ui.main_due_date || (fields.renewal_due_date as string) ||
            (fields.statement_date as string) || (fields.due_date as string) ||
            "No key date found."
          )}
          icon={<Clock className="w-5 h-5 text-green-500" />}
        />
      </div>

      {/* Phone call script */}
      {ui.call_script && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-5 h-5 text-blue-600" />
            <p className="font-semibold text-blue-900">📞 Phone Call Script</p>
          </div>
          <p className="text-sm text-blue-800 italic">"{String(ui.call_script)}"</p>
        </div>
      )}

      {/* Warning flags */}
      {Array.isArray(ui.warning_flags) && (ui.warning_flags as string[]).length > 0 && (
        <div className="space-y-2">
          {(ui.warning_flags as string[]).map((flag, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              {flag}
            </div>
          ))}
        </div>
      )}

      {/* Deadlines */}
      {doc.deadlines?.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">📅 Important Deadlines</h3>
          <div className="space-y-3">
            {doc.deadlines.map((d, i) => (
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
      {doc.medications && doc.medications.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">💊 Medications Found</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {doc.medications.map((m, i) => (
              <div key={i} className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <p className="font-bold text-green-900">{m.name}{m.dosage ? ` — ${m.dosage}` : ""}</p>
                <p className="text-sm text-green-700 mt-1">{m.instructions || m.frequency || "As prescribed"}</p>
                {m.with_food !== null && (
                  <p className="text-xs text-green-600 mt-1">{m.with_food ? "🍽 With food" : "💧 Empty stomach"}</p>
                )}
                {m.reminder_times?.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">⏰ {m.reminder_times.join(", ")}</p>
                )}
                {m.refill_date && (
                  <p className="text-xs text-amber-600 mt-1">📅 Refill: {m.refill_date}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations + Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recommendations */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">What to do next</h3>
          <div className="space-y-3">
            {doc.recommended_actions?.length ? (
              doc.recommended_actions.map((r, i) => (
                <div key={i} className="p-4 bg-white border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    {priorityIcon(r.priority)}
                    <p className="font-semibold text-gray-900">{r.title}</p>
                  </div>
                  <p className="text-sm text-gray-500">{r.why}</p>
                  <p className="text-sm text-gray-700 mt-2">{r.action}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-400 text-sm italic">No recommendations yet.</p>
            )}
          </div>
        </div>

        {/* Extracted fields — only show labeled, meaningful fields */}
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-3">Document details</h3>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {visibleFields.slice(0, 15).map(([k, v]) => {
              // Skip arrays entirely — raw number arrays are meaningless without labels
              if (Array.isArray(v)) return null;
              // Skip very long strings that are clearly OCR fragments not field values
              const str = String(v);
              if (str.length > 100 && !str.includes("$") && !str.includes("@")) return null;
              return (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <span className="text-sm text-gray-500 shrink-0">{docTypeLabel(k)}</span>
                  <span className="text-sm font-medium text-gray-900 text-right max-w-xs break-words">
                    {formatFieldValue(v)}
                  </span>
                </div>
              );
            })}
            {!visibleFields.filter(([k, v]) => !Array.isArray(v)).length && (
              <p className="px-4 py-3 text-sm text-gray-400 italic">No fields extracted yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Generated letter */}
      {letter?.body && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-800">{letter.title || "Draft Letter"}</h3>
            <button onClick={copyLetter}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy"}
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
          <Users className="w-5 h-5 text-purple-600 shrink-0" />
          <div>
            <p className="font-semibold text-purple-900">This document may benefit from a trusted helper</p>
            <p className="text-sm text-purple-700 mt-0.5">
              Consider sharing with a family member or caregiver to help manage this.
            </p>
          </div>
        </div>
      )}

      {/* Raw OCR text — admin only */}
      {isAdmin && doc.extracted_text && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowRawText(!showRawText)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Raw OCR text</span>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Admin only</span>
            </div>
            <span className="text-xs text-gray-400">{showRawText ? "Hide ▲" : "Show ▼"}</span>
          </button>
          {showRawText && (
            <div className="p-4">
              <p className="text-xs text-gray-400 mb-2">
                Full text extracted by OCR — raw input to the AI. Not shown to seniors.
              </p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-gray-600 bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto border border-gray-100">
                {doc.extracted_text}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(doc.extracted_text || "");
                  toast("success", "Raw text copied to clipboard");
                }}
                className="mt-2 text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy raw text
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
