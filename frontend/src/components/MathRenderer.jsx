import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function MathRenderer({ content, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!content) {
      containerRef.current.innerHTML = '';
      return;
    }

    const raw = String(content);
    // Split by $$...$$ and $...$
    const pattern = /(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g;
    const parts = raw.split(pattern);

    let html = '';
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim();
        try {
          html += katex.renderToString(math, { displayMode: true, throwOnError: false });
        } catch {
          html += `<span class="text-red-500">${part}</span>`;
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim();
        try {
          html += katex.renderToString(math, { displayMode: false, throwOnError: false });
        } catch {
          html += `<span class="text-red-500">${part}</span>`;
        }
      } else {
        // Escape HTML
        const safeText = part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br/>');
        html += safeText;
      }
    }

    containerRef.current.innerHTML = html;
  }, [content]);

  return <div ref={containerRef} className={`inline-block ${className}`} />;
}
