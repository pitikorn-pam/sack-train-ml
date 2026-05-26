/**
 * Toast notifications — bottom-right, auto-dismiss 5.2s, max 3 stacked.
 *
 * Usage:
 *   const { push } = useToast();
 *   push({ tone: "success", title: "Training finished", detail: "v1.2.3" });
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ActivityTone } from "../lib/activity";

interface Toast {
  id: number;
  tone: ActivityTone;
  title: string;
  detail?: string;
}

interface ToastContextValue {
  push: (t: Omit<Toast, "id">) => void;
}

const ToastCtx = createContext<ToastContextValue | null>(null);

const TIMEOUT_MS = 5200;
const MAX = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const push = useCallback((t: Omit<Toast, "id">) => {
    setToasts((prev) => {
      const id = ++nextId + Date.now();
      const next = [...prev, { ...t, id }];
      return next.slice(-MAX);
    });
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const oldest = toasts[0];
    const t = setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== oldest.id));
    }, TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <div className="toast-title">{t.title}</div>
            {t.detail && <div className="toast-detail">{t.detail}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
