# UX Architecture Proposal: Question Creation Flow

## 1. Current State Assessment
The existing `QuestionBank.jsx` implements a monolithic form in one modal. As fields expand (taxonomy, rich content, options, explanation), it creates high cognitive load, especially for mobile/smaller screens.

## 2. Proposed Multi-Step UX Flow
Transition to a stepper-based modal to reduce friction:

- **Step 1: Phân loại & Vị trí (Taxonomy)**
  - Subject, Grade (pre-selected)
  - Hierarchical dropdowns: Chapter -> Lesson -> Topic
- **Step 2: Dạng & Nội dung (Content)**
  - Question Type (Dropdown)
  - Content Input (Support for LaTeX rendering preview)
  - Image URL Input / File Upload
- **Step 3: Lựa chọn & Đáp án (Options)**
  - Dynamic UI based on Type:
    - *Multiple Choice*: Grid-based option entry + Radio for correct answer
    - *Short Answer*: Text input
    - *True/False*: Binary toggle
- **Step 4: Tổng kết & Giải thích (Review & Finalize)**
  - Brief preview
  - Explanation input
  - Submit

## 3. Technical Implementation
- **State Management**: Use `activeStep` (1-4) in local state.
- **Form Data**: Maintain persistent `formData` across steps.
- **UX Enhancements**:
  - Clear progress bar at the top of the modal.
  - "Back" and "Next" buttons with validation checks at each step.
  - "Preview" toggle to see rendered LaTeX/Math.

---
**ArchitectUX**: Foundation established for LuxuryDeveloper implementation.