import React, { useState } from 'react';
import { 
  Calculator, ChevronDown, ChevronUp, Copy, Check, X, 
  Sparkles, Layers, BookOpen, Eye, HelpCircle, ArrowDown 
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';

// Danh mục các phím ký hiệu toán học chuẩn sư phạm
const MATH_CATEGORIES = [
  {
    id: 'basic',
    name: 'Cơ bản',
    items: [
      { label: 'Phân số', latex: '\\frac{a}{b}', preview: '\\frac{a}{b}' },
      { label: 'Căn bậc 2', latex: '\\sqrt{x}', preview: '\\sqrt{x}' },
      { label: 'Căn bậc n', latex: '\\sqrt[n]{x}', preview: '\\sqrt[n]{x}' },
      { label: 'Lũy thừa', latex: 'x^{2}', preview: 'x^{2}' },
      { label: 'Số mũ n', latex: 'x^{n}', preview: 'x^{n}' },
      { label: 'Chỉ số dưới', latex: 'x_{1}', preview: 'x_{1}' },
      { label: 'Cộng trừ', latex: '\\pm', preview: '\\pm' },
      { label: 'Trừ cộng', latex: '\\mp', preview: '\\mp' },
      { label: 'Nhân', latex: '\\times', preview: '\\times' },
      { label: 'Chia', latex: '\\div', preview: '\\div' },
      { label: 'Dấu chấm nhân', latex: '\\cdot', preview: '\\cdot' },
      { label: 'Khác', latex: '\\neq', preview: '\\neq' },
      { label: 'Xấp xỉ', latex: '\\approx', preview: '\\approx' },
      { label: 'Nhỏ hơn bằng', latex: '\\le', preview: '\\le' },
      { label: 'Lớn hơn bằng', latex: '\\ge', preview: '\\ge' },
      { label: 'Ngoặc tròn', latex: '\\left( x \\right)', preview: '(x)' },
      { label: 'Ngoặc vuông', latex: '\\left[ x \\right]', preview: '[x]' },
      { label: 'Trị tuyệt đối', latex: '\\left| x \\right|', preview: '|x|' },
    ]
  },
  {
    id: 'calculus',
    name: 'Giải tích',
    items: [
      { label: 'Tích phân', latex: '\\int f(x)dx', preview: '\\int f(x)dx' },
      { label: 'Tích phân xác định', latex: '\\int_{a}^{b} f(x)dx', preview: '\\int_{a}^{b} f(x)dx' },
      { label: 'Đạo hàm bậc 1', latex: "f'(x)", preview: "f'(x)" },
      { label: 'Đạo hàm dy/dx', latex: '\\frac{df}{dx}', preview: '\\frac{df}{dx}' },
      { label: 'Giới hạn lim', latex: '\\lim_{x \\to x_0} f(x)', preview: '\\lim_{x \\to x_0}' },
      { label: 'Giới hạn vô cực', latex: '\\lim_{x \\to +\\infty}', preview: '\\lim_{x \\to \\infty}' },
      { label: 'Vô cực', latex: '\\infty', preview: '\\infty' },
      { label: 'Tổng Sigma', latex: '\\sum_{i=1}^{n} a_i', preview: '\\sum_{i=1}^{n}' },
      { label: 'Tích Pi', latex: '\\prod_{i=1}^{n} a_i', preview: '\\prod_{i=1}^{n}' },
      { label: 'Logarit cơ số a', latex: '\\log_{a}(b)', preview: '\\log_{a}(b)' },
      { label: 'Logarit tự nhiên', latex: '\\ln(x)', preview: '\\ln(x)' },
      { label: 'Logarit thập phân', latex: '\\lg(x)', preview: '\\lg(x)' },
      { label: 'Hàm số e^x', latex: 'e^{x}', preview: 'e^{x}' },
    ]
  },
  {
    id: 'geometry',
    name: 'Hình học & Vectơ',
    items: [
      { label: 'Vectơ đơn', latex: '\\vec{v}', preview: '\\vec{v}' },
      { label: 'Vectơ 2 điểm', latex: '\\overrightarrow{AB}', preview: '\\overrightarrow{AB}' },
      { label: 'Độ dài vectơ', latex: '|\\vec{a}|', preview: '|\\vec{a}|' },
      { label: 'Tích vô hướng', latex: '\\vec{a} \\cdot \\vec{b}', preview: '\\vec{a} \\cdot \\vec{b}' },
      { label: 'Góc', latex: '\\widehat{ABC}', preview: '\\widehat{ABC}' },
      { label: 'Ký hiệu góc', latex: '\\angle A', preview: '\\angle A' },
      { label: 'Vuông góc', latex: '\\perp', preview: '\\perp' },
      { label: 'Song song', latex: '\\parallel', preview: '\\parallel' },
      { label: 'Tam giác', latex: '\\triangle ABC', preview: '\\triangle ABC' },
      { label: 'Độ', latex: '90^\\circ', preview: '90^\\circ' },
      { label: 'Số Pi', latex: '\\pi', preview: '\\pi' },
    ]
  },
  {
    id: 'greek',
    name: 'Ký tự Hy Lạp',
    items: [
      { label: 'alpha', latex: '\\alpha', preview: '\\alpha' },
      { label: 'beta', latex: '\\beta', preview: '\\beta' },
      { label: 'gamma', latex: '\\gamma', preview: '\\gamma' },
      { label: 'delta', latex: '\\delta', preview: '\\delta' },
      { label: 'epsilon', latex: '\\epsilon', preview: '\\epsilon' },
      { label: 'theta', latex: '\\theta', preview: '\\theta' },
      { label: 'lambda', latex: '\\lambda', preview: '\\lambda' },
      { label: 'mu', latex: '\\mu', preview: '\\mu' },
      { label: 'pi', latex: '\\pi', preview: '\\pi' },
      { label: 'sigma', latex: '\\sigma', preview: '\\sigma' },
      { label: 'phi', latex: '\\phi', preview: '\\phi' },
      { label: 'omega', latex: '\\omega', preview: '\\omega' },
      { label: 'Delta (Delta lớn)', latex: '\\Delta', preview: '\\Delta' },
      { label: 'Omega (Ohm)', latex: '\\Omega', preview: '\\Omega' },
    ]
  },
  {
    id: 'sets',
    name: 'Tập hợp & Hệ phương trình',
    items: [
      { label: 'Thuộc', latex: '\\in', preview: '\\in' },
      { label: 'Không thuộc', latex: '\\notin', preview: '\\notin' },
      { label: 'Tập con', latex: '\\subset', preview: '\\subset' },
      { label: 'Hợp', latex: '\\cup', preview: '\\cup' },
      { label: 'Giao', latex: '\\cap', preview: '\\cap' },
      { label: 'Tập rỗng', latex: '\\emptyset', preview: '\\emptyset' },
      { label: 'Tập số thực R', latex: '\\mathbb{R}', preview: '\\mathbb{R}' },
      { label: 'Tập số tự nhiên N', latex: '\\mathbb{N}', preview: '\\mathbb{N}' },
      { label: 'Tập số nguyên Z', latex: '\\mathbb{Z}', preview: '\\mathbb{Z}' },
      { label: 'Tập hữu tỉ Q', latex: '\\mathbb{Q}', preview: '\\mathbb{Q}' },
      { label: 'Hệ 2 phương trình', latex: '\\begin{cases} a_1 x + b_1 y = c_1 \\\\ a_2 x + b_2 y = c_2 \\end{cases}', preview: '\\begin{cases} x+y=1 \\\\ x-y=0 \\end{cases}' },
      { label: 'Dấu ngoặc vuông hoặc', latex: '\\left[ \\begin{array}{l} x = a \\\\ x = b \\end{array} \\right.', preview: '\\left[ \\begin{array}{l} x=1 \\\\ x=2 \\end{array} \\right.' },
      { label: 'Ma trận 2x2', latex: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', preview: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}' },
      { label: 'Với mọi', latex: '\\forall', preview: '\\forall' },
      { label: 'Tồn tại', latex: '\\exists', preview: '\\exists' },
      { label: 'Suy ra', latex: '\\Rightarrow', preview: '\\Rightarrow' },
      { label: 'Tương đương', latex: '\\Leftrightarrow', preview: '\\Leftrightarrow' },
    ]
  }
];

export function MathVirtualKeyboard({ onInsert, targetRef, className = '', defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState('basic');
  const [wrapMode, setWrapMode] = useState('inline'); // 'inline' ($...$) | 'block' ($$...$$) | 'raw'
  const [copied, setCopied] = useState(false);

  // Xử lý chèn trực tiếp vào vị trí con trỏ của input/textarea
  const handleInsert = (latexSnippet) => {
    let finalLatex = latexSnippet;
    if (wrapMode === 'inline') {
      finalLatex = `$${latexSnippet}$`;
    } else if (wrapMode === 'block') {
      finalLatex = `\n$$${latexSnippet}$$\n`;
    }

    if (onInsert) {
      onInsert(finalLatex);
    }

    // Xác định target element linh hoạt: ref object, function getter, hoặc document.activeElement
    let el = null;
    if (typeof targetRef === 'function') {
      el = targetRef();
    } else if (targetRef && targetRef.current) {
      el = targetRef.current;
    } else if (targetRef instanceof HTMLElement) {
      el = targetRef;
    } else if (
      document.activeElement && 
      (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')
    ) {
      el = document.activeElement;
    }

    if (el) {
      const start = typeof el.selectionStart === 'number' ? el.selectionStart : (el.value?.length || 0);
      const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : (el.value?.length || 0);
      const text = el.value || '';
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + finalLatex + after;
      el.value = newText;
      el.focus();
      
      // Đặt con trỏ ngay sau đoạn vừa chèn
      const newCursorPos = start + finalLatex.length;
      if (typeof el.setSelectionRange === 'function') {
        el.setSelectionRange(newCursorPos, newCursorPos);
      }
      
      // Bắn sự kiện input & change để React state / form handlers cập nhật
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const currentCategory = MATH_CATEGORIES.find(c => c.id === activeTab) || MATH_CATEGORIES[0];

  return (
    <div className={`border border-indigo-100 rounded-xl bg-slate-50/80 backdrop-blur-xs shadow-xs overflow-hidden ${className}`}>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 border-b border-indigo-100/70">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-xs font-bold text-indigo-900 hover:text-indigo-700 transition cursor-pointer select-none"
        >
          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <span>Bàn phím ảo công thức Toán (KaTeX)</span>
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-indigo-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-indigo-500" />
          )}
        </button>

        {isOpen && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 hidden sm:inline">Chế độ chèn:</span>
            <div className="bg-white/90 p-0.5 rounded-lg border border-indigo-200 flex items-center shadow-2xs">
              <button
                type="button"
                onClick={() => setWrapMode('inline')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  wrapMode === 'inline' 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
                title="Bọc công thức trong $...$ để hiển thị trên cùng dòng"
              >
                Inline $...$
              </button>
              <button
                type="button"
                onClick={() => setWrapMode('block')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  wrapMode === 'block' 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
                title="Bọc công thức trong $$...$$ để hiển thị tách khối ở giữa"
              >
                Khối $$...$$
              </button>
              <button
                type="button"
                onClick={() => setWrapMode('raw')}
                className={`px-2 py-0.5 rounded-md font-semibold transition cursor-pointer ${
                  wrapMode === 'raw' 
                    ? 'bg-indigo-600 text-white shadow-2xs' 
                    : 'text-slate-600 hover:text-indigo-600'
                }`}
                title="Chỉ chèn mã LaTeX thuần"
              >
                Thuần
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body: Tabs and Keypad */}
      {isOpen && (
        <div className="p-3 space-y-2.5">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200/80 pb-2">
            {MATH_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setActiveTab(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === cat.id
                    ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                    : 'bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/60'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Keys Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 max-h-[190px] overflow-y-auto pr-1">
            {currentCategory.items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsert(item.latex)}
                className="group flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/60 hover:shadow-xs transition active:scale-95 cursor-pointer relative"
                title={`${item.label} (Click để chèn: ${item.latex})`}
              >
                <div className="text-sm font-medium text-slate-800 group-hover:text-indigo-600 pointer-events-none min-h-[26px] flex items-center justify-center">
                  <MathRenderer content={`$${item.preview}$`} inline={true} />
                </div>
                <span className="text-[10px] text-slate-400 group-hover:text-indigo-500 truncate max-w-full font-sans mt-0.5">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Bấm vào phím để tự động chèn vào ô đang soạn thảo.
            </span>
            <span className="text-slate-400">Hỗ trợ KaTeX Math v0.18</span>
          </div>
        </div>
      )}
    </div>
  );
}
