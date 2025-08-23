'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...toast, id }
    
    // Defer state update to avoid React 19 render cycle issues
    setTimeout(() => {
      setToasts(current => [...current, newToast])
      
      // Auto remove after duration
      setTimeout(() => {
        removeToast(id)
      }, toast.duration || 5000)
    }, 0)
  }

  const removeToast = (id: string) => {
    setToasts(current => current.filter(toast => toast.id !== id))
  }

  const success = (title: string, description?: string) => {
    addToast({ type: 'success', title, description })
  }

  const error = (title: string, description?: string) => {
    addToast({ type: 'error', title, description, duration: 7000 })
  }

  const info = (title: string, description?: string) => {
    addToast({ type: 'info', title, description })
  }

  const warning = (title: string, description?: string) => {
    addToast({ type: 'warning', title, description })
  }

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      success,
      error,
      info,
      warning
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 w-full max-w-sm space-y-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const { id, type, title, description } = toast

  const typeConfig = {
    success: {
      icon: CheckCircle,
      className: 'bg-green-50 border-green-200 text-green-800'
    },
    error: {
      icon: AlertCircle,
      className: 'bg-red-50 border-red-200 text-red-800'
    },
    warning: {
      icon: AlertCircle,
      className: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    },
    info: {
      icon: Info,
      className: 'bg-blue-50 border-blue-200 text-blue-800'
    }
  }

  const config = typeConfig[type]
  const Icon = config.icon

  return (
    <div
      className={`
        relative flex w-full items-start space-x-3 rounded-lg border p-4 shadow-lg
        transition-all duration-300 ease-in-out
        animate-in slide-in-from-top-full
        ${config.className}
      `}
    >
      <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <h4 className="text-sm font-medium">{title}</h4>
        {description && (
          <p className="text-sm opacity-90">{description}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(id)}
        className="rounded-md p-1 hover:bg-black/10 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

// Utility function to show toasts outside of React components
let globalToastFunction: ToastContextType | null = null

export function setGlobalToast(toastFunction: ToastContextType) {
  globalToastFunction = toastFunction
}

export const toast = {
  success: (title: string, description?: string) => {
    globalToastFunction?.success(title, description)
  },
  error: (title: string, description?: string) => {
    globalToastFunction?.error(title, description)
  },
  info: (title: string, description?: string) => {
    globalToastFunction?.info(title, description)
  },
  warning: (title: string, description?: string) => {
    globalToastFunction?.warning(title, description)
  }
}