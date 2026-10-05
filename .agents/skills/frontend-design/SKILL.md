---
name: frontend-design
description: Create modern, polished, distinctive web frontend interfaces in React and Tailwind CSS. Use when designing web components, landing pages, dashboards, forms, dialogs, cards, or when user asks for "đẹp hơn", "thiết kế hiện đại", "tối ưu UI/UX", "làm giao diện chuyên nghiệp", or to avoid generic AI-generated aesthetics.
metadata:
  author: antigravity
  version: "1.0.0"
---

# Modern Frontend Design & Craftsmanship

Design and implement web interfaces that feel handcrafted, modern, intuitive, and cohesive. Avoid generic, cookie-cutter "AI slop" (e.g. indiscriminate purple gradients, identical rounded rectangles, lacking visual hierarchy).

## When to Apply This Skill
- Designing or redesigning React + Tailwind CSS components
- Building dashboards, quiz creation interfaces, student exam screens, teacher consoles
- Requests like: "làm giao diện đẹp hơn", "modern UI", "redesign this component", "chỉnh sửa giao diện cho xịn"
- Upgrading micro-interactions, layout ergonomics, or typography

---

## Core Design Principles

### 1. Visual Hierarchy & Spacing Rhythm (8pt Grid)
- **Scale Spacing**: Use multiples of 4px / 8px: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px), `gap-8` (32px).
- **Proximity**: Related elements sit closer together (`gap-1.5` or `gap-2`). Unrelated sections have generous breathing room (`space-y-6` or `space-y-8`).
- **Surface Elevation Hierarchy**:
  - Base layer: `bg-slate-50 dark:bg-slate-950`
  - Container card: `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl`
  - Popover / Dropdown: `bg-white dark:bg-slate-900 shadow-xl border border-slate-200/90 dark:border-slate-700/80 rounded-xl`

### 2. Color Theory (60 - 30 - 10 Rule)
- **60% Dominant Neutral**: Clean canvas (soft white/slate in light mode, deep slate/zinc in dark mode).
- **30% Secondary Structure**: Cards, sidebars, borders, subtle badges, tabular rows (`bg-slate-100`, `border-slate-200`).
- **10% Intentional Accent**: Primary actions, key badges, progress indicators. (In this app: Indigo/Violet `#4F46E5` with Emerald/Amber accents).
- **Never use random rainbow badges**: Group statuses with consistent semantic tints:
  - Success / Hoàn thành: `bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800`
  - Pending / Đang làm: `bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800`
  - Danger / Hết hạn: `bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800`
  - Info / Mới: `bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800`

### 3. Typography Craft
- **Headings**: Use tighter tracking (`tracking-tight`), strong contrast (`text-slate-900 dark:text-white font-bold`), and `text-balance` to avoid single hanging words.
- **Body & Subtitles**: Never pitch black (`text-slate-600 dark:text-slate-400 font-normal leading-relaxed`).
- **Micro-details**:
  - Numbers / Timers: Always use `tabular-nums` so numbers don't jump when ticking down.
  - Badges / Labels: `text-xs font-semibold tracking-wide uppercase` or `text-xs font-medium`.
  - Icon + Text alignment: Always `inline-flex items-center gap-1.5`.

### 4. Component State Hygiene (The 7 Essential States)
Every interactive element or data section must gracefully handle all states:
1. **Default**: Crisp border, balanced padding, legible contrast.
2. **Hover**: Smooth transition (`transition duration-150`), subtle background shift or light lift (`hover:-translate-y-0.5 hover:shadow-md`).
3. **Active / Pressed**: Immediate tactile feedback (`active:scale-[0.98] active:translate-y-0`).
4. **Focus-Visible**: High-contrast outline ring for keyboard navigation (`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`).
5. **Loading**: Disables clicks, maintains exact button width, displays spinning SVG indicator with explanatory text (`Đang lưu…`).
6. **Empty State**: Friendly illustration/icon, clear header, short description, and primary CTA to create the first item.
7. **Error State**: Non-blocking alert, clear Vietnamese message, and an actionable retry button.

### 5. Mobile & Responsive Refinement
- **Desktop vs Mobile Modals**: On desktop, show centered dialog (`max-w-lg mx-auto my-8 rounded-2xl`). On mobile (`<640px`), convert to bottom sheet (`inset-x-0 bottom-0 rounded-t-3xl max-h-[90vh] overflow-y-auto pb-safe`).
- **Touch Ergonomics**: All tappable icons, dropdown triggers, and buttons must have minimum `min-h-[44px] min-w-[44px]` or adequate padding (`p-2.5`).
- **Table to Card Transformation**: On mobile, data tables should stack into clean information cards with label-value rows instead of horizontally unreadable compressed columns.

### 6. Modern Glassmorphism & Micro-details
- Sticky headers: Use subtle frosted glass: `sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800`.
- Subtle borders: In modern UI, borders should feel whisper-quiet (`border-slate-200/70` in light, `border-slate-800/80` in dark).
- Iconography: Use Lucide React icons with consistent `strokeWidth={2}` and standard sizing (`w-4 h-4` for compact, `w-5 h-5` for standard buttons, `w-6 h-6` for headers).
