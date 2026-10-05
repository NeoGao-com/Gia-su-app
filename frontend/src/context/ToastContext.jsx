import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const addToast = useCallback((type, message, title = '') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message, title }]);

    // Auto remove after 3.8s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, title = '') => addToast('success', msg, title),
    error: (msg, title = '') => addToast('error', msg, title),
    info: (msg, title = '') => addToast('info', msg, title),
    warning: (msg, title = '') => addToast('warning', msg, title),
  };

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      const {
        title = 'Xác nhận hành động',
        message = '',
        confirmText = 'Xác nhận',
        cancelText = 'Hủy',
        onConfirm,
        onCancel,
      } = opts;

      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        onConfirm: async () => {
          setConfirmDialog(null);
          try {
            await onConfirm?.();
          } finally {
            resolve(true);
          }
        },
        onCancel: () => {
          setConfirmDialog(null);
          try {
            onCancel?.();
          } finally {
            resolve(false);
          }
        },
      });
    });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Floating Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col space-y-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => {
          const config = {
            success: {
              icon: CheckCircle2,
              bg: 'bg-emerald-500 text-white',
              border: 'border-emerald-600/30',
              accent: 'bg-emerald-400',
            },
            error: {
              icon: AlertCircle,
              bg: 'bg-rose-500 text-white',
              border: 'border-rose-600/30',
              accent: 'bg-rose-400',
            },
            warning: {
              icon: AlertTriangle,
              bg: 'bg-amber-500 text-white',
              border: 'border-amber-600/30',
              accent: 'bg-amber-400',
            },
            info: {
              icon: Info,
              bg: 'bg-indigo-600 text-white',
              border: 'border-indigo-700/30',
              accent: 'bg-indigo-400',
            },
          }[t.type] || {
            icon: Info,
            bg: 'bg-slate-900 text-white',
            border: 'border-slate-800',
            accent: 'bg-slate-700',
          };

          const IconComponent = config.icon;

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start space-x-3 p-4 rounded-2xl shadow-xl border ${config.bg} ${config.border} transform transition-all duration-300 ease-out animate-in slide-in-from-bottom-5 fade-in`}
            >
              <IconComponent className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
                {t.title && <div className="font-bold text-xs uppercase tracking-wider opacity-90 mb-0.5">{t.title}</div>}
                <div>{t.message}</div>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100 p-0.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Modern Confirm Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback if component is outside provider
    return {
      toast: {
        success: (m) => alert(m),
        error: (m) => alert(m),
        info: (m) => alert(m),
        warning: (m) => alert(m),
      },
      confirm: (options) => {
        const msg = typeof options === 'string' ? options : options?.message || '';
        const ok = window.confirm(msg);
        if (ok && options?.onConfirm) options.onConfirm();
        if (!ok && options?.onCancel) options.onCancel();
        return Promise.resolve(ok);
      },
    };
  }
  return context;
}
