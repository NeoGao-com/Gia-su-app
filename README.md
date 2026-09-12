# Quiz App - Hệ Thống Quản Lý & Tổ Chức Thi Trắc Nghiệm Trực Tuyến

Ứng dụng web quản lý ngân hàng câu hỏi, tạo đề thi và tổ chức thi trắc nghiệm trực tuyến hỗ trợ công thức Toán học KaTeX/LaTeX, bóc tách đề thi từ Word (.docx), vẽ hình minh họa bằng Python (Matplotlib), và nhập hàng loạt bằng JSON chuẩn cấu trúc thi THPT Quốc Gia.

---

## 🛠 Công Nghệ Sử Dụng (Tech Stack)

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2, SQLite / PostgreSQL, Redis.
- **Frontend**: React 19, Vite, Tailwind CSS, KaTeX, Recharts, Axios, React Router v7.
- **DevOps**: Docker & Docker Compose.

---

## 🚀 Hướng Dẫn Khởi Chạy (Quick Start)

### 1. Khởi chạy Backend (FastAPI)
```bash
cd backend
python -m venv venv
# Trên Windows:
.\venv\Scripts\Activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Khởi chạy Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. Khởi chạy bằng Docker Compose (Production / All-in-One)
```bash
docker compose up -d --build
```

---

## 👥 Tài Khoản Mặc Định (Default Test Accounts)

| Vai trò | Email | Mật khẩu |
| :--- | :--- | :--- |
| **Admin** | `admin.test@quizapp.com` | `Password@123!` |
| **Giáo viên (Teacher)** | `teacher.test@quizapp.com` | `Password@123!` |
| **Học sinh (Student)** | `student.test@quizapp.com` | `Password@123!` |

---

## 🌟 Tính Năng Nổi Bật

1. **Quản lý Ngân hàng Câu hỏi Đa dạng**: Hỗ trợ 5 loại câu hỏi chuẩn THPT Quốc Gia (Trắc nghiệm, Đúng/Sai, Điền khuyết, Trả lời ngắn, Tự luận).
2. **Live LaTeX Preview**: Soạn thảo công thức Toán học trực quan với KaTeX.
3. **Vẽ hình bằng Python (Matplotlib)**: Cho phép giáo viên viết mã Python trực tiếp để sinh đồ thị/hình minh họa hình học.
4. **Nhập Hàng Loạt Bằng JSON**: Hỗ trợ nhập danh sách câu hỏi qua JSON kèm mẫu chuẩn cho AI.
5. **Quản lý Lớp học & Đề thi**: Giao bài tập, thi trực tuyến, tự động chấm điểm và thống kê phổ điểm.
