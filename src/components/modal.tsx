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
    <>
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
      <style dangerouslySetInnerHTML={{ __html: `
        .bc-modal-overlay{position:fixed;inset:0;background:rgba(17,19,24,.45);z-index:1000;display:flex;animation:bc-fade var(--dn) var(--e)}
        .bc-modal-center{align-items:center;justify-content:center;padding:32px}
        .bc-modal-side{align-items:stretch;justify-content:flex-end}
        .bc-modal{background:var(--s1);border:1px solid var(--s3);box-shadow:var(--shlg);display:flex;flex-direction:column;max-height:100%;overflow:hidden}
        .bc-modal-center-panel{border-radius:var(--r-xl);width:560px;max-width:100%;max-height:90vh;animation:bc-pop var(--dn) var(--e)}
        .bc-modal-side-panel{width:480px;max-width:100%;height:100vh;border-radius:0;border-right:none;animation:bc-slide var(--dn) var(--e)}
        .bc-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 22px;border-bottom:1px solid var(--s3)}
        .bc-modal-head-text{display:flex;flex-direction:column;gap:3px;min-width:0}
        .bc-modal-title{font-family:var(--fd);font-size:16px;font-weight:740;color:var(--t1);letter-spacing:-.01em}
        .bc-modal-sub{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .bc-modal-close{background:transparent;border:none;color:var(--t2);cursor:pointer;padding:4px;border-radius:var(--r-s);display:grid;place-items:center}
        .bc-modal-close:hover{background:var(--sh);color:var(--t1)}
        .bc-modal-body{padding:20px 22px;overflow-y:auto;flex:1;font-family:var(--fb);font-size:13.5px;color:var(--t1)}
        .bc-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid var(--s3);background:var(--sh)}
        @keyframes bc-fade{from{opacity:0}to{opacity:1}}
        @keyframes bc-pop{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
        @keyframes bc-slide{from{transform:translateX(100%)}to{transform:none}}
      ` }} />
    </>
  );
}
