"use client";
import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { clsx } from "clsx";
import type { Toast as ToastItem } from "@/hooks/useToast";

export function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm w-full px-4">
      {toasts.map((t) => (
        <div key={t.id} className={clsx(
          "px-4 py-3 rounded-2xl shadow-lg text-sm font-medium flex items-center gap-2",
          t.type === "success" && "bg-green-600 text-white",
          t.type === "error"   && "bg-red-600 text-white",
          t.type === "info"    && "bg-blue-600 text-white",
          t.type === "warning" && "bg-amber-500 text-white",
        )}>
          {t.type === "success" && <CheckCircle  className="w-4 h-4 shrink-0" />}
          {t.type === "error"   && <AlertCircle  className="w-4 h-4 shrink-0" />}
          {t.type === "warning" && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {t.type === "info"    && <Info          className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
