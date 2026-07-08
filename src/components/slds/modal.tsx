"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  size = "medium",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "small" | "medium" | "large";
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxWidth = size === "small" ? 480 : size === "large" ? 1100 : 720;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 64,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(8, 7, 7, 0.5)",
        }}
      />
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 4,
          width: "94%",
          maxWidth,
          maxHeight: "calc(100vh - 96px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        }}
      >
        {title && (
          <header
            style={{
              padding: "16px 24px",
              borderBottom: "1px solid #c9c9c9",
              fontSize: 18,
              fontWeight: 700,
              color: "#181818",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{title}</span>
            <button
              aria-label="Close"
              onClick={onClose}
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                fontSize: 20,
                color: "#54698d",
                padding: 4,
              }}
            >
              ×
            </button>
          </header>
        )}
        <div
          style={{
            padding: 24,
            overflow: "auto",
            flex: 1,
          }}
        >
          {children}
        </div>
        {footer && (
          <footer
            style={{
              padding: 16,
              borderTop: "1px solid #c9c9c9",
              display: "flex",
              justifyContent: "center",
              gap: 8,
              background: "#f3f2f2",
            }}
          >
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function ModalButton({
  variant = "neutral",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "neutral" | "brand" | "destructive" }) {
  const styles: React.CSSProperties = {
    padding: "6px 16px",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid",
    minWidth: 80,
  };
  if (variant === "brand") {
    Object.assign(styles, { background: "#0176d3", color: "#fff", borderColor: "#0176d3" });
  } else if (variant === "destructive") {
    Object.assign(styles, { background: "#c23934", color: "#fff", borderColor: "#c23934" });
  } else {
    Object.assign(styles, { background: "#fff", color: "#0176d3", borderColor: "#c9c9c9" });
  }
  return (
    <button {...rest} style={{ ...styles, ...rest.style }}>
      {children}
    </button>
  );
}
