# 🎓 TutorQuiz - Nền Tảng Quản Lý Giảng Dạy & Luyện Thi Trắc Nghiệm Thông Minh

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1.svg?logo=postgresql&logoColor=white)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D.svg?logo=redis&logoColor=white)](https://redis.io)
[![KaTeX](https://img.shields.io/badge/KaTeX-Math_Render-059669.svg)](https://katex.org)

**TutorQuiz** là giải pháp phần mềm quản lý học tập và khảo thí trực tuyến toàn diện, được thiết kế chuyên biệt cho **Giáo viên, Gia sư, Trung tâm bồi dưỡng kiến thức** và **Học sinh THCS - THPT**. Hệ thống tích hợp sâu công nghệ AI (Gemini, OpenAI), bộ dựng công thức Toán học KaTeX chuẩn quốc tế, xuất bản đề thi Word/PDF chuyên nghiệp, cùng giao diện hiện đại tối ưu trải nghiệm trên mọi thiết bị.

---

## 📑 Mục Lục
1. [Công Nghệ Nổi Bật (Tech Stack)](#-công-nghệ-nổi-bật-tech-stack)
2. [Tài Khoản Kiểm Thử Mặc Định](#-tài-khoản-kiểm-thử-mặc-định)
3. [Hệ Thống Tính Năng Toàn Diện](#-hệ-thống-tính-năng-toàn-diện)
   - [Dành cho Giáo viên & Gia sư](#1-dành-cho-giáo-viên--gia-sư)
   - [Dành cho Học sinh](#2-dành-cho-học-sinh)
4. [Sơ Đồ Kiến Trúc Hệ Thống](#-sơ-đồ-kiến-trúc-hệ-thống)
5. [Cấu Trúc Thư Mục Dự Án](#-cấu-trúc-thư-mục-dự-án)
6. [Hướng Dẫn Cài Đặt & Khởi Chạy](#-hướng-dẫn-cài-đặt--khởi-chạy)
   - [Chạy Cục Bộ (Local Development)](#1-chạy-cục-bộ-local-development)
   - [Chạy với Docker Compose](#2-chạy-bằng-docker-compose)
   - [Triển Khai Production (Vercel & Supabase)](#3-triển-khai-production-vercel--supabase)
7. [Danh Mục RESTful API](#-danh-mục-restful-api)
8. [Cấu Hình Biến Môi Trường (.env)](#-cấu-hình-biến-môi-trường-env)
9. [Bảo Mật & Tối Ưu Hiệu Năng](#-bảo-mật--tối-ưu-hiệu-năng)

---

## 🛠 Công Nghệ Nổi Bật (Tech Stack)

| Lớp kiến trúc | Công nghệ chính | Tính năng & Vai trò |
|:---|:---|:---|
| **Backend API** | **FastAPI** (Python 3.11+), **SQLAlchemy 2.0 (Async)**, **Pydantic v2** | RESTful API bất đồng bộ hoàn toàn, xử lý truy vấn dữ liệu hiệu năng cao với Connection Pooling và GZip Compression. |
| **Frontend Web** | **React 19**, **Vite 8**, **Tailwind CSS**, **Lucide Icons** | Giao diện Single Page Application (SPA), Code-Splitting động, Mobile-First UI/UX đạt chuẩn tiếp cận WCAG AA. |
| **Cơ Sở Dữ Liệu** | **PostgreSQL (Supabase)** / **SQLite (Dev)** | Lưu trữ dữ liệu quan hệ với khóa ngoại cascade, Soft Delete, và 18+ Composite Indexes tăng tốc tối đa. |
| **Bộ Nhớ Đệm & Cache** | **Redis (Upstash / Redis Cloud)** + **SafeRedis In-Memory** | Cache phân tầng (Client-Memory + Redis Server), tự động ngắt mạch bảo vệ (Circuit Breaker) và chống nghẽn mạng. |
| **Soạn Thảo & Toán Học** | **KaTeX**, **MathRenderer** | Render công thức Toán/Lý/Hóa mượt mà thời gian thực qua cú pháp inline `$..$` và display `$$..$$`. |
| **Trí Tuệ Nhân Tạo (AI)** | **Google Gemini API**, **OpenAI GPT-4o**, **DeepSeek**, **Groq** | Tự động sinh câu hỏi trắc nghiệm từ tài liệu/văn bản, phân tích độ khó câu hỏi, và chấm bài tự luận kèm nhận xét sư phạm. |
| **Xử Lý Tài Liệu** | **python-docx**, **ReportLab**, **PyMuPDF**, **PyPDF** | Nhập câu hỏi từ Word/PDF, xuất đề thi chuẩn in ấn đẹp mắt ra `.docx` và `.pdf` kèm bảng đáp án chi tiết. |
| **Bảo Mật & Phân Quyền** | **JWT (HS256)**, **bcrypt**, **CSRF Cookie**, **Rate Limiter** | Bảo vệ chống Brute-force, Session Hijacking, lọc định dạng file ảnh qua Magic Bytes thực tế. |

---

## 👥 Tài Khoản Kiểm Thử Mặc Định

Hệ thống cấu hình sẵn 2 tài khoản mẫu phục vụ việc kiểm thử nhanh:

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Mục đích sử dụng |
|:---|:---|:---|:---|
| **Giáo viên / Gia sư** | `teacher@example.com` | `Password@123!` | Quản lý câu hỏi, tạo đề, tạo lớp học, giao bài, chấm thi, xem thống kê |
| **Học sinh** | `student@example.com` | `Password@123!` | Làm bài tập, thi thử, xem thời khóa biểu, thảo luận bài tập theo lớp |

> **Lưu ý:** Khi đưa vào môi trường Production, quý thầy cô vui lòng đổi mật khẩu ngay tại trang **Hồ sơ & Mật khẩu**.

---

## 🌟 Hệ Thống Tính Năng Toàn Diện

### 1. Dành cho Giáo viên & Gia sư

#### A. Ngân hàng câu hỏi phân cấp 5 tầng
- Cây phân cấp chuẩn sư phạm: **Môn học $\rightarrow$ Khối lớp $\rightarrow$ Chương $\rightarrow$ Bài $\rightarrow$ Dạng bài**.
- Đa dạng định dạng câu hỏi:
  - **Trắc nghiệm 4 đáp án (MULTIPLE_CHOICE)**.
  - **Đúng / Sai 4 mệnh đề (TRUE_FALSE)** theo cấu trúc đề thi tốt nghiệp THPT mới.
  - **Điền đáp án ngắn (SHORT_ANSWER)**.
  - **Tự luận (ESSAY)** kèm hướng dẫn chấm và barem điểm.
- Hỗ trợ công thức Toán học KaTeX với xem trước (Live Preview).
- Quản lý trạng thái câu hỏi (Bản nháp / Đã duyệt), tìm kiếm nâng cao theo từ khóa, môn học, mức độ tư duy.

#### B. 🤖 AI Soạn đề từ tài liệu & bài giảng (Document / Text to Quiz)
- Nhập nhanh bài giảng bằng cách dán văn bản hoặc tải file tài liệu: `.docx`, `.pdf`, `.txt`, `.md`.
- Cung cấp sẵn 4 bộ tài liệu mẫu chuẩn kiến thức (Toán 10 Vectơ, Vật lý 11 Khúc xạ, Hóa học 12 Este, Tiếng Anh 10 Modal Verbs).
- Tùy chỉnh môn học, khối lớp (6-12), số lượng câu hỏi (3, 5, 10, 15, 20 câu), ma trận độ khó (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao).
- Tự động sinh công thức Toán KaTeX, lời giải thích chi tiết và thang độ khó.
- Màn hình kiểm duyệt trực quan cho phép chỉnh sửa nội dung và **Lưu trực tiếp hàng loạt vào Ngân hàng câu hỏi**.

#### C. Quản lý Đề thi & Ma trận đề thi
- Tạo đề thi nhanh qua 3 phương thức: **Từ Ngân hàng câu hỏi**, **Sinh đề ngẫu nhiên theo Ma trận**, hoặc **Soạn đề thủ công**.
- Cấu hình đề thi: Thời gian làm bài (phút), số lần làm tối đa, điểm đạt, trộn thứ tự câu hỏi và đáp án, cho phép xem đáp án sau khi nộp.
- Bộ lọc đề thi linh hoạt theo Môn học, Khối lớp, Loại đề, Trạng thái xuất bản.
- **Xuất đề thi ra Word (.docx) & PDF (.pdf)**: Tạo file in ấn chuyên nghiệp có hoặc không kèm đáp án & lời giải chi tiết.

#### D. Quản lý Lớp học & Kênh Thảo luận (Classroom Q&A)
- Tạo lớp học với mã mời 6 ký tự bảo mật, quản lý danh sách học sinh tham gia.
- Giao bài tập về nhà và bài kiểm tra theo từng lớp với thời hạn cụ thể.
- **Kênh Thảo luận & Hỏi đáp theo lớp (Classroom Discussions)**:
  - Học sinh và giáo viên trao đổi thắc mắc bài vở.
  - Hỗ trợ nhập công thức Toán KaTeX kèm ảnh đính kèm minh họa.
  - Huy hiệu **⭐ Lời giải của Thầy/Cô** giúp đánh dấu câu trả lời chính thức.
  - Tính năng ghim bài viết quan trọng lên đầu lớp học.

#### E. Thời khóa biểu tương tác (Interactive Schedule)
- Bảng lịch tuần tương tác trực quan: Thứ Hai $\rightarrow$ Chủ Nhật.
- Khối sự kiện phân biệt theo màu sắc của môn học và lớp.
- Hỗ trợ kéo thả, phóng to/thu nhỏ để điều chỉnh thời lượng buổi học (từ 15 phút đến 240 phút).
- Tự động lặp lại hàng tuần hoặc tạo buổi học/sự kiện ngoại khóa 1 lần.

#### F. Sổ điểm & Chấm bài tự luận bằng AI
- Tự động chấm điểm trắc nghiệm tức thì ngay khi học sinh nộp bài.
- **Chấm tự luận bằng AI Trợ giảng**: Phân tích câu trả lời của học sinh so với barem đáp án mẫu, chỉ ra ưu điểm đã đạt, thiếu sót cần khắc phục, gợi ý cải thiện để đạt điểm tối đa và đề xuất điểm số chính xác.
- Sổ điểm điện tử theo lớp, xuất báo cáo kết quả học tập.

#### G. Cấu hình AI Đa Nhà Cung Cấp
- Quản lý cấu hình API Key và mô hình AI: **Google Gemini**, **OpenAI**, **DeepSeek**, **Groq**, **Anthropic**, **Ollama**.

---

### 2. Dành cho Học sinh

#### A. Tổng quan học tập (Student Dashboard)
- Thống kê trực quan số bài tập cần nộp, kỳ thi sắp diễn ra, điểm trung bình tích lũy.
- Biểu đồ tiến độ rèn luyện và lời khuyên gia sư AI được cá nhân hóa theo điểm mạnh/yếu.

#### B. Bài tập cần nộp & Kỳ thi trực tuyến
- Danh sách bài tập và đề thi được phân bổ theo các lớp đang tham gia.
- Bộ lọc bài tập theo môn học, khối lớp, hạn chót làm bài.

#### C. Phòng thi chuẩn hóa (Take Exam)
- Đồng hồ đếm ngược thời gian thực, tự động cảnh báo khi sắp hết giờ.
- **Bảng điều hướng câu hỏi thông minh**: Trạng thái Đã làm, Chưa làm, và Đánh dấu xem lại.
- **Tự động lưu bài làm (Auto-save)** lên máy chủ để phòng tránh mất điện hoặc rớt mạng.
- Giao diện tối ưu hoàn hảo trên điện thoại di động (Bottom Drawer, Touch target $\ge 44px$).
- Hệ thống phát hiện chuyển đổi tab (Tab Switch Detection) hỗ trợ giám sát trung thực.

#### D. Xem lại bài làm & Lịch sử điểm số
- Xem lại chi tiết từng lượt làm bài, số câu đúng/sai/chưa làm.
- Xem bảng đáp án chính thức, lời giải chi tiết KaTeX và nhận xét sư phạm của thầy cô hoặc AI.

#### E. Thời khóa biểu học sinh
- Tự động tổng hợp toàn bộ lịch học của các lớp mà học sinh đang theo học theo tuần.

#### F. Kênh Hỏi đáp & Thảo luận lớp học
- Đăng câu hỏi bài tập kèm hình ảnh chụp bài làm, trao đổi cùng thầy cô và bạn bè.

#### G. Hồ sơ cá nhân & Đổi mật khẩu
- Cập nhật thông tin học sinh, thông tin phụ huynh, trường lớp, đổi mật khẩu tài khoản an toàn.

---

## 🏛 Sơ Đồ Kiến Trúc Hệ Thống

```mermaid
flowchart TD
    subgraph Client ["Client Browser / Mobile Web"]
        UI["React 19 + Tailwind CSS"]
        Math["KaTeX MathRenderer"]
        ClientCache["Client-Side Memory Cache (25s)"]
    end

    subgraph CDN ["Edge Gateway (Vercel)"]
        ReverseProxy["Reverse Proxy & Static Files CDN"]
    end

    subgraph Backend ["FastAPI Application (Python 3.11+)"]
        AuthMiddleware["JWT Auth & CSRF Middleware"]
        RouterAuth["/api/auth (Profile & Security)"]
        RouterExams["/api/exams (Exams & Grading)"]
        RouterClassrooms["/api/classrooms (Classes & Q&A)"]
        RouterQuestions["/api/questions (Bank & Tree)"]
        RouterSchedule["/api/schedule (Timetable)"]
        RouterAI["/api/ai (Doc-to-Quiz & Essay Grading)"]
        RouterExport["/api/export (Word & PDF Exporter)"]
    end

    subgraph Storage ["Dữ liệu & Ngoại vi"]
        PG[("PostgreSQL / Supabase DB")]
        RedisCache[("Redis Cache & Rate Limiter")]
        AICloud["Google Gemini / OpenAI API"]
    end

    UI --> ReverseProxy
    ReverseProxy --> Backend
    Backend --> AuthMiddleware
    AuthMiddleware --> RouterAuth & RouterExams & RouterClassrooms & RouterQuestions & RouterSchedule & RouterAI & RouterExport
    RouterExams & RouterClassrooms & RouterQuestions & RouterSchedule --> PG
    RouterAuth & RouterQuestions & RouterExams --> RedisCache
    RouterAI --> AICloud
```

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
quiz-app-main/
├── backend/                              # Backend FastAPI (Python)
│   ├── app/
│   │   ├── core/                        # Cấu hình config, JWT, CSRF, Rate Limiter, Logger
│   │   ├── models/                      # SQLAlchemy models (User, Question, Exam, Classroom, Schedule...)
│   │   ├── routers/                     # RESTful API endpoints:
│   │   │   ├── auth.py                  # Đăng nhập, đăng ký, hồ sơ người dùng, đổi mật khẩu
│   │   │   ├── classroom.py             # Quản lý lớp học, bài tập lớp, Kênh hỏi đáp thảo luận
│   │   │   ├── exam.py                  # Quản lý đề thi, nộp bài, chấm tự luận bằng AI
│   │   │   ├── export.py                # Xuất đề thi ra Word (.docx) và PDF (.pdf)
│   │   │   ├── questions.py             # Ngân hàng câu hỏi, cây thư mục 5 tầng, thống kê
│   │   │   ├── schedule.py              # Thời khóa biểu kéo thả giáo viên & học sinh
│   │   │   ├── student.py               # Phòng thi, nộp bài, lịch sử, danh sách đề học sinh
│   │   │   ├── ai.py                    # Sinh câu hỏi từ văn bản/tài liệu, phân tích độ khó
│   │   │   └── upload.py                # Tải ảnh minh họa câu hỏi & bài tập an toàn
│   │   ├── schemas/                     # Pydantic v2 schemas xác thực dữ liệu
│   │   ├── services/                    # Dịch vụ nghiệp vụ:
│   │   │   ├── ai_service.py            # Kết nối LLM (Gemini, OpenAI), sinh đề & chấm tự luận
│   │   │   ├── exporter.py              # Engine xuất Word & PDF hỗ trợ công thức Toán
│   │   │   ├── document_parser.py       # Trích xuất văn bản từ docx, pdf, txt, md
│   │   │   ├── grading.py               # Thuật toán chấm trắc nghiệm & Đúng/Sai đa ý
│   │   │   └── storage.py               # Lưu trữ Supabase Storage / Local
│   │   ├── database.py                  # Kết nối Async Database & SafeRedis
│   │   └── main.py                      # Khởi chạy FastAPI, CORS, GZip, Auto-DDL & Indexing
│   ├── tests/                           # Bộ kiểm thử tự động pytest (22 test cases)
│   ├── requirements.txt                 # Danh sách gói phụ thuộc Python
│   └── Dockerfile                       # Dockerfile Backend
├── frontend/                            # Frontend React 19 + Vite 8
│   ├── src/
│   │   ├── api/axios.js                 # Axios Client, Interceptors, Client-side cache
│   │   ├── components/                  # Các component tái sử dụng:
│   │   │   ├── AIGenerateQuizModal.jsx  # Modal AI Soạn đề từ tài liệu & bài giảng
│   │   │   ├── ClassroomDiscussionsModal.jsx # Kênh Hỏi đáp & Thảo luận theo lớp
│   │   │   ├── SubmissionReviewModal.jsx # Xem lại bài thi & Chấm tự luận bằng AI
│   │   │   ├── MathRenderer.jsx         # Component hiển thị KaTeX thời gian thực
│   │   │   ├── Sidebar.jsx, Navbar.jsx  # Thanh điều hướng chuẩn sư phạm
│   │   │   └── Modal.jsx, Pagination.jsx# Hộp thoại & Phân trang chuẩn
│   │   ├── pages/                       # Các màn hình ứng dụng:
│   │   │   ├── auth/                    # Đăng nhập, Đăng ký, Quên mật khẩu
│   │   │   ├── student/                 # Bàn học sinh, Bài tập, Phòng thi, Sổ điểm, Lịch, Lớp
│   │   │   └── teacher/                 # Bàn giáo viên, Ngân hàng câu hỏi, Quản lý đề, Sổ điểm, Lịch
│   │   ├── context/ToastContext.jsx     # Hệ thống thông báo Toast & Hộp thoại Xác nhận
│   │   ├── main.jsx                     # Khởi chạy React App và cấu hình Routing
│   │   └── lazyPages.jsx                # Code-splitting tăng tốc tải trang
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
├── docker-compose.yml                   # Khởi chạy toàn bộ stack với 1 lệnh
├── README.md                            # Tài liệu dự án chi tiết
└── DEPLOY.md                            # Hướng dẫn chi tiết triển khai máy chủ
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Chạy Cục Bộ (Local Development)

#### Yêu cầu môi trường:
- Python 3.11 trở lên
- Node.js 18 trở lên (khuyên dùng Node.js 20 LTS)
- Git

#### Bước 1: Khởi động Backend FastAPI
```bash
# Di chuyển vào thư mục backend
cd backend

# Tạo môi trường ảo Python
python -m venv venv

# Kích hoạt môi trường ảo:
# Trên Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Trên Linux / macOS:
source venv/bin/activate

# Cài đặt thư viện:
pip install -r requirements.txt

# Khởi chạy server FastAPI:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Docs tương tác Swagger: `http://127.0.0.1:8000/docs`
- Kiểm tra trạng thái hệ thống: `http://127.0.0.1:8000/api/health`

#### Bước 2: Khởi động Frontend React
Mở một cửa sổ dòng lệnh (Terminal) mới:
```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt các gói phụ thuộc
npm install

# Khởi động máy chủ phát triển Vite
npm run dev
```
- Giao diện web chạy tại: `http://localhost:5173`

---

### 2. Chạy bằng Docker Compose

Hệ thống hỗ trợ đóng gói đầy đủ gồm PostgreSQL, Redis, Backend FastAPI và Frontend Nginx:

```bash
# Khởi chạy toàn bộ hệ thống
docker compose up -d --build

# Xem log các dịch vụ
docker compose logs -f

# Dừng hệ thống
docker compose down
```
- Frontend Web: `http://localhost:80`
- Backend API: `http://localhost:8000`

---

### 3. Triển Khai Production (Vercel & Supabase)

Dự án đã được tối ưu hóa sẵn sàng cho kiến trúc Serverless trên Vercel:
1. **Cơ sở dữ liệu**: Tạo dự án PostgreSQL miễn phí trên [Supabase](https://supabase.com).
2. **Bộ nhớ đệm Redis**: Tạo database Redis miễn phí trên [Upstash](https://upstash.com).
3. **Triển khai Vercel**:
   - Đẩy mã nguồn lên kho lưu trữ GitHub.
   - Nhập dự án vào Vercel, cấu hình các biến môi trường tại phần **Project Settings $\rightarrow$ Environment Variables**.
   - Vercel tự động build và triển khai Frontend và Backend Serverless function.

---

## 📋 Danh Mục RESTful API

Hệ thống cung cấp hơn 40+ endpoints RESTful chuẩn mực:

| Nhóm API | Phương thức & Đường dẫn | Mô tả chức năng |
|:---|:---|:---|
| **Xác thực** | `POST /api/auth/login` | Đăng nhập tài khoản, cấp JWT token |
| | `POST /api/auth/register` | Đăng ký tài khoản học sinh / giáo viên |
| | `GET /api/auth/me` | Lấy thông tin tài khoản hiện tại |
| | `PUT /api/auth/profile` | Cập nhật hồ sơ cá nhân (Null-safe) |
| | `POST /api/auth/change-password` | Đổi mật khẩu tài khoản |
| **Ngân hàng câu hỏi** | `GET /api/questions` | Danh sách câu hỏi có phân trang và bộ lọc |
| | `POST /api/questions` | Thêm mới câu hỏi vào ngân hàng |
| | `GET /api/questions/tree/structure` | Lấy cây danh mục 5 tầng có cache |
| | `PUT /api/questions/{id}` | Cập nhật câu hỏi |
| | `DELETE /api/questions/{id}` | Xóa mềm câu hỏi |
| **Đề thi** | `GET /api/exams` | Lấy danh sách đề thi |
| | `POST /api/exams` | Tạo đề thi mới từ ma trận hoặc thủ công |
| | `GET /api/exams/{id}` | Chi tiết đề thi và danh sách câu hỏi |
| | `PUT /api/exams/{id}` | Cập nhật cấu hình đề thi |
| | `POST /api/exams/submissions/{id}/grade-ai` | **Chấm điểm tự luận bằng AI với nhận xét chi tiết** |
| **Học sinh & Phòng thi** | `GET /api/student/exams` | Danh sách bài thi và bài tập được giao |
| | `POST /api/student/exams/{id}/start` | Bắt đầu làm bài thi |
| | `POST /api/student/submissions/{id}/save` | Lưu tạm câu trả lời (Auto-save) |
| | `POST /api/student/submissions/{id}/submit` | Nộp bài thi và tự động chấm trắc nghiệm |
| | `GET /api/student/submissions/{id}` | Xem lại bài làm chi tiết kèm đáp án |
| **Lớp học & Hỏi đáp** | `GET /api/classrooms` | Danh sách lớp học đang tham gia / giảng dạy |
| | `POST /api/classrooms` | Giáo viên tạo lớp học mới |
| | `POST /api/classrooms/join` | Học sinh tham gia lớp bằng mã mời |
| | `GET /api/classrooms/{id}/posts` | **Kênh Hỏi đáp: Lấy danh sách bài thảo luận** |
| | `POST /api/classrooms/{id}/posts` | **Kênh Hỏi đáp: Đăng câu hỏi mới kèm KaTeX & ảnh** |
| | `POST /api/classrooms/{id}/posts/{post_id}/comments` | **Gửi câu trả lời / trao đổi trong lớp** |
| | `PUT /api/classrooms/{id}/posts/{post_id}/pin` | Ghim / gỡ ghim bài viết quan trọng |
| **Thời khóa biểu** | `GET /api/schedule/teacher` | Lấy lịch dạy của giáo viên |
| | `POST /api/schedule/events` | Tạo khối sự kiện thời khóa biểu mới |
| | `PUT /api/schedule/events/{id}` | Cập nhật thời lượng, vị trí kéo thả, màu sắc |
| | `DELETE /api/schedule/events/{id}` | Xóa sự kiện thời khóa biểu |
| | `GET /api/schedule/student` | Học sinh xem thời khóa biểu các lớp tham gia |
| **AI Trợ giảng** | `POST /api/ai/generate-from-text` | **AI Soạn đề từ văn bản hoặc bài giảng** |
| | `POST /api/ai/analyze-difficulty` | Phân tích độ khó câu hỏi (NB, TH, VD, VDC) |
| | `GET /api/student/practice/recommendations` | Gợi ý bài luyện tập thông minh theo điểm yếu |
| **Xuất file** | `GET /api/export/exam/{id}/docx` | **Xuất đề thi hoàn chỉnh ra file Word (.docx)** |
| | `GET /api/export/exam/{id}/pdf` | **Xuất đề thi hoàn chỉnh ra file PDF (.pdf)** |

---

## ⚙️ Cấu Hình Biến Môi Trường (.env)

Tạo file `.env` tại thư mục gốc hoặc thư mục `backend/`:

```ini
# --- BẢO MẬT & JWT ---
SECRET_KEY=your-super-secret-key-min-32-characters-long
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# --- CƠ SỞ DỮ LIỆU ---
# SQLite Cục bộ:
DATABASE_URL=sqlite+aiosqlite:///./quiz.db
# Hoặc PostgreSQL (Supabase / Production):
# DATABASE_URL=postgresql+asyncpg://postgres:password@host:5432/postgres

# --- BỘ NHỚ ĐỆM REDIS ---
REDIS_URL=redis://localhost:6379/0
# Hoặc Upstash Redis:
# REDIS_URL=rediss://default:token@host:6379

# --- CẤU HÌNH AI (TÙY CHỌN) ---
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...

# --- GIỚI HẠN TẢI LÊN ---
MAX_UPLOAD_SIZE=5242880
UPLOAD_DIR=./uploads
```

---

## 🔒 Bảo Mật & Tối Ưu Hiệu Năng

- **Xác thực 2 lớp (Cookie + Header)**: Hỗ trợ xác thực qua Authorization Bearer Header và HttpOnly Cookie.
- **Bảo vệ CSRF**: Tự động sinh và kiểm tra mã CSRF Token đối với tất cả các thao tác thay đổi dữ liệu (`POST`, `PUT`, `DELETE`).
- **Phòng chống Brute-Force**: Giới hạn tần suất gọi API (Rate Limiting) trên các endpoint nhạy cảm như Đăng nhập, Đăng ký, Nhập mã lớp.
- **Truy vấn Cực Nhanh**: Tích hợp sẵn 18+ Composite Indexes, loại bỏ N+1 query bằng `selectinload` và `joinedload`.
- **Nén GZip**: Tự động nén toàn bộ response có dung lượng lớn hơn 1KB, tiết kiệm 70-85% băng thông mạng.
- **Client Request Deduplication**: Tự động ghép các yêu cầu trùng lặp đang được thực thi trên Frontend, ngăn ngừa tình trạng gửi lặp request khi chuyển trang nhanh.

---

## 🧪 Kiểm Thử Tự Động (Automated Testing)

Chạy bộ kiểm thử tự động toàn diện:
```bash
cd backend
python -m pytest tests/ -v
```
Kết quả kiểm thử: **22/22 tests passed (100%)**.

---

## 📄 Bản Quyền & Giấy Phép

Phát triển bởi đội ngũ **TutorQuiz**. Được phân phối theo giấy phép mã nguồn mở MIT License. Mọi đóng góp, báo lỗi hoặc yêu cầu tính năng xin vui lòng mở Issue hoặc Pull Request trên kho lưu trữ GitHub!
