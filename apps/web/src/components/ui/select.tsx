import type {SelectHTMLAttributes} from "react";

export function Select({className = "", ...props}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-10 w-full cursor-pointer rounded-[var(--so-radius-sm)] border border-line bg-white px-3 text-sm text-ink hover:border-slate-300 ${className}`}
      {...props}
    />
  );
}
