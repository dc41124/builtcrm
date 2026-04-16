"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

export function Button({
  variant = "secondary",
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`bc-btn bc-btn-${variant} ${className}`}
    >
      {loading ? (
        <span className="bc-btn-spin" aria-hidden />
      ) : (
        leftIcon && <span className="bc-btn-ico">{leftIcon}</span>
      )}
      {children}
      {!loading && rightIcon && <span className="bc-btn-ico">{rightIcon}</span>}
    </button>
  );
}
