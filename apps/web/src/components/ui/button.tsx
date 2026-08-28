import type {ButtonHTMLAttributes} from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-[0_8px_18px_rgb(17_122_100/0.18)]",
  secondary: "border border-line bg-white text-ink hover:border-brand/35 hover:bg-brand-soft/40",
  ghost: "bg-transparent text-muted hover:bg-subtle hover:text-ink",
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-[0.95rem]",
};

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--so-radius-sm)] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
