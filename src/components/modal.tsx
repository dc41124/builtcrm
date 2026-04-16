"use client";

import { useEffect, type ReactNode } from "react";

export type ModalVariant = "center" | "side";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  variant?: ModalVariant;
  width?: number | string;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  variant = "center",
  width,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const style = width ? { width, maxWidth: "100%" } : undefined;

  return (
    <div className={`bc-modal-overlay bc-modal-${variant}`} onClick={onClose}>
      <div
        className={`bc-modal bc-modal-${variant}-panel`}
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="bc-modal-head">
          <div className="bc-modal-head-text">
            {title && <div className="bc-modal-title">{title}</div>}
            {subtitle && <div className="bc-modal-sub">{subtitle}</div>}
          </div>
          <button className="bc-modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="bc-modal-body">{children}</div>
        {footer && <div className="bc-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
