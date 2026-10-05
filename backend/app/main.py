import os
import sys
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, redis_client, AsyncSessionLocal
from app.routers import rendering, auth, questions, exam, export, student, upload, classroom, analytics, uploads_protected, tasks, ai, notifications, ai_config, oauth

logger = logging.getLogger(__name__)

async def init_db_tables():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from app.models.user import User
        from app.core.security import get_password_hash
        from sqlalchemy.future import select
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(User).limit(1))
            if not res.scalars().first():
                logger.info("Auto-seeding default accounts...")
                t = User(email="teacher@example.com", full_name="Giáo Viên", hashed_password=get_password_hash("Password@123!"), role="TEACHER")
                s = User(email="student@example.com", full_name="Học Sinh", hashed_password=get_password_hash("Password@123!"), role="STUDENT")
                session.add_all([t, s])
                await session.commit()
                logger.info("Default accounts created successfully!")
        # Create performance optimization indexes
        from sqlalchemy import text
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_questions_lookup ON questions (subject, grade_level, chapter, lesson, topic)",
            "CREATE INDEX IF NOT EXISTS idx_questions_creator ON questions (created_by_id, status)",
            "CREATE INDEX IF NOT EXISTS idx_classrooms_instructor ON classrooms (instructor_id, is_deleted)",
            "CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON assignments (classroom_id, is_active)",
            "CREATE INDEX IF NOT EXISTS idx_exams_creator ON exams (created_by_id, exam_type)",
            "CREATE INDEX IF NOT EXISTS idx_submissions_exam ON exam_submissions (exam_id, student_id)",
        ]
        async with engine.begin() as conn:
            for idx_sql in indexes:
                try:
                    await conn.execute(text(idx_sql))
                except Exception:
                    pass

        return {"status": "success", "message": "Database initialized, indexed and seeded"}
    except Exception as e:
        logger.warning(f"Database table initialization warning: {e}")
        return {"status": "warning", "message": str(e)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-blocking async init only on non-serverless environments
    if not os.getenv("VERCEL"):
        asyncio.create_task(init_db_tables())
    yield

app = FastAPI(
    title="Hệ Thống Quản Lý Thi Trắc Nghiệm API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

from starlette.middleware.gzip import GZipMiddleware

# GZip Compression Middleware (Compress payloads > 1KB by 70-85%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|.*\.vercel\.app)(:\d+)?",
)

# Include Routers (All routers already include /api prefix internally)
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
app.include_router(ai.router)
app.include_router(notifications.router)
app.include_router(ai_config.router)
app.include_router(oauth.router)

@app.get("/", tags=["Hệ thống"])
async def read_root():
    return {"message": "Chào mừng đến với API Hệ Thống Quản Lý Thi Trắc Nghiệm"}

@app.get("/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống")
@app.get("/api/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống (prefix)")
async def health_check():
    status = {"status": "ok", "database": "unknown", "redis": "unknown"}
    try:
        from sqlalchemy import text
        async def check_db():
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        await asyncio.wait_for(check_db(), timeout=8.0)
        status["database"] = "connected"
    except Exception as e:
        status["database"] = f"error: {str(e)}"

    try:
        if redis_client:
            is_ok = await redis_client.ping()
            status["redis"] = "connected" if is_ok else "disabled"
        else:
            status["redis"] = "disabled"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"
    
    return status

@app.get("/api/init-db", tags=["Hệ thống"], summary="Khởi tạo bảng cơ sở dữ liệu Supabase/PostgreSQL")
@app.post("/api/init-db", tags=["Hệ thống"], summary="Khởi tạo bảng cơ sở dữ liệu Supabase/PostgreSQL")
async def trigger_init_db():
    result = await init_db_tables()
    return result

# Explicit handler alias
handler = app
