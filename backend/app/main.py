from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base, redis_client
from app.routers import rendering, auth, questions, exam, export, student, upload, classroom, analytics, uploads_protected, tasks, ai, notifications, ai_config
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hệ Thống Quản Lý Thi Trắc Nghiệm API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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
        async with engine.begin() as conn:
            await conn.run_sync(lambda c: None)
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
