import type {HTMLAttributes} from "react";

export function Card({className = "", ...props}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[var(--so-radius-lg)] border border-line bg-white shadow-[var(--so-shadow-card)] ${className}`}
      {...props}
    />
  );
}
