import React from "react";
import { Dialog, DialogContent, DialogTitle } from "./Dialog";
import Button from "./Button";
import { cn } from "../../utils/utils";

const VARIANTS = {
  default: {
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    confirmVariant: "default",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    ),
  },
  success: {
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    confirmVariant: "default",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  destructive: {
    iconBg: "bg-red-50",
    iconColor: "text-red-600",
    confirmVariant: "destructive",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    ),
  },
};

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  isLoading = false,
  variant = "default",
  children,
}) {
  const style = VARIANTS[variant] || VARIANTS.default;

  const handleConfirm = async () => {
    await onConfirm?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-md p-0 gap-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-6 pb-4">
          <div className="flex gap-4 items-start">
            <div
              className={cn(
                "flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center",
                style.iconBg
              )}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className={cn("w-6 h-6", style.iconColor)}
              >
                {style.icon}
              </svg>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <DialogTitle className="text-base font-semibold text-slate-900 leading-snug">
                {title}
              </DialogTitle>
              {description && (
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          </div>

          {children && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
              {children}
            </div>
          )}
        </div>

        <div className="flex gap-2 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <Button
            type="button"
            variant="outlined"
            className="flex-1"
            disabled={isLoading}
            onClick={() => onOpenChange?.(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={style.confirmVariant}
            className="flex-1"
            disabled={isLoading}
            onClick={handleConfirm}
          >
            {isLoading ? "Procesando..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
