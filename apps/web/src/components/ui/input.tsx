import type {InputHTMLAttributes} from "react";

export function Input({className = "", ...props}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full rounded-[var(--so-radius-sm)] border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 hover:border-slate-300 ${className}`}
      {...props}
    />
  );
}
