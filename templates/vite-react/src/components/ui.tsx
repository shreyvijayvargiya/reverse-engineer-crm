import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Check, Star, X } from "lucide-react";
import { cn } from "../lib/utils";

/* ---------- Button ---------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};
export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" && "border border-border bg-card hover:bg-muted",
        variant === "ghost" && "hover:bg-muted",
        variant === "danger" && "text-danger hover:bg-muted",
        className,
      )}
    />
  );
}

/* ---------- Inputs ---------- */
const inputBase =
  "rounded-md border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40";
const widthOf = (className?: string) => (className && /(^|\s)(w-|min-w-|flex-1)/.test(className) ? "" : "w-full");
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, widthOf(className), "h-9", className)} />;
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, widthOf(className), "min-h-[88px] py-2", className)} />;
}
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, widthOf(className), "h-9", className)} />;
}
export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-muted-foreground">{children}</label>;
}

/* ---------- Card ---------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-border bg-card", className)}>{children}</div>;
}

/* ---------- Badge ---------- */
const tones = {
  gray: "bg-muted text-muted-foreground",
  blue: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
} as const;
type Tone = keyof typeof tones;

const GOOD = /^(won|paid|done|sent|resolved|completed|confirmed|customer|positive|actioned|active|delivered)$/i;
const BAD = /^(lost|failed|overdue|cancell?ed|no-show|negative|urgent|high)$/i;
const WARN = /^(scheduled|waiting|negotiation|running|in progress|contacted|neutral|medium|reviewed)$/i;

export function toneFor(option: string, index: number): Tone {
  if (GOOD.test(option)) return "green";
  if (BAD.test(option)) return "red";
  if (WARN.test(option)) return "amber";
  const cycle: Tone[] = ["gray", "blue", "violet", "blue"];
  return cycle[index % cycle.length];
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: Tone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

/* ---------- Rating ---------- */
export function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n === value ? 0 : n)}
          className={cn("p-0.5", onChange ? "cursor-pointer" : "cursor-default")}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star className={cn("h-4 w-4", n <= value ? "fill-amber-400 text-amber-400" : "text-border")} />
        </button>
      ))}
    </span>
  );
}

/* ---------- Dialog ---------- */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
interface ToastItem { id: number; text: string; kind: "success" | "error" }
const ToastCtx = createContext<(text: string, kind?: "success" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cn("pointer-events-auto flex items-start gap-2 rounded-md border bg-card px-3 py-2 text-sm shadow-lg", t.kind === "error" ? "border-danger/50" : "border-border")}>
            {t.kind === "success" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
