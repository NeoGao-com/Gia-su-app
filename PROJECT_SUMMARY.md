# TỔNG QUAN DỰ ÁN QUIZ APP (CHEAT SHEET TRA CỨU NHANH)

File này tổng hợp kiến trúc, cấu trúc tệp, sơ đồ dữ liệu, API endpoints, luồng giao diện và quy trình vận hành của ứng dụng Quiz App.

---

## 1. CÔNG NGHỆ & MÔ TRƯỜNG (TECH STACK)
- **Backend:** Python 3.11+ / FastAPI, SQLAlchemy Async, SQLite (`quiz.db`) / PostgreSQL, Redis (`SafeRedis` wrapper).
- **Security:** JWT (python-jose, HS256), Password Hashing (bcrypt), Double-Submit Cookie CSRF Middleware, Rate Limiting (Custom Redis/IP).
- **Frontend:** React 19, Vite 8, React Router v7, Axios (`withCredentials: true`), Tailwind CSS, KaTeX (MathRenderer).
- **Optimization:** Code-splitting (`React.lazy` + `lazyPages.jsx`), Gzip, Multi-stage Docker build, Nginx SPA proxy.

---

## 2. CẤU TRÚC THƯ MỤC THỰC TẾ

```
D:\quiz-app-main\
├── backend/
│   ├── app/
│   │   ├── core/           # Config, Security, CSRF, RateLimiter, Email, Logging
│   │   ├── models/         # User, Question, Exam, Classroom
│   │   ├── schemas/        # Auth, Question, Exam, Classroom, Assignment
│   │   ├── routers/        # Auth, Questions, Exam, Student, Classroom, Analytics, Export, Upload, Admin, Tasks
│   │   ├── services/       # Grading, Exporter (Docx/OMML), DocxParser, AI, Rendering, Tasks
│   │   ├── database.py     # SQLite/Postgres async session + SafeRedis
│   │   └── main.py         # FastAPI App, CORS, Lifespan (Seed Users), /health
│   ├── tests/
│   │   └── test_core.py    # Pytest unit tests (6/6 pass)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/axios.js    # Axios instance, Bearer token + X-CSRF-Token auto header
│   │   ├── components/     # ProtectedRoute, RootRedirect, Navbar, Sidebar, Modal, MathRenderer, WinFileExplorer...
│   │   ├── pages/
│   │   │   ├── auth/       # Login, Register, ForgotPassword
│   │   │   ├── student/    # StudentDashboard, ExamList, TakeExam, ExamHistory
│   │   │   ├── teacher/    # TeacherDashboard, QuestionBank, ExamManagement, ClassroomManagement, AssignmentManagement, Gradebook, Analytics
│   │   │   └── admin/      # AdminDashboard, UserManagement, AdminCategoryAudit
│   │   ├── lazyPages.jsx   # Lazy export definitions cho Router
│   │   └── main.jsx        # App Entry Point & BrowserRouter
│   ├── nginx.conf          # Nginx proxy config cho Docker SPA
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml       # Production Compose (Postgres, Redis, Backend, Frontend)
├── .env.example             # Template cấu hình môi trường
└── DEPLOY.md                # Hướng dẫn triển khai Docker
```

---

## 3. MÔ HÌNH DỮ LIỆU (DATABASE SCHEMAS)

- **User (`users`):** `id`, `email`, `hashed_password`, `full_name`, `role` (`STUDENT` | `TEACHER` | `ADMIN`), `grade_level`, `is_active`, `is_deleted`.
- **Question (`questions`):** `id`, `created_by_id`, `subject`, `grade_level`, `chapter`, `lesson`, `topic`, `question_type` (`MULTIPLE_CHOICE` | `TRUE_FALSE` | `SHORT_ANSWER` | `MATCHING` | `FILL_IN_BLANK` | `ESSAY`), `content`, `options` (JSON), `correct_option` (int), `correct_answer`, `correct_answers` (JSON), `sub_questions` (JSON), `blanks` (JSON), `sample_solution`, `explanation`, `difficulty`, `image_url`, `latex_code`, `is_deleted`.
- **Exam (`exams`):** `id`, `created_by_id`, `title`, `duration_minutes`, `pass_score`, `max_attempts`, `is_published`, `show_answers_after_submit`, `is_deleted`. Liên kết Many-to-Many `exam_questions`.
- **Classroom (`classrooms`):** `id`, `instructor_id`, `name`, `code` (Unique), `description`, `code_expires_at`.
  - `classroom_students`: `classroom_id`, `student_id`.
  - `assignments`: `id`, `classroom_id`, `exam_id`, `assigned_at`, `due_date`.
- **ExamSubmission (`exam_submissions`):** `id`, `exam_id`, `user_id`, `answers` (JSON), `version`, `status` (`IN_PROGRESS` | `SUBMITTED` | `GRADED`), `auto_score`, `essay_score`, `score`, `grading_status` (`PENDING_ESSAY` | `GRADED`), `time_spent`, `question_snapshot` (JSON), `started_at`, `submitted_at`.

---

## 4. DANH SÁCH API ENDPOINTS CHÍNH

### Auth (`/api/auth`)
- `POST /login` — Đăng nhập, trả JWT token + set HttpOnly `access_token` & `csrf_token`.
- `POST /register` — Đăng ký tài khoản.
- `POST /logout` — Đăng xuất, blacklist `jti` trên Redis.
- `GET /me` — Lấy thông tin user hiện tại.

### Questions (`/api/questions`)
- `GET /` — Danh sách câu hỏi (lọc theo subject, grade, chapter, lesson, topic).
- `POST /` — Tạo câu hỏi mới.
- `PUT /{id}` | `DELETE /{id}` — Cập nhật / Xóa câu hỏi.
- `GET /tree/structure` — Cấu trúc cây thư mục môn/lớp/chương/bài/dạng.
- `POST /import-json` — Nhập hàng loạt câu hỏi từ file JSON.
- `POST /upload-image` — Tải ảnh câu hỏi (magic bytes validation).

### Exams (`/api/exams`)
- `GET /` — Danh sách đề thi.
- `POST /` — Tạo đề thi mới (validate question_ids).
- `GET /{id}` — Chi tiết đề thi (tự động ẩn đáp án nếu là student).
- `PUT /submissions/{id}/grade` — Chấm điểm tự luận.

### Student (`/api/student`)
- `GET /exams` — Danh sách đề thi khả dụng.
- `POST /exams/{id}/start` — Bắt đầu làm bài, tạo `ExamSubmission`.
- `GET /exams/{id}` — Lấy đề thi làm bài (không chứa đáp án).
- `POST /submissions/{id}/save` — Auto-save đáp án (có versioning chống xung đột 409).
- `POST /submissions/{id}/submit` — Nộp bài (có server-side duration check).
- `GET /history` — Lịch sử làm bài.
- `GET /submissions/{id}` — Kết quả chi tiết sau khi nộp.

### Classrooms (`/api/classrooms`)
- `GET /` | `POST /` — Danh sách & Tạo lớp học.
- `POST /join` — Học sinh gia nhập lớp bằng mã `code` (có chống brute-force Redis).
- `POST /{id}/exams` — Giao đề thi cho lớp.
- `GET /{id}/students` — Danh sách học sinh trong lớp.

### Analytics (`/api/analytics`)
- `GET /summary` — Thống kê tổng quan (số đề, số câu, phổ điểm).

### Export & Upload (`/api`)
- `POST /export/docx` — Xuất đề thi ra Word (.docx) kèm công thức OMML/Math.
- `POST /upload/docx` — Bóc tách file Word tải lên thành danh sách câu hỏi.
- `POST /upload/image` — Endpoint duy nhất tải lên hình ảnh an toàn.

---

## 5. CÁC TÀI KHOẢN MẶC ĐỊNH (SEED USERS)
- **Admin:** `admin@gmail.com` / Mật khẩu đọc từ `ADMIN_PASSWORD` (mặc định `Password@123!`)
- **Teacher:** `teacher@example.com` / `Password@123!`
- **Student:** `student@example.com` / `Password@123!`

---

## 6. LỆNH VẬN HÀNH BẰNG TAY (QUICK COMMANDS)

```powershell
# Chạy Backend local
cd D:\quiz-app-main\backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Chạy Frontend local
cd D:\quiz-app-main\frontend
npm run dev -- --host 127.0.0.1 --port 5173

# Chạy Pytest
cd D:\quiz-app-main\backend
.\venv\Scripts\python.exe -m pytest tests/test_core.py -q -p no:cacheprovider

# Chạy Oxlint
cd D:\quiz-app-main\frontend
npx oxlint

# Build Docker toàn bộ
docker compose up -d --build
```
