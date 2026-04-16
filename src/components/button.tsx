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
    <>
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
      <style dangerouslySetInnerHTML={{ __html: `
        .bc-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--df) var(--e);white-space:nowrap;letter-spacing:-.005em}
        .bc-btn:hover:not(:disabled){background:var(--sh);border-color:var(--s4)}
        .bc-btn:disabled{opacity:.6;cursor:not-allowed}
        .bc-btn-primary{background:var(--ac);border-color:var(--ac);color:#fff;font-weight:650}
        .bc-btn-primary:hover:not(:disabled){background:var(--ac-h);border-color:var(--ac-h)}
        .bc-btn-secondary{background:var(--s2);border-color:var(--s3);color:var(--t1)}
        .bc-btn-secondary:hover:not(:disabled){background:var(--sh);border-color:var(--s4)}
        .bc-btn-ghost{background:transparent;border-color:transparent;color:var(--t2)}
        .bc-btn-ghost:hover:not(:disabled){background:var(--sh);color:var(--t1)}
        .bc-btn-ico{display:inline-flex;align-items:center}
        .bc-btn-spin{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:bc-spin .7s linear infinite}
        @keyframes bc-spin{to{transform:rotate(360deg)}}
      ` }} />
    </>
  );
}
