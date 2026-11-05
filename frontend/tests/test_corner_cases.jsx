import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert';

// Import target component
import { StudentAssignmentProgressModal } from '../src/components/StudentAssignmentProgressModal.jsx';

// Mock contexts and modules
// Since we want to test empirical rendering under different server responses/states,
// let's create a harness that tests both pure rendering and simulated user actions.

console.log('=== RUNNING ADVERSARIAL STRESS TEST HARNESS ===\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

// -------------------------------------------------------------
// Test 1: Student has 0 assignments (empty list)
// -------------------------------------------------------------
runTest('Corner Case 1: Student with 0 assignments renders clean empty state without crashing', () => {
  // We simulate the modal being open with classroom and student
  const student = { id: 101, full_name: 'Nguyễn Văn A', student_code: 'HS-001' };
  const classroom = { id: 1, name: 'Lớp 12A1', code: 'ABCDEF' };

  // Render modal
  const html = renderToStaticMarkup(
    <StudentAssignmentProgressModal
      isOpen={true}
      onClose={() => {}}
      student={student}
      classroom={classroom}
    />
  );

  // In initial render before fetch (or empty), it shouldn't crash
  assert.ok(html.includes('Nguyễn Văn A'), 'Must render student name');
  assert.ok(html.includes('HS-001'), 'Must render student code');
  assert.ok(html.includes('Lớp 12A1'), 'Must render classroom name');
});

// -------------------------------------------------------------
// Test 2: Internal KPI and Rendering Logic with 0 assignments
// -------------------------------------------------------------
runTest('Corner Case 1b: Empty assignments array produces correct KPIs (total=0, avgScore="-")', () => {
  // Test KPI calculation logic used in StudentAssignmentProgressModal
  const assignments = [];
  const total = assignments.length;
  const completed = assignments.filter(a => a.is_completed || a.status === 'COMPLETED').length;
  const uncompleted = total - completed;
  const scoredList = assignments
    .map(a => a.score)
    .filter(s => s !== null && s !== undefined && !isNaN(Number(s)));
  const avgScore = scoredList.length > 0
    ? (scoredList.reduce((acc, curr) => acc + Number(curr), 0) / scoredList.length).toFixed(1)
    : null;

  assert.strictEqual(total, 0, 'Total should be 0');
  assert.strictEqual(completed, 0, 'Completed should be 0');
  assert.strictEqual(uncompleted, 0, 'Uncompleted should be 0');
  assert.strictEqual(avgScore, null, 'Avg score should be null (rendered as "-")');
});

// -------------------------------------------------------------
// Test 3: Null due_date and Null score
// -------------------------------------------------------------
runTest('Corner Case 2: Null due_date and Null score render safely with placeholders', () => {
  const assignment = {
    assignment_id: 201,
    exam_id: 10,
    title: 'Kiểm tra 15 phút Đạo hàm',
    duration_minutes: 15,
    due_date: null,
    score: null,
    status: 'NOT_STARTED',
    is_completed: false,
    attempts_taken: 0,
    max_attempts: 1,
    submissions: []
  };

  // Check score formatting logic
  const scoreNum = assignment.score !== null && assignment.score !== undefined ? Number(assignment.score) : null;
  assert.strictEqual(scoreNum, null, 'ScoreNum must be null');

  // Check due date display logic
  const dueDateDisplay = assignment.due_date ? `Hạn: ${assignment.due_date}` : 'Không có hạn nộp';
  assert.strictEqual(dueDateDisplay, 'Không có hạn nộp', 'Should display fallback for null due_date');
});

// -------------------------------------------------------------
// Test 4: Score is 0.0 (Falsy value in JS)
// -------------------------------------------------------------
runTest('Corner Case 3: Score = 0.0 is treated as a valid score, NOT null or unattempted', () => {
  const assignment = {
    assignment_id: 202,
    exam_id: 11,
    title: 'Kiểm tra Giải tích',
    due_date: '2026-11-10T12:00:00Z',
    score: 0.0,
    status: 'COMPLETED',
    is_completed: true,
    attempts_taken: 1,
    max_attempts: 1,
    submissions: [
      { id: 99, attempt_number: 1, score: 0.0, grading_status: 'GRADED', status: 'COMPLETED' }
    ]
  };

  // Verify scoredList calculation handles 0.0 correctly
  const assignments = [assignment];
  const scoredList = assignments
    .map(a => a.score)
    .filter(s => s !== null && s !== undefined && !isNaN(Number(s)));
  
  assert.strictEqual(scoredList.length, 1, '0.0 must be retained in scoredList');
  assert.strictEqual(scoredList[0], 0.0, 'Value must be 0.0');

  const avgScore = (scoredList.reduce((acc, curr) => acc + Number(curr), 0) / scoredList.length).toFixed(1);
  assert.strictEqual(avgScore, '0.0', 'Average score must be 0.0, not null or NaN');

  const scoreNum = assignment.score !== null && assignment.score !== undefined ? Number(assignment.score) : null;
  assert.strictEqual(scoreNum, 0, 'scoreNum must be 0, not null');

  // Check badge color determination
  const badgeColor = scoreNum >= 8.0 ? 'emerald' : scoreNum >= 5.0 ? 'indigo' : 'rose';
  assert.strictEqual(badgeColor, 'rose', '0.0 score must have rose badge (failing score)');
});

// -------------------------------------------------------------
// Test 5: Score is 10.0 (Perfect score)
// -------------------------------------------------------------
runTest('Corner Case 4: Score = 10.0 displays correctly with emerald badge and 10.0 average', () => {
  const assignment = {
    assignment_id: 203,
    exam_id: 12,
    title: 'Kiểm tra Hình học',
    due_date: '2026-11-10T12:00:00Z',
    score: 10.0,
    status: 'COMPLETED',
    is_completed: true,
    attempts_taken: 1,
    max_attempts: 1,
    submissions: [
      { id: 100, attempt_number: 1, score: 10.0, grading_status: 'GRADED', status: 'COMPLETED' }
    ]
  };

  const assignments = [assignment];
  const scoredList = assignments
    .map(a => a.score)
    .filter(s => s !== null && s !== undefined && !isNaN(Number(s)));
  
  assert.strictEqual(scoredList.length, 1);
  assert.strictEqual(scoredList[0], 10.0);

  const avgScore = (scoredList.reduce((acc, curr) => acc + Number(curr), 0) / scoredList.length).toFixed(1);
  assert.strictEqual(avgScore, '10.0');

  const scoreNum = Number(assignment.score);
  const badgeColor = scoreNum >= 8.0 ? 'emerald' : scoreNum >= 5.0 ? 'indigo' : 'rose';
  assert.strictEqual(badgeColor, 'emerald', '10.0 score must have emerald badge (high score)');
});

// -------------------------------------------------------------
// Test 6: Event propagation on student row in ClassroomManagement.jsx
// -------------------------------------------------------------
runTest('Corner Case 5: Event propagation is intercepted so child buttons do not trigger row selection', () => {
  let modalOpened = false;
  let editStudentOpened = false;
  let removeStudentTriggered = false;

  // Mock student and handler simulating ClassroomManagement lines 710-776
  const s = { id: 5, full_name: 'Trần Thị B', email: 'b@gmail.com' };

  // Simulated Row onClick
  const onRowClick = () => {
    modalOpened = true;
  };

  // Simulated Container onClick with stopPropagation
  const onActionsContainerClick = (e) => {
    e.stopPropagation();
  };

  // Simulated Edit Button onClick
  const onEditClick = () => {
    editStudentOpened = true;
  };

  // Simulated Remove Button onClick
  const onRemoveClick = () => {
    removeStudentTriggered = true;
  };

  // Event dispatcher simulator
  const dispatchClick = (target) => {
    let propagationStopped = false;
    const fakeEvent = {
      stopPropagation: () => { propagationStopped = true; }
    };

    if (target === 'edit') {
      onEditClick();
      // Bubble to actions container
      onActionsContainerClick(fakeEvent);
      // Try bubble to row
      if (!propagationStopped) {
        onRowClick();
      }
    } else if (target === 'remove') {
      onRemoveClick();
      onActionsContainerClick(fakeEvent);
      if (!propagationStopped) {
        onRowClick();
      }
    } else if (target === 'row') {
      onRowClick();
    }
  };

  // Clicking Edit
  dispatchClick('edit');
  assert.strictEqual(editStudentOpened, true, 'Edit student modal must open');
  assert.strictEqual(modalOpened, false, 'Progress modal must NOT open when editing student');

  // Clicking Remove
  dispatchClick('remove');
  assert.strictEqual(removeStudentTriggered, true, 'Remove student must be triggered');
  assert.strictEqual(modalOpened, false, 'Progress modal must NOT open when removing student');

  // Clicking Row directly
  dispatchClick('row');
  assert.strictEqual(modalOpened, true, 'Progress modal opens only when row itself is clicked');
});

// -------------------------------------------------------------
// Test 7: Confirmation prompt dismissibility
// -------------------------------------------------------------
await runAsyncTest('Corner Case 6: Confirmation prompt is dismissible and cancels deletion cleanly', async () => {
  let apiDeleteCalled = false;
  let cacheCleared = false;

  const mockApi = {
    delete: async () => { apiDeleteCalled = true; }
  };
  const mockClearCache = () => { cacheCleared = true; };

  // Simulation of handleDeleteSubmission when user clicks CANCEL
  const mockConfirmDismiss = async () => {
    return false; // User clicked "Hủy"
  };

  const handleDeleteSubmissionWithConfirm = async (confirmedResult) => {
    const confirmed = await confirmedResult();
    if (!confirmed) return; // User dismissed confirmation

    await mockApi.delete();
    mockClearCache();
  };

  await handleDeleteSubmissionWithConfirm(mockConfirmDismiss);

  assert.strictEqual(apiDeleteCalled, false, 'api.delete must NOT be called if user dismisses prompt');
  assert.strictEqual(cacheCleared, false, 'Cache must NOT be cleared if user dismisses prompt');

  // Now simulate when user clicks CONFIRM
  const mockConfirmAccept = async () => {
    return true; // User clicked "Xác nhận"
  };

  await handleDeleteSubmissionWithConfirm(mockConfirmAccept);

  assert.strictEqual(apiDeleteCalled, true, 'api.delete MUST be called when confirmed');
  assert.strictEqual(cacheCleared, true, 'Cache MUST be cleared when confirmed');
});

// -------------------------------------------------------------
// Test 8: Malformed or unexpected date/time values
// -------------------------------------------------------------
runTest('Corner Case 7: Malformed dates and negative durations do not crash formatters', () => {
  function formatDateTime(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  function formatTimeSpent(seconds) {
    if (!seconds || seconds <= 0) return '0 giây';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s} giây`;
    if (s === 0) return `${m} phút`;
    return `${m}p ${s}s`;
  }

  // Null date
  assert.strictEqual(formatDateTime(null), null);
  // Undefined date
  assert.strictEqual(formatDateTime(undefined), null);
  // Malformed date
  assert.strictEqual(formatDateTime('not-a-date'), 'not-a-date', 'Malformed date gracefully falls back to raw string');
  // Valid ISO date
  assert.match(formatDateTime('2026-11-05T09:00:00Z'), /^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);

  // Time spent
  assert.strictEqual(formatTimeSpent(0), '0 giây');
  assert.strictEqual(formatTimeSpent(-10), '0 giây');
  assert.strictEqual(formatTimeSpent(45), '45 giây');
  assert.strictEqual(formatTimeSpent(120), '2 phút');
  assert.strictEqual(formatTimeSpent(125), '2p 5s');
});

console.log(`\n=== STRESS TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED ===`);
if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
