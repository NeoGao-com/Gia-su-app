import os
import sys
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, redis_client, AsyncSessionLocal
from app.routers import rendering, auth, questions, exam, export, student, upload, classroom, analytics, uploads_protected, tasks, ai, notifications, ai_config, oauth, schedule

logger = logging.getLogger(__name__)

_DB_INITIALIZED = False

async def init_db_tables():
    global _DB_INITIALIZED
    if _DB_INITIALIZED:
        return {"status": "success", "message": "Already initialized"}

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        from sqlalchemy import text
        # 1. Batch add missing user columns in 1 single transaction (fast startup)
        batch_alter_pg = """
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(20),
            ADD COLUMN IF NOT EXISTS parent_name VARCHAR(100),
            ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(20),
            ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
            ADD COLUMN IF NOT EXISTS school VARCHAR(255),
            ADD COLUMN IF NOT EXISTS student_code VARCHAR(50),
            ADD COLUMN IF NOT EXISTS grade_level INTEGER,
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
            ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;
        """
        try:
            async with engine.begin() as conn:
                await conn.execute(text(batch_alter_pg))
        except Exception:
            # Fallback for SQLite which doesn't support multiple ADD COLUMN in one statement
            user_column_defs = [
                ("phone_number", "VARCHAR(20)"),
                ("parent_phone", "VARCHAR(20)"),
                ("parent_name", "VARCHAR(100)"),
                ("date_of_birth", "VARCHAR(20)"),
                ("gender", "VARCHAR(10)"),
                ("school", "VARCHAR(255)"),
                ("student_code", "VARCHAR(50)"),
                ("grade_level", "INTEGER"),
                ("notes", "TEXT"),
                ("is_deleted", "BOOLEAN DEFAULT 0"),
                ("reset_token", "VARCHAR(255)"),
                ("reset_token_expires", "TIMESTAMP")
            ]
            for col, col_type in user_column_defs:
                try:
                    async with engine.begin() as conn:
                        await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type}"))
                except Exception:
                    pass

        # 2. Batch add schedule_events and classroom discussion tables if not exists
        create_tables_sql = """
        CREATE TABLE IF NOT EXISTS schedule_events (
            id SERIAL PRIMARY KEY,
            teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            classroom_id INTEGER REFERENCES classrooms(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            day_of_week INTEGER NOT NULL,
            start_time VARCHAR(10) NOT NULL,
            end_time VARCHAR(10) NOT NULL,
            duration_minutes INTEGER DEFAULT 90 NOT NULL,
            color VARCHAR(30) DEFAULT '#4f46e5' NOT NULL,
            is_recurring BOOLEAN DEFAULT TRUE,
            specific_date VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS classroom_posts (
            id SERIAL PRIMARY KEY,
            classroom_id INTEGER NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            is_pinned BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS classroom_comments (
            id SERIAL PRIMARY KEY,
            post_id INTEGER NOT NULL REFERENCES classroom_posts(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            image_url TEXT,
            is_teacher_answer BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """
        try:
            async with engine.begin() as conn:
                await conn.execute(text(create_tables_sql))
        except Exception:
            pass

        # 3. Create high-performance composite indexes
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_questions_lookup ON questions (subject, grade_level, chapter, lesson, topic);",
            "CREATE INDEX IF NOT EXISTS idx_questions_creator ON questions (created_by_id, status);",
            "CREATE INDEX IF NOT EXISTS idx_classrooms_instructor ON classrooms (instructor_id, is_deleted);",
            "CREATE INDEX IF NOT EXISTS idx_assignments_classroom ON assignments (classroom_id, is_active);",
            "CREATE INDEX IF NOT EXISTS idx_assignments_exam_class ON assignments (exam_id, classroom_id, is_active);",
            "CREATE INDEX IF NOT EXISTS idx_exams_creator ON exams (created_by_id, exam_type);",
            "CREATE INDEX IF NOT EXISTS idx_exams_active_published ON exams (is_deleted, is_published, created_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_exam_submissions_user_exam ON exam_submissions (user_id, exam_id, status);",
            "CREATE INDEX IF NOT EXISTS idx_exam_submissions_exam_user ON exam_submissions (exam_id, user_id, submitted_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_classroom_students_lookup ON classroom_students (student_id, classroom_id, is_active);",
            "CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);",
            "CREATE INDEX IF NOT EXISTS idx_schedule_events_teacher ON schedule_events (teacher_id, day_of_week);",
            "CREATE INDEX IF NOT EXISTS idx_schedule_events_classroom ON schedule_events (classroom_id, day_of_week);",
            "CREATE INDEX IF NOT EXISTS idx_classroom_posts_classroom ON classroom_posts (classroom_id, created_at DESC);",
            "CREATE INDEX IF NOT EXISTS idx_classroom_posts_user ON classroom_posts (user_id);",
            "CREATE INDEX IF NOT EXISTS idx_classroom_comments_post ON classroom_comments (post_id, created_at ASC);",
            "CREATE INDEX IF NOT EXISTS idx_classroom_comments_user ON classroom_comments (user_id);"
        ]
        for idx_sql in indexes:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(idx_sql))
            except Exception:
                pass

        _DB_INITIALIZED = True

        # 3. Seed default accounts if needed
        from app.models.user import User
        from app.core.security import get_password_hash
        from sqlalchemy.future import select
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(User).limit(1))
            if not res.scalars().first():
                logger.info("Auto-seeding default accounts...")
                t = User(email="teacher@example.com", full_name="Giáo Viên", phone_number="0988 123 456", hashed_password=get_password_hash("Password@123!"), role="TEACHER")
                s = User(email="student@example.com", full_name="Học Sinh", phone_number="0912 345 678", hashed_password=get_password_hash("Password@123!"), role="STUDENT")
                session.add_all([t, s])
                await session.commit()
                logger.info("Default accounts created successfully!")

        return {"status": "success", "message": "Database initialized, indexed and seeded"}
    except Exception as e:
        logger.warning(f"Database table initialization warning: {e}")
        return {"status": "warning", "message": str(e)}

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db_tables()
    except Exception as e:
        logger.warning(f"Startup DB init non-fatal warning: {e}")
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
app.include_router(schedule.router)

@app.get("/", tags=["Hệ thống"])
async def read_root():
    return {"message": "Chào mừng đến với API Hệ Thống Quản Lý Thi Trắc Nghiệm"}

@app.get("/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống")
@app.get("/api/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống (prefix)")
async def health_check():
    status = {"status": "ok", "database": "unknown", "db_latency_ms": None, "redis": "unknown"}
    try:
        from sqlalchemy import text
        import time
        t0 = time.time()
        async def check_db():
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
        await asyncio.wait_for(check_db(), timeout=5.0)
        status["database"] = "connected"
        status["db_latency_ms"] = round((time.time() - t0) * 1000, 1)
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
