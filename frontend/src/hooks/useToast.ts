import { useState, useCallback } from "react";
import type { ToastType } from "@/types";

export interface Toast {
  id: number;
  type: ToastType;
  msg: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((type: ToastType, msg: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, type, msg }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  return { toasts, show };
}
