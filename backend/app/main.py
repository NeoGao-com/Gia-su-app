import os
import logging

logger = logging.getLogger(__name__)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base

# Import models in dependency order so SQLAlchemy relationship resolution works correctly
import app.models.user          # noqa: F401 - user has no FK deps
import app.models.question      # noqa: F401
import app.models.classroom     # noqa: F401 - defines classroom_exams table
import app.models.exam          # noqa: F401 - depends on user, question, classroom_exams

from app.routers import rendering, auth, questions, exam, export, student, upload, classroom, analytics, uploads_protected, tasks
from app.core.csrf import CSRFMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure static directory exists
    os.makedirs("static/uploads", exist_ok=True)
    # Skip table creation during tests if TESTING is True (assuming tests handle their own DB)
    if os.getenv("TESTING") != "True":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Ensure admin user exists
        from app.database import AsyncSessionLocal
        from sqlalchemy.future import select
        from app.models.user import User
        from app.core.security import get_password_hash

        async with AsyncSessionLocal() as session:
            admin_user_result = await session.execute(select(User).filter(User.email == "admin@gmail.com"))
            admin_user = admin_user_result.scalars().first()

            if not admin_user:
                logger.info("Creating admin user: admin@gmail.com")
                admin_password = os.getenv("ADMIN_PASSWORD", "adminpassword")
                new_admin = User(
                    email="admin@gmail.com",
                    full_name="Admin User",
                    hashed_password=get_password_hash(admin_password),
                    role="ADMIN",
                    is_active=True
                )
                session.add(new_admin)
                await session.commit()
            else:
                logger.info("Admin user admin@gmail.com already exists.")

            # Seed test accounts (Admin, Teacher & Student)
            test_accounts = [
                {"email": "admin@example.com", "full_name": "Admin Test", "role": "ADMIN", "password": "Password@123!"},
                {"email": "teacher@example.com", "full_name": "Teacher Test", "role": "TEACHER", "password": "Password@123!"},
                {"email": "student@example.com", "full_name": "Student Test", "role": "STUDENT", "password": "Password@123!"}
            ]
            for acc in test_accounts:
                res = await session.execute(select(User).filter(User.email == acc["email"]))
                existing = res.scalars().first()
                if not existing:
                    logger.info(f"Creating test account: {acc['email']} ({acc['role']})")
                    new_user = User(
                        email=acc["email"],
                        full_name=acc["full_name"],
                        hashed_password=get_password_hash(acc["password"]),
                        role=acc["role"],
                        is_active=True
                    )
                    session.add(new_user)
                    await session.commit()
    yield
    await engine.dispose()


from app.core.logging_config import setup_logging
from app.core.logging_middleware import RequestLoggingMiddleware

# Setup Logging
setup_logging()

# OpenAPI Tags Metadata (Việt hóa)
tags_metadata = [
    {
        "name": "auth",
        "description": "Xác thực & Quản lý tài khoản người dùng (Đăng nhập, Đăng ký, Đổi mật khẩu)",
    },
    {
        "name": "questions",
        "description": "Quản lý ngân hàng câu hỏi, chủ đề, môn học và mức độ khó",
    },
    {
        "name": "exam",
        "description": "Quản lý bài thi, đề kiểm tra, cài đặt thời gian và chấm điểm",
    },
    {
        "name": "student",
        "description": "Cổng dành cho học sinh: Tham gia làm bài, nộp bài, xem kết quả",
    },
    {
        "name": "classroom",
        "description": "Quản lý lớp học, mã tham gia và danh sách học sinh",
    },
    {
        "name": "analytics",
        "description": "Thống kê, phân tích kết quả thi, phổ điểm và báo cáo",
    },
    {
        "name": "export",
        "description": "Xuất đề thi và câu hỏi ra định dạng Word (.docx) / PDF",
    },
    {
        "name": "upload",
        "description": "Tải lên tệp tin và bóc tách câu hỏi tự động từ file Word",
    },
    {
        "name": "uploads-protected",
        "description": "Truy cập tệp tin tải lên có xác thực bảo mật",
    },
    {
        "name": "tasks",
        "description": "Kiểm tra tiến độ tác vụ nền",
    },
    {
        "name": "admin",
        "description": "Quản trị hệ thống, quản lý người dùng và cấu hình",
    },
]

app = FastAPI(
    title="Hệ Thống Quản Lý Thi Trắc Nghiệm API",
    description="API Backend cho hệ thống thi trắc nghiệm & quản lý đề thi trực tuyến hỗ trợ công thức Toán LaTeX và bóc tách Word.",
    version="1.0.0",
    openapi_tags=tags_metadata,
    redirect_slashes=False,
    lifespan=lifespan,
)

# Request Logging Middleware
app.add_middleware(RequestLoggingMiddleware)

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Exception Handlers (Việt hóa thông báo lỗi)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    import json
    errors = []
    for error in exc.errors():
        safe_error = {}
        for k, v in error.items():
            try:
                json.dumps(v)
                safe_error[k] = v
            except (TypeError, ValueError):
                safe_error[k] = str(v)
        errors.append(safe_error)
    return JSONResponse(
        status_code=422,
        content={"detail": "Dữ liệu yêu cầu không hợp lệ", "errors": errors},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    # Log the exception for debugging
    import logging
    logging.error(f"Lỗi hệ thống chưa được xử lý: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi máy chủ nội bộ. Vui lòng thử lại sau."},
    )

# Static files removed/restricted to prevent public exposure of uploads. Use authenticated /api/uploads/ endpoint.
os.makedirs("static/uploads", exist_ok=True)
# app.mount("/static", StaticFiles(directory="static"), name="static")

# CSRF Protection Middleware
app.add_middleware(CSRFMiddleware)

# CORS configuration (added last so it runs FIRST in outer layer)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex="http://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
)

# Include Routers
app.include_router(rendering.router)
app.include_router(auth.router)
app.include_router(questions.router)
app.include_router(exam.router)
app.include_router(export.router)
app.include_router(student.router)
app.include_router(classroom.router)
app.include_router(analytics.router)
app.include_router(upload.router)
app.include_router(uploads_protected.router)
app.include_router(tasks.router)

@app.get("/", tags=["Hệ thống"])
async def read_root():
    return {"message": "Chào mừng đến với API Hệ Thống Quản Lý Thi Trắc Nghiệm"}

@app.get("/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống")
async def health_check():
    """Health check cho monitoring/deploy: kiểm tra DB và Redis."""
    status = {"status": "ok", "database": "unknown", "redis": "unknown"}
    code = 200
    try:
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: None)
        status["database"] = "up"
    except Exception:
        status["database"] = "down"
        status["status"] = "degraded"
        code = 503
    try:
        await redis_client.ping()
        status["redis"] = "up"
    except Exception:
        status["redis"] = "down"
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=code, content=status)