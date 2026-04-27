import React, { createContext, useContext, useState, useCallback } from "react"
import { X } from "lucide-react"
import { cn } from "../../lib/utils"

interface Toast {
  id: string
  title?: string
  description: string
  variant?: "default" | "success" | "error" | "warning" | "info"
  action?: {
    label: string
    onClick: () => void
  }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { ...toast, id }])
    
    // Auto remove after 5 seconds (7 seconds if there's an action button)
    const timeout = toast.action ? 7000 : 5000
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, timeout)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const variantStyles = {
    default: "bg-background border",
    success: "bg-green-500 text-white",
    error: "bg-red-500 text-white",
    warning: "bg-yellow-500 text-white",
    info: "bg-blue-500 text-white",
  }

  return (
    <div
      className={cn(
        "min-w-[300px] max-w-[400px] rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5 fade-in duration-300",
        variantStyles[toast.variant || "default"]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {toast.title && (
            <div className="font-semibold mb-1">{toast.title}</div>
          )}
          <div className="text-sm">{toast.description}</div>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick()
                onRemove()
              }}
              className="mt-2 px-3 py-1 text-xs font-bold rounded-md bg-white/20 hover:bg-white/30 border border-white/30 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={onRemove}
          className="ml-4 shrink-0 rounded-md p-1 hover:bg-black/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

