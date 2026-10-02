import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

def resolve_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    for var in ["POSTGRES_URL_NON_POOLING", "POSTGRES_URL", "POSTGRES_PRISMA_URL", "SUPABASE_DB_URL"]:
        val = os.getenv(var)
        if val:
            return val
    host = os.getenv("POSTGRES_HOST")
    user = os.getenv("POSTGRES_USER")
    pwd = os.getenv("POSTGRES_PASSWORD")
    db = os.getenv("POSTGRES_DATABASE", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    if host and user and pwd:
        return f"postgresql://{user}:{pwd}@{host}:{port}/{db}?sslmode=require"
    return "sqlite+aiosqlite:///./quiz.db"

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    DATABASE_URL: str = resolve_database_url()
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey_change_in_production_32bytes")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/tmp/uploads" if os.getenv("VERCEL") else "static/uploads")
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Supabase Integration
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    SUPABASE_KEY: Optional[str] = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY")
    )
    SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "quiz-uploads")

    # Rate Limits
    REGISTER_RATE_LIMIT: str = "5/5minutes"
    JOIN_CLASS_RATE_LIMIT: str = "10/5minutes"
    UPLOAD_RATE_LIMIT: str = "20/5minutes"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5 MB
    IMPORT_RATE_LIMIT: str = "10/5minutes"

    # SMTP / Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@quizapp.com")
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = os.getenv("LOG_DIR", "/tmp/logs" if os.getenv("VERCEL") else "logs")

settings = Settings()
