# Quiz App - Hệ Thống Quản Lý & Tổ Chức Thi Trắc Nghiệm Trực Tuyến

Ứng dụng web quản lý ngân hàng câu hỏi, tạo đề thi và tổ chức thi trắc nghiệm trực tuyến. Hỗ trợ công thức Toán học KaTeX/LaTeX, bóc tách đề thi từ Word (.docx), tạo câu hỏi tự động bằng AI (OpenAI), và nhập hàng loạt bằng JSON.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ |
|:---|:---|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2 |
| **Database** | SQLite (dev) / PostgreSQL (production), Redis (cache & rate limit) |
| **Frontend** | React 19, Vite 8, React Router v7, Tailwind CSS |
| **AI** | OpenAI API (tự động tạo câu hỏi) |
| **Rendering** | KaTeX (công thức toán), LaTeX rendering service |
| **Export** | DOCX export/import (python-docx) |
| **DevOps** | Docker & Docker Compose, Nginx (reverse proxy) |
| **Auth** | JWT (HS256), Double-Submit Cookie CSRF, Rate Limiting |

---

## 📁 Cấu Trúc Thư Mục

```
quiz-app-main/
├── backend/                          # Backend FastAPI (Python)
│   ├── app/
│   │   ├── core/                    # Config, CSRF, Security, Email, Rate Limiter
│   │   ├── models/                  # User, Question, Exam, Classroom, AIConfig, Notification
│   │   ├── routers/                 # Auth, Question, Exam, Student, Classroom, Analytics, AI, Export...
│   │   ├── schemas/                 # Pydantic schemas cho validation
│   │   ├── services/                # AI Service, Grading, Export, Rendering, Tasks
│   │   ├── database.py              # DB connection (SQLite/PostgreSQL + Redis)
│   │   └── main.py                  # Entry point FastAPI
│   ├── alembic/                     # Database migrations
│   ├── tests/                       # Unit tests
│   ├── seed_all.py / seed_users.py  # Seed data scripts
│   ├── requirements.txt             # Python dependencies
│   ├── Dockerfile                   # Backend Docker image
│   └── quiz.db                      # SQLite database (dev)
├── frontend/                        # Frontend React + Vite
│   ├── src/
│   │   ├── api/axios.js             # Axios config
│   │   ├── components/              # Navbar, Sidebar, Modal, MathRenderer, FileExplorer...
│   │   ├── pages/
│   │   │   ├── auth/                # Login, Register, ForgotPassword
│   │   │   ├── student/             # Dashboard, ExamList, TakeExam, ExamHistory
│   │   │   └── teacher/             # QuestionBank, ExamMgmt, Gradebook, Analytics...
│   │   ├── App.jsx, main.jsx        # App entry point
│   │   └── lazyPages.jsx            # Code-splitting config
│   ├── dist/                        # Build output (Vite)
│   ├── nginx.conf                   # Nginx config cho Docker SPA
│   ├── Dockerfile                   # Frontend Docker image (Node build + Nginx serve)
│   └── package.json
├── docker-compose.yml               # Production: Postgres + Redis + Backend + Frontend
├── .env.example                     # Environment template
├── nginx.conf                       # Nginx reverse proxy (local dev)
└── DEPLOY.md                        # Hướng dẫn triển khai
```

---

## 👥 Tài Khoản Mặc Định (Seed Users)

| Vai trò | Email | Mật khẩu |
| :--- | :--- | :--- |
| **Admin** | `admin@example.com` | `Password@123!` |
| **Teacher** | `teacher@example.com` | `Password@123!` |
| **Student** | `student@example.com` | `Password@123!` |

---

## 🌟 Tính Năng Nổi Bật

1. **Ngân hàng Câu hỏi**: Hỗ trợ nhiều dạng câu hỏi (Trắc nghiệm, Đúng/Sai, Điền khuyết, Trả lời ngắn, Tự luận, Matching, Fill-in-blank, Essay).
2. **Tạo câu hỏi bằng AI**: Tự động sinh câu hỏi từ OpenAI API với prompt chuẩn hóa.
3. **Live LaTeX Preview**: Soạn thảo công thức Toán học trực quan với KaTeX và MathRenderer.
4. **Bóc tách Word (.docx)**: Nhập hàng loạt câu hỏi từ file Word.
5. **Quản lý Lớp học & Đề thi**: Giao bài, thi trực tuyến, mã lớp tự động, chống brute-force.
6. **Chấm điểm tự động**: Tự động chấm trắc nghiệm, chấm luận bàn (essay) với AI.
7. **Thống kê & Analytics**: Phổ điểm, thống kê tổng quan cho giáo viên.
8. **Xuất Word (.docx)**: Xuất đề thi ra Word kèm công thức OMML/Math.
9. **Rate Limiting & CSRF**: Bảo mật với Redis-based rate limiter, Double-Submit Cookie CSRF.
10. **Code-splitting**: Lazy loading page với React.lazy cho performance.

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Khởi chạy Local (Phát triển)

**Backend:**
```bash
cd backend
python -m venv venv
# Trên Windows:
.\venv\Scripts\Activate
pip install -r requirements.txt
# Copy .env.example để tạo .env
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Mở `http://localhost:5173` để xem frontend, API chạy ở `http://localhost:8000`.

### 2. Khởi chạy bằng Docker Compose (Production)

```bash
# 1. Copy file cấu hình
cp .env.example .env
# Mở .env và thay các giá trị bắt buộc: SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD, ADMIN_PASSWORD

# 2. Build + chạy toàn bộ stack
docker compose up -d --build

# 3. Kiểm tra trạng thái
docker compose ps
curl http://localhost/health
```

| Service   | Container       | Port mặc định | Ghi chú                              |
|-----------|-----------------|---------------|--------------------------------------|
| frontend  | quiz_frontend   | 80            | Nginx serve SPA + proxy `/api/`      |
| backend   | quiz_backend    | 8000          | FastAPI, health check `/health`      |
| postgres  | quiz_postgres   | 5432          | Data persist trong `postgres_data`   |
| redis     | quiz_redis      | 6379          | Có password, persist trong `redis_data` |

---

## 📡 API Endpoints

Tất cả API được prefix `/api/`. Xem docs chi tiết tại `http://localhost:8000/docs` khi backend đang chạy.

| Nhóm | Endpoints chính |
|:---|:---|
| **Auth** | `POST /login`, `POST /register`, `POST /logout`, `GET /me` |
| **Questions** | `GET /`, `POST /`, `PUT /{id}`, `DELETE /{id}`, `GET /tree/structure`, `POST /import-json`, `POST /upload-image` |
| **Exams** | `GET /`, `POST /`, `GET /{id}`, `PUT /submissions/{id}/grade` |
| **Student** | `GET /exams`, `POST /exams/{id}/start`, `POST /submissions/{id}/save`, `POST /submissions/{id}/submit`, `GET /history` |
| **Classrooms** | `GET /`, `POST /`, `POST /join`, `POST /{id}/exams`, `GET /{id}/students` |
| **Analytics** | `GET /summary` |
| **Export** | `POST /export/docx`, `POST /upload/docx`, `POST /upload/image` |
| **AI** | `POST /generate-questions`, `POST /render-math` |
| **Notifications** | `GET /`, `POST /read` |
| **AI Config** | `GET /`, `POST /`, `PUT /{id}` |

---

## 🗄 Mô Hình Dữ Liệu

- **User**: `id`, `email`, `hashed_password`, `full_name`, `role` (`STUDENT` | `TEACHER` | `ADMIN`), `grade_level`, `is_active`, `is_deleted`
- **Question**: `id`, `created_by_id`, `subject`, `grade_level`, `chapter`, `lesson`, `topic`, `question_type`, `content`, `options` (JSON), `correct_option`, `correct_answer`, `sub_questions`, `blanks`, `sample_solution`, `explanation`, `difficulty`, `image_url`, `latex_code`, `is_deleted`
- **Exam**: `id`, `created_by_id`, `title`, `duration_minutes`, `pass_score`, `max_attempts`, `is_published`, `show_answers_after_submit`, `is_deleted`
- **Classroom**: `id`, `instructor_id`, `name`, `code` (Unique), `description`, `code_expires_at`
- **ExamSubmission**: `id`, `exam_id`, `user_id`, `answers` (JSON), `version`, `status`, `auto_score`, `essay_score`, `score`, `time_spent`

---

## 🧪 Chạy Tests

```bash
cd backend
.\venv\Scripts\python.exe -m pytest tests/test_core.py -v
```

---

## 🐳 Lệnh Docker Phổ Biến

```bash
docker compose logs -f backend      # Xem log backend
docker compose logs -f frontend     # Xem log nginx
docker compose down                 # Dừng stack (giữ data)
docker compose down -v              # Dừng + XÓA toàn bộ data
docker compose up -d --build backend  # Rebuild riêng backend
```

---

## 📝 Ghi Chú

- `.env` chứa secrets — không commit lên git (đã có trong `.gitignore`).
- `quiz.db` trong `backend/` dùng cho phát triển local; production dùng PostgreSQL.
- File upload lưu trong `backend/static/uploads/` (Docker: volume `backend_uploads`).
- CORS được cấu hình cho `localhost:5173` (Vite dev) và `localhost:80` (production).
