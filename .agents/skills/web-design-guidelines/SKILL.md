---
name: web-design-guidelines
description: Review and audit web UI code for Web Interface Guidelines, UX quality, and WCAG accessibility compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check site against web best practices".
metadata:
  author: vercel-labs / antigravity
  version: "1.0.0"
  argument-hint: "<file-or-pattern>"
---

# Web Interface Guidelines & UI/UX Quality Audit

Review files for compliance with modern Web Interface Guidelines, WCAG accessibility, and responsive UX standards.

## When to Use This Skill
- Auditing existing frontend code or reviewing newly written components
- User requests: "review my UI", "check accessibility", "audit design", "review UX", "check against best practices"
- Pre-merge checks on React/Tailwind frontend code

---

## Complete Audit Rules

### 1. Accessibility (A11y) & Semantics
- **Icon-only buttons**: Always provide `aria-label` or visually hidden text (e.g. `<button aria-label="Đóng modal">`).
- **Form controls**: Must have associated `<label htmlFor="...">` or explicit `aria-label`.
- **Semantic HTML**:
  - Use `<button>` for actions, `<a>` / `<Link>` for navigation. Never `<div onClick={...}>` or `<span onClick={...}>`.
  - Tables must use `<table>`, `<thead>`, `<tbody>`, `<th>`, `<td>`.
  - Proper heading hierarchy: `<h1>` through `<h6>`.
- **Keyboard interaction**: Every clickable custom element must support `onKeyDown`/`onKeyUp` (Enter / Space).
- **Images**: Must have `alt` attribute (`alt=""` if purely decorative).
- **Decorative icons**: Mark with `aria-hidden="true"` so screen readers ignore them.
- **Dynamic updates**: Toasts, notifications, live search count, and validation banners must use `aria-live="polite"`.
- **Skip navigation**: Main app layouts should include a skip link for keyboard users.

### 2. Focus States
- **Visible focus indicator**: Every interactive control must have visible focus styling: e.g. `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none`.
- **No naked `outline-none`**: Never use `outline-none` or `outline: none` without providing a `focus-visible:ring-*` replacement.
- **Prefer `:focus-visible` over `:focus`**: Prevents persistent focus rings on mouse click while preserving keyboard focus.
- **Compound controls**: Use `focus-within:ring-*` on wrapper containers when children receive focus.
- **Sticky overlays**: Sticky headers/footers must not obscure active focused elements (use `scroll-margin-top`).

### 3. Forms & Inputs
- **Autofill support**: Inputs must have appropriate `name` and `autocomplete` attributes (`autocomplete="email"`, `autocomplete="current-password"`, etc.).
- **Input types & inputmode**: Use correct `type` (`email`, `tel`, `url`, `number`) and `inputmode` (`numeric`, `decimal`).
- **Never block paste**: Do not intercept `onPaste` with `preventDefault()` (allows password managers and clipboard insertion).
- **Clickable labels**: Clicking a `<label>` must focus its input (`htmlFor="id"` or wrap `<input>` inside `<label>`).
- **Spellcheck**: Add `spellCheck={false}` on email, username, and code fields.
- **Hit targets**: Labels and radio/checkbox controls must share a continuous hit target (no dead gaps).
- **Submit button state**:
  - Stays clickable until submission starts.
  - While loading: disable button, show spinner, and update text to `"Đang lưu…"` or `"Đang xử lý…"`.
- **Inline errors**: Display error messages adjacent to the erroneous input. Focus the first field with an error upon failed submission.
- **Placeholders**: End placeholder text with `…` (e.g. `Nhập tiêu đề câu hỏi…`).

### 4. Animation & Transitions
- **Prefers-reduced-motion**: Respect accessibility preference using `motion-safe:` or `@media (prefers-reduced-motion: no-preference)`.
- **GPU-accelerated properties**: Animate only `transform` and `opacity`. Avoid animating `width`, `height`, `top`, `left`, `margin`.
- **No wildcard transitions**: Never use `transition: all` or `transition-all` indiscriminately. Explicitly list transitions: `transition-colors`, `transition-transform`, `transition-opacity`.
- **Interruptible motion**: Transitions should feel responsive and terminate gracefully on rapid user input.

### 5. Typography & Micro-Copy
- **Ellipsis**: Use proper character `…` instead of three periods `...`.
- **Non-breaking spaces**: Use non-breaking space `&nbsp;` between numbers and units (e.g. `10&nbsp;MB`, `30&nbsp;phút`).
- **Loading states**: Text states end with `…` (e.g. `"Đang tải…"`).
- **Tabular numbers**: Use `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`) for timers, statistics, and table columns.
- **Headings**: Use `text-wrap: balance` (Tailwind: `text-balance`) or `text-pretty` on titles to prevent orphan words (widows).

### 6. Content Handling & Overflow
- **Long text containers**: Ensure text wraps or truncates gracefully using `truncate`, `line-clamp-2`, or `break-words`.
- **Flex child truncation**: Direct flex children require `min-w-0` to allow child text elements to truncate properly.
- **Empty states**: Always handle empty data states gracefully (empty list illustration/message + action button) instead of broken empty white space.
- **Error boundaries**: Wrap dynamic sections with error boundaries to prevent whole-page crashes.

### 7. Performance
- **List virtualization**: For large lists (>50 items), implement virtualization (`virtua` or `@tanstack/react-virtual`).
- **Layout thrashing**: Do not perform DOM reads (`getBoundingClientRect`, `offsetHeight`) inside render loops.
- **Fast inputs**: In controlled inputs, keep `onChange` light. Avoid expensive re-renders on every keystroke.
- **Images**: Always declare `width` and `height` (or aspect ratio) to prevent Cumulative Layout Shift (CLS). Use `loading="lazy"` on below-the-fold images.

### 8. Navigation & State Persistence
- **URL reflects state**: Filters, search keywords, tabs, and pagination should sync with URL query parameters (`URLSearchParams`).
- **Navigation links**: Use native anchor tags `<Link to="...">` rather than buttons with imperative `navigate()` when representing links, allowing Cmd/Ctrl+Click to open in new tab.
- **Destructive actions**: Destructive actions (delete question, delete classroom) must require confirmation (dialog or undo toast) — never trigger immediately.

### 9. Touch & Mobile Ergonomics
- **Touch target size**: Minimum touch target of 44×44px (or Tailwind `min-h-[44px] min-w-[44px]` / `p-2.5`).
- **Tap delay elimination**: Use `touch-action: manipulation` on interactive elements.
- **Modal scrolling**: Add `overscroll-behavior: contain` on modals and side drawers.
- **Safe areas**: Respect mobile safe areas on fixed bottom/top bars (`pb-[env(safe-area-inset-bottom)]`).

### 10. Dark Mode & Contrast
- **WCAG AA Contrast**: Normal text minimum contrast ratio 4.5:1, large text 3:1.
- **Dark mode background pairing**: Ensure muted text in dark mode maintains readable contrast against cards (`text-slate-400` on `bg-slate-800`, not low-contrast dark grays).
- **Theme color**: Set `<meta name="theme-color">` to match header/background.

---

## Anti-Patterns Checklist (Flag immediately)
1. `<div>` or `<span>` with `onClick` without role or keyboard handlers.
2. Icon button missing `aria-label`.
3. `outline-none` without `focus-visible:ring-*`.
4. `transition-all` on heavy layout elements.
5. Form input without label.
6. Missing empty state when array length is 0.
7. Unhandled null / undefined mapping (`items.map(...)` without `Array.isArray(items)`).
8. Hardcoded dates instead of `Intl.DateTimeFormat` or formatted locale dates.
9. Destructive delete buttons without confirmation.
10. `onPaste` with `preventDefault`.

---

## Audit Output Format

Group by file in terse `file:line` format:

```text
## frontend/src/components/AssignmentModal.jsx

frontend/src/components/AssignmentModal.jsx:42 - icon button missing aria-label
frontend/src/components/AssignmentModal.jsx:58 - input lacks associated <label>
frontend/src/components/AssignmentModal.jsx:75 - transition-all → use transition-colors / transition-transform
frontend/src/components/AssignmentModal.jsx:110 - flex child needs min-w-0 for text truncation

## frontend/src/components/QuizCard.jsx

✓ pass
```
