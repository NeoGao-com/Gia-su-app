from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, redis_client
from app.routers import rendering, auth, questions, exam, export, student, upload, classroom, analytics, uploads_protected, tasks, ai, notifications, ai_config
from contextlib import asynccontextmanager
import logging

import asyncio
from app.database import engine, Base, redis_client, AsyncSessionLocal

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async def init_db():
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

        await asyncio.wait_for(init_db(), timeout=3.5)
    except Exception as e:
        logger.warning(f"Database table initialization warning (non-fatal): {e}")
    yield

app = FastAPI(
    title="Hệ Thống Quản Lý Thi Trắc Nghiệm API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

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

@app.get("/", tags=["Hệ thống"])
async def read_root():
    return {"message": "Chào mừng đến với API Hệ Thống Quản Lý Thi Trắc Nghiệm"}

@app.get("/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống")
@app.get("/api/health", tags=["Hệ thống"], summary="Kiểm tra trạng thái hệ thống (prefix)")
async def health_check():
    status = {"status": "ok", "database": "unknown", "redis": "unknown"}
    code = 200
    try:
        async def check_db():
            async with engine.begin() as conn:
                await conn.run_sync(lambda c: None)
        await asyncio.wait_for(check_db(), timeout=2.0)
        status["database"] = "connected"
    except Exception as e:
        status["database"] = f"error: {str(e)}"
        code = 503

    try:
        if redis_client:
            await redis_client.ping()
            status["redis"] = "connected"
        else:
            status["redis"] = "disabled"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"
    
    return status
