import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./quiz.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecretkey_change_in_production_32bytes")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    UPLOAD_DIR: str = "static/uploads"
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Rate Limits
    REGISTER_RATE_LIMIT: str = "5/5minutes"
    JOIN_CLASS_RATE_LIMIT: str = "10/5minutes"
    UPLOAD_RATE_LIMIT: str = "20/5minutes"
    MAX_UPLOAD_SIZE: int = 5 * 1024 * 1024  # 5 MB
    IMPORT_RATE_LIMIT: str = "10/5minutes"
    ADMIN_RATE_LIMIT: str = "50/5minutes"

    # SMTP / Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME: Optional[str] = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD: Optional[str] = os.getenv("SMTP_PASSWORD")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "noreply@quizapp.com")
    RESET_TOKEN_EXPIRE_MINUTES: int = 30
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_DIR: str = "logs"

    class Config:
        env_file = ".env"

settings = Settings()
