# Thiết kế hệ thống Backend EdTech (MVP)

## 1. Phạm vi dự án (MVP Scope)
- **Module 1: Auth & User Management**: Xác thực JWT, phân quyền RBAC (`ADMIN`, `TUTOR`, `STUDENT`), quản lý thông tin hồ sơ người dùng.
- **Module 2: Class & Schedule Management**: Quản lý lớp học, đăng ký lớp, xếp lịch và theo dõi trạng thái buổi học.
- *Loại bỏ*: Quản lý Thanh toán & Giao dịch (được hoãn sang giai đoạn sau).

## 2. Kiến trúc thư mục (Clean Architecture)
```text
src/
├── common/             # Filters, Guards, Interceptors, Pipes toàn cục
├── config/             # Cấu hình môi trường
├── infrastructure/     # PrismaService, Database setup
└── modules/
    ├── auth/           # Xác thực & Phân quyền
    ├── users/          # Quản lý người dùng & profile
    └── classes/        # Quản lý lớp học & lịch học
```

## 3. Prisma Schema (MVP)
- `User`: id, email, password, role (`ADMIN`, `TUTOR`, `STUDENT`), created_at, updated_at
- `UserProfile`: id, user_id, full_name, phone, address, bio
- `Class`: id, title, description, subject, price, tutor_id, status (`PENDING`, `ACTIVE`, `COMPLETED`), created_at
- `LessonSchedule`: id, class_id, student_id, start_time, end_time, status (`SCHEDULED`, `COMPLETED`, `CANCELED`)

## 4. API Endpoints cốt lõi
- `GET /api/v1/health` - Health check server & Database connection
- `POST /api/v1/auth/register` - Đăng ký tài khoản
- `POST /api/v1/auth/login` - Đăng nhập nhận JWT
- `GET /api/v1/classes` - Danh sách lớp học
- `POST /api/v1/classes` - Tạo lớp học (dành cho Tutor)
