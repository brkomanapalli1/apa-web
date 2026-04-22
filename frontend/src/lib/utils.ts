// ── Shared utility functions ───────────────────────────────────────────────

export const SUPPORTED_EXTS = [
  ".pdf",".png",".jpg",".jpeg",".webp",".tif",".tiff",
  ".bmp",".doc",".docx",".xls",".xlsx",".csv",".txt",
];

export function docTypeLabel(v?: string) {
  return (v || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusBadge(s: string) {
  const m = s.toLowerCase();
  if (["processed", "completed"].includes(m))
    return { label: "Ready", cls: "bg-green-100 text-green-800" };
  if (["processing", "uploaded", "queued"].includes(m))
    return { label: "Analyzing…", cls: "bg-blue-100 text-blue-800" };
  if (m === "failed")
    return { label: "Failed", cls: "bg-red-100 text-red-800" };
  if (m === "quarantined")
    return { label: "Blocked", cls: "bg-gray-200 text-gray-700" };
  return { label: "Uploaded", cls: "bg-gray-100 text-gray-600" };
}

export function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return d; }
}

export function formatDeadlineDate(d: string): { month: string; day: string | number } {
  try {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) {
      return {
        month: dt.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        day: dt.getDate(),
      };
    }
  } catch { /* fall through */ }
  return { month: d.slice(0, 7), day: d.slice(8, 10) };
}

export function formatFieldValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  if (typeof v === "string")
    return v.length > 150 ? v.slice(0, 150) + "…" : v;
  if (Array.isArray(v))
    return v.map(String).join(", ");
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return keys.length > 0
      ? keys.slice(0, 3).join(", ") + (keys.length > 3 ? "…" : "")
      : "—";
  }
  return String(v);
}

// Fields hidden from the document details panel.
// These are either internal/technical fields or raw arrays
// that are meaningless without context labels.
export const HIDDEN_FIELDS = new Set([
  // Internal fields
  "ui_summary",
  "extracted_text",
  "extracted_text_raw",
  "duplicate_warning",
  "possible_duplicate_charges",
  "analyzer",
  "generated_at",
  "classification_reasons",
  "late_fee_risk",
  "assistance_available",
  "is_bill",
  "do_i_need_to_pay_now",
  "payment_message",
  "needs_trusted_helper",
  "warning_flags",
  "call_script",
  "what_this_is",
  "main_due_date",

  // Raw unlabeled amount arrays — shown as pills elsewhere or too confusing
  "all_amounts",
]);
