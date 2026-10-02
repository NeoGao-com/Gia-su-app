import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children, size = 'lg' }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl'
  };

  const maxWidthClass = sizeClasses[size] || sizeClasses.lg;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className={`bg-white rounded-3xl w-full ${maxWidthClass} p-5 sm:p-7 shadow-2xl border border-gray-100/80 relative my-8 animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-xl transition interactive-btn"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
