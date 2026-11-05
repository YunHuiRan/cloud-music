import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface DialogProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
}

export function Dialog({
  title,
  description,
  children,
  footer,
  onClose,
  width = 420,
}: DialogProps) {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    const visual = window.visualViewport;
    const update = () => {
      setViewportHeight(visual?.height ?? window.innerHeight);
    };
    update();
    visual?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      visual?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const compactViewport =
    viewportHeight !== null && viewportHeight > 0 && viewportHeight < window.innerHeight - 80;
  const dialogStyle: CSSProperties = {
    width,
    maxHeight: viewportHeight ? Math.max(240, viewportHeight - 24) : undefined,
  };

  return createPortal(
    <div
      className="dialog-overlay"
      data-modal-open
      data-keyboard={compactViewport ? "true" : undefined}
      style={
        compactViewport
          ? { alignItems: "start", paddingTop: "max(10px, env(safe-area-inset-top))" }
          : undefined
      }
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={dialogStyle}
      >
        <div className="dialog-head">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button is-quiet"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "确认",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="button" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={`button ${danger ? "button-danger" : "button-primary"}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="dialog-copy">{description}</p>
    </Dialog>
  );
}
