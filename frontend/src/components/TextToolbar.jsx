import React from 'react';
import { Undo2, Redo2, Scissors, Copy, ClipboardPaste, Sigma } from 'lucide-react';

export function TextToolbar({ onInsertLatex }) {
  const handleUndo = () => {
    document.execCommand('undo', false, null);
  };

  const handleRedo = () => {
    document.execCommand('redo', false, null);
  };

  const handleCut = async () => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (start !== end) {
        const text = active.value.substring(start, end);
        await navigator.clipboard.writeText(text);
        active.value = active.value.substring(0, start) + active.value.substring(end);
        active.selectionStart = active.selectionEnd = start;
        active.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  const handleCopy = async () => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const start = active.selectionStart;
      const end = active.selectionEnd;
      if (start !== end) {
        const text = active.value.substring(start, end);
        await navigator.clipboard.writeText(text);
      }
    }
  };

  const handlePaste = async () => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      try {
        const text = await navigator.clipboard.readText();
        const start = active.selectionStart;
        const end = active.selectionEnd;
        active.value = active.value.substring(0, start) + text + active.value.substring(end);
        active.selectionStart = active.selectionEnd = start + text.length;
        active.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (err) {
        console.error('Paste failed:', err);
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl mb-2">
      <button
        type="button"
        onClick={handleUndo}
        title="Hoàn tác (Undo)"
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition text-xs font-medium flex items-center space-x-1 cursor-pointer"
      >
        <Undo2 className="w-4 h-4" />
        <span className="hidden sm:inline">Undo</span>
      </button>
      <button
        type="button"
        onClick={handleRedo}
        title="Làm lại (Redo)"
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition text-xs font-medium flex items-center space-x-1 cursor-pointer"
      >
        <Redo2 className="w-4 h-4" />
        <span className="hidden sm:inline">Redo</span>
      </button>
      <div className="h-4 w-px bg-slate-300 mx-1" />
      <button
        type="button"
        onClick={handleCut}
        title="Cắt (Cut)"
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition text-xs font-medium flex items-center space-x-1 cursor-pointer"
      >
        <Scissors className="w-4 h-4" />
        <span className="hidden sm:inline">Cắt</span>
      </button>
      <button
        type="button"
        onClick={handleCopy}
        title="Sao chép (Copy)"
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition text-xs font-medium flex items-center space-x-1 cursor-pointer"
      >
        <Copy className="w-4 h-4" />
        <span className="hidden sm:inline">Sao chép</span>
      </button>
      <button
        type="button"
        onClick={handlePaste}
        title="Dán (Paste)"
        className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white rounded-lg transition text-xs font-medium flex items-center space-x-1 cursor-pointer"
      >
        <ClipboardPaste className="w-4 h-4" />
        <span className="hidden sm:inline">Dán</span>
      </button>
      {onInsertLatex && (
        <>
          <div className="h-4 w-px bg-slate-300 mx-1" />
          <button
            type="button"
            onClick={onInsertLatex}
            title="Chèn công thức Toán ($...$)"
            className="p-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 rounded-lg transition text-xs font-bold flex items-center space-x-1 cursor-pointer"
          >
            <Sigma className="w-4 h-4" />
            <span>Chèn Công thức $...$</span>
          </button>
        </>
      )}
    </div>
  );
}
