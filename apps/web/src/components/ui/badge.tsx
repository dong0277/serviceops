import type {HTMLAttributes} from "react";

type BadgeTone = "neutral" | "success" | "warning" | "info" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  info: "bg-sky-50 text-sky-700",
  danger: "bg-rose-50 text-rose-700",
};

export function Badge({
  className = "",
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & {tone?: BadgeTone}) {
  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
