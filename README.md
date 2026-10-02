# TutorQuiz - Nền Tảng Quản Lý Gia Sư & Luyện Thi Trắc Nghiệm Trực Tuyến

Ứng dụng web toàn diện dành cho **Giáo viên / Gia sư** và **Học sinh**, hỗ trợ quản lý ngân hàng câu hỏi, tạo đề thi ma trận, giao bài tập theo lớp học và tổ chức thi trực tuyến thông minh. Tích hợp công thức Toán học KaTeX/LaTeX, trích xuất đề thi bằng AI thông qua Master Prompt, và chấm điểm tự động.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

| Thành phần | Công nghệ | Mô tả |
|:---|:---|:---|
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2 | RESTful API hiệu năng cao, bất đồng bộ hoàn toàn |
| **Frontend** | React 19, Vite 8, Tailwind CSS, Lucide React | Giao diện hiện đại, tối ưu UX, responsive đa thiết bị |
| **Database** | SQLite (Dev) / PostgreSQL (Production) | Lưu trữ người dùng, ngân hàng câu hỏi, đề thi, lớp học |
| **Cache & Limiter** | Redis | Bộ nhớ đệm và bảo vệ API với Rate Limiting |
| **Toán học & LaTeX** | KaTeX, MathRenderer | Hiển thị công thức Toán học trực quan thời gian thực |
| **AI Integration** | OpenAI / Gemini API + Master Prompt Generator | Hỗ trợ bóc tách tài liệu và sinh câu hỏi trắc nghiệm |
| **Xử lý tài liệu** | python-docx | Hỗ trợ nhập và xuất đề thi định dạng Word |
| **Bảo mật** | JWT (HS256), Password Hashing (bcrypt), CSRF Protection | Xác thực phân quyền chặt chẽ giữa Giáo viên & Học sinh |
| **DevOps** | Docker, Docker Compose, Nginx | Đóng gói container sẵn sàng triển khai |

---

## 👥 Tài Khoản Trải Nghiệm Mặc Định

Hệ thống được thiết kế với hai vai trò chính: **Giáo viên (Teacher)** và **Học sinh (Student)**:

| Vai trò | Email | Mật khẩu mặc định | Mục đích sử dụng |
|:---|:---|:---|:---|
| **Giáo viên / Gia sư** | `teacher@example.com` | `Password@123!` | Quản lý câu hỏi, tạo đề, tạo lớp học, giao bài, chấm thi, xem thống kê |
| **Học sinh** | `student@example.com` | `Password@123!` | Tham gia lớp học, làm bài tập về nhà, thi trực tuyến, xem lời giải & sổ điểm |

---

## 🌟 Tính Năng Nổi Bật

### 1. Dành cho Giáo viên & Gia sư
- **Ngân hàng câu hỏi phân cấp**: Quản lý câu hỏi theo Cây thư mục (Môn học $\rightarrow$ Khối lớp $\rightarrow$ Chương $\rightarrow$ Bài $\rightarrow$ Chủ đề).
- **Đa dạng dạng câu hỏi**: Trắc nghiệm 1 đáp án, nhiều đáp án, Đúng/Sai, Điền khuyết, Ghép nối (Matching), Tự luận (Essay).
- **Soạn thảo công thức Toán học (LaTeX)**: Trình soạn thảo trực quan hỗ trợ KaTeX rendering tức thì.
- **AI Master Prompt & Nhập JSON hàng loạt**:
  - Tự động sinh Prompt chuẩn hóa cho AI dựa trên Môn học và Khối lớp trong ngân hàng.
  - Người dùng chỉ cần gửi tài liệu/PDF/ảnh cho AI cùng Prompt, sau đó dán JSON kết quả để nhập hàng chục câu hỏi vào cơ sở dữ liệu trong vài giây.
- **Quản lý Đề thi & Ma trận câu hỏi**: Tạo đề thi nhanh, cấu hình thời gian làm bài, số lần làm tối đa, điểm đạt, trộn thứ tự câu hỏi và đáp án.
- **Quản lý Lớp học & Giao bài**:
  - Tạo lớp học với mã lớp ngẫu nhiên, sinh mã mới chống gian lận.
  - Giao bài tập về nhà và bài thi theo từng lớp với thời hạn cụ thể.
- **Sổ điểm & Chấm bài**: Tự động chấm trắc nghiệm ngay khi nộp bài, giao diện chấm tự luận kèm nhận xét.
- **Báo cáo & Phổ điểm**: Biểu đồ phân tích phổ điểm, tỷ lệ hoàn thành và chất lượng học sinh.

### 2. Dành cho Học sinh (Giao diện UI/UX mới)
- **Bàn học sinh (Dashboard)**: Thống kê tổng quan số bài cần làm, kỳ thi sắp diễn ra, điểm trung bình và biểu đồ tiến độ học tập.
- **Bài tập về nhà (`/student/assignments`)**: Danh sách bài tập được giáo viên giao, hạn chót nộp bài, trạng thái đã làm / chưa làm.
- **Kỳ thi trực tuyến (`/student/exams`)**: Danh sách các kỳ thi chính thức theo lớp học hoặc toàn hệ thống.
- **Phòng thi chuẩn hóa (`/student/exam/:id/take`)**:
  - Đồng hồ đếm ngược thời gian thực.
  - Tự động lưu tiến độ làm bài (Auto-save) phòng ngừa mất kết nối mạng.
  - Thanh điều hướng danh sách câu hỏi: trạng thái đã làm, chưa làm, câu hỏi đánh dấu xem lại.
  - Hiển thị công thức Toán học, hình ảnh đính kèm rõ ràng, chống click nhầm khi nộp bài.
- **Sổ điểm & Lịch sử bài nộp (`/student/history`)**: Xem lại chi tiết từng lượt làm, điểm số đạt được, xem lại đáp án đúng kèm lời giải thích chi tiết của giáo viên.
- **Lớp học của tôi (`/student/classrooms`)**: Danh sách các lớp đang tham gia, tham gia lớp mới nhanh bằng mã mời của giáo viên.

---

## 📁 Cấu Trúc Dự Án

```
quiz-app-main/
├── backend/                          # Backend FastAPI (Python)
│   ├── app/
│   │   ├── core/                    # Cấu hình config, bảo mật JWT, email, rate limiter
│   │   ├── models/                  # SQLAlchemy models (User, Question, Exam, Classroom...)
│   │   ├── routers/                 # API endpoints (auth, questions, exam, student, classroom...)
│   │   ├── schemas/                 # Pydantic schemas xác thực dữ liệu request/response
│   │   ├── services/                # Logic AI, chấm điểm, xuất nhập Word/JSON
│   │   ├── database.py              # Kết nối Database (SQLite/PostgreSQL) & Redis
│   │   └── main.py                  # Điểm khởi chạy FastAPI
│   ├── tests/                       # Unit tests & Integration tests
│   ├── seed_all.py                  # Script khởi tạo tài khoản giáo viên & học sinh mẫu
│   ├── requirements.txt             # Danh sách thư viện Python
│   └── Dockerfile                   # Dockerfile Backend
├── frontend/                        # Frontend React + Vite
│   ├── src/
│   │   ├── api/axios.js             # Cấu hình Axios client & Interceptors
│   │   ├── components/              # Sidebar, Navbar, MathRenderer, Modals, Pagination...
│   │   ├── pages/
│   │   │   ├── auth/                # Đăng nhập, Đăng ký, Quên mật khẩu
│   │   │   ├── student/             # Bàn học sinh, Bài tập, Kỳ thi, Phòng thi, Sổ điểm, Lớp học
│   │   │   └── teacher/             # Ngân hàng câu hỏi, Quản lý đề thi, Giao bài, Sổ điểm, Phân tích
│   │   ├── App.jsx, main.jsx        # Routing và khởi chạy React App
│   │   └── lazyPages.jsx            # Cấu hình Code-Splitting tăng tốc độ tải trang
│   ├── package.json
│   ├── Dockerfile                   # Dockerfile Frontend (Nginx serve)
│   └── nginx.conf                   # Cấu hình Nginx reverse proxy cho production
├── docker-compose.yml               # File chạy đồng thời Postgres, Redis, Backend, Frontend
├── .env.example                     # Mẫu biến môi trường
└── DEPLOY.md                        # Hướng dẫn triển khai chi tiết
```

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Khởi chạy môi trường phát triển (Local Development)

#### Bước 1: Khởi động Backend
```bash
cd backend
python -m venv venv

# Kích hoạt môi trường ảo:
# Trên Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Trên Linux/macOS:
source venv/bin/activate

# Cài đặt thư viện:
pip install -r requirements.txt

# Tạo file cấu hình môi trường:
cp .env.example .env

# Chạy server FastAPI:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- API Docs Swagger: `http://127.0.0.1:8000/docs`
- Khởi tạo dữ liệu mẫu (tuỳ chọn): `python seed_all.py`

#### Bước 2: Khởi động Frontend
Mở một cửa sổ dòng lệnh khác:
```bash
cd frontend
npm install
npm run dev
```
- Giao diện ứng dụng chạy tại: `http://localhost:5173`

---

### 2. Triển khai bằng Docker Compose (Production)

Toàn bộ dịch vụ (PostgreSQL, Redis, Backend FastAPI, Frontend Nginx) đã được cấu hình trong `docker-compose.yml`.

```bash
# 1. Tạo file .env từ file mẫu
cp .env.example .env

# 2. Mở file .env và thay đổi các mật khẩu bảo mật:
#    SECRET_KEY, POSTGRES_PASSWORD, REDIS_PASSWORD

# 3. Khởi chạy toàn bộ stack:
docker compose up -d --build

# 4. Kiểm tra trạng thái các container:
docker compose ps
curl http://localhost/health
```

#### Các cổng dịch vụ mặc định:
- **Frontend Web**: `http://localhost:80`
- **Backend API**: `http://localhost:8000` (hoặc thông qua reverse proxy `http://localhost/api/`)
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 🧪 Kiểm Thử (Testing)

Dự án bao gồm bộ kiểm thử tự động cho backend:
```bash
cd backend
pytest tests/ -v
```

---

## 🔒 Lưu Ý Về Bảo Mật & Triển Khai
- **Tuyệt đối không commit file `.env` hoặc file cơ sở dữ liệu (`quiz.db`, `*.db`)** lên GitHub.
- Trước khi đưa lên môi trường Internet / Production, hãy tạo `SECRET_KEY` ngẫu nhiên có độ dài tối thiểu 32 ký tự để đảm bảo an toàn cho chữ ký JWT.
- Cấu hình CORS và các giới hạn tải lên (Max Upload Size: 5MB) có thể điều chỉnh linh hoạt trong `.env`.
