from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.database import Base

class AIConfig(Base):
    __tablename__ = "ai_configs"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), nullable=False) # OpenAI, DeepSeek, Anthropic, Gemini, Custom
    name = Column(String(100), nullable=False) # Tên hiển thị
    api_key = Column(String(255), nullable=False)
    base_url = Column(String(255), nullable=True) # Endpoint tùy chỉnh
    model_name = Column(String(100), default="gpt-4o-mini")
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
