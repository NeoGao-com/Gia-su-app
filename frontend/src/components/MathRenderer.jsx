import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const mathHtmlCache = new Map();
const MAX_CACHE_SIZE = 2000;

function getCachedMathContent(raw) {
  if (mathHtmlCache.has(raw)) {
    return mathHtmlCache.get(raw);
  }
  const rendered = renderMathContent(raw);
  if (mathHtmlCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mathHtmlCache.keys().next().value;
    mathHtmlCache.delete(firstKey);
  }
  mathHtmlCache.set(raw, rendered);
  return rendered;
}

export const MathRenderer = React.memo(function MathRenderer({ content, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!content) {
      containerRef.current.innerHTML = '';
      return;
    }

    const raw = String(content);
    containerRef.current.innerHTML = getCachedMathContent(raw);
  }, [content]);

  return <div ref={containerRef} className={`inline-block ${className}`} />;
});

function renderMathContent(raw) {
  const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$([^\s\$][^$]*?[^\s\$]|\S)\$|\\\([\s\S]*?\\\))/g;

  let lastIndex = 0;
  let html = '';
  let match;

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      html += escapeHtml(raw.slice(lastIndex, match.index));
    }

    const fullMatch = match[0];
    if (fullMatch.startsWith('$$') && fullMatch.endsWith('$$')) {
      const math = fullMatch.slice(2, -2).trim();
      try {
        html += katex.renderToString(math, { displayMode: true, throwOnError: false });
      } catch {
        html += `<span class="text-red-500">${escapeHtml(fullMatch)}</span>`;
      }
    } else if (fullMatch.startsWith('\\[') && fullMatch.endsWith('\\]')) {
      const math = fullMatch.slice(2, -2).trim();
      try {
        html += katex.renderToString(math, { displayMode: true, throwOnError: false });
      } catch {
        html += `<span class="text-red-500">${escapeHtml(fullMatch)}</span>`;
      }
    } else if (fullMatch.startsWith('\\(') && fullMatch.endsWith('\\)')) {
      const math = fullMatch.slice(2, -2).trim();
      try {
        html += katex.renderToString(math, { displayMode: false, throwOnError: false });
      } catch {
        html += `<span class="text-red-500">${escapeHtml(fullMatch)}</span>`;
      }
    } else if (fullMatch.startsWith('$') && fullMatch.endsWith('$')) {
      const math = fullMatch.slice(1, -1).trim();
      try {
        html += katex.renderToString(math, { displayMode: false, throwOnError: false });
      } catch {
        html += `<span class="text-red-500">${escapeHtml(fullMatch)}</span>`;
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < raw.length) {
    html += escapeHtml(raw.slice(lastIndex));
  }

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}
