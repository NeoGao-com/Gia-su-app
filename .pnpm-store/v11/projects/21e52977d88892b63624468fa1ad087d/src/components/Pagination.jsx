import React from 'react';

export function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center space-x-2 mt-6">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-50 hover:bg-pastel-bg"
      >
        Trước
      </button>
      <span className="text-sm text-gray-600 px-3">
        Trang {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-50 hover:bg-pastel-bg"
      >
        Sau
      </button>
    </div>
  );
}
