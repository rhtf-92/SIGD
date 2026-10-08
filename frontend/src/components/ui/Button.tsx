import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "inline-flex min-h-10 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-sigd-blue-dark transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sigd-blue",
};

export default function Button({
  variant = "primary",
  className = "",
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${variantClasses[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}
