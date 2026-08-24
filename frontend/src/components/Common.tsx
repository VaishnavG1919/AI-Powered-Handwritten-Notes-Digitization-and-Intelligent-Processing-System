import { FileText, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="28" rx="8" fill="var(--color-violet-500)" />
        <path
          d="M7 19.5C9.5 13 11 9 13.5 8c1.2-.5 1.7.7.9 1.6-1.6 1.8-3 5-3.2 8.4"
          stroke="var(--color-amber-300)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M15 9h6M15 13h6M15 17h4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="font-display font-semibold text-lg tracking-tight">Scriptly</span>
    </div>
  );
}

const statusMap: Record<string, { icon: any; label: string; className: string }> = {
  pending: { icon: Clock, label: "Queued", className: "text-ink-400 dark:text-ink-400" },
  processing: { icon: Loader2, label: "Processing", className: "text-violet-500 animate-spin-slow" },
  preprocessing: { icon: Loader2, label: "Preprocessing", className: "text-violet-500" },
  ocr: { icon: Loader2, label: "Reading handwriting", className: "text-violet-500" },
  cleanup: { icon: Loader2, label: "Cleaning with AI", className: "text-violet-500" },
  ready: { icon: CheckCircle2, label: "Ready", className: "text-good-500" },
  failed: { icon: XCircle, label: "Failed", className: "text-bad-500" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = statusMap[status] || { icon: FileText, label: status, className: "text-ink-400" };
  const Icon = s.icon;
  const spinning = ["processing", "preprocessing", "ocr", "cleanup"].includes(status);
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.className}`}>
      <Icon size={13} className={spinning ? "animate-spin" : ""} />
      {s.label}
    </span>
  );
}
