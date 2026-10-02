import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.ai_config import AIConfig
from app.models.user import User
from app.core.security import get_current_user
from app.services.ai_service import AIService, PROVIDER_DEFAULTS

router = APIRouter(prefix="/api/ai-configs", tags=["AI Configuration"])

AI_PRESETS = [
    {
        "id": "gemini",
        "provider": "Gemini",
        "name": "Google Gemini 2.0 Flash",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
        "model_name": "gemini-2.0-flash",
        "description": "Mô hình mới nhất của Google, siêu nhanh, miễn phí giới hạn cao, hỗ trợ công thức toán cực tốt.",
        "badge": "Khuyên dùng (Nhanh & Tốt)"
    },
    {
        "id": "openai",
        "provider": "OpenAI",
        "name": "OpenAI GPT-4o Mini",
        "base_url": "https://api.openai.com/v1",
        "model_name": "gpt-4o-mini",
        "description": "Chi phí rẻ, độ chính xác cao cho trắc nghiệm và sư phạm.",
        "badge": "Phổ biến"
    },
    {
        "id": "deepseek",
        "provider": "DeepSeek",
        "name": "DeepSeek V3",
        "base_url": "https://api.deepseek.com/v1",
        "model_name": "deepseek-chat",
        "description": "Mô hình toán học và suy luận cực kỳ mạnh mẽ với chi phí tối ưu.",
        "badge": "Toán học & Tiết kiệm"
    },
    {
        "id": "groq",
        "provider": "Groq",
        "name": "Groq (Llama 3.3 70B)",
        "base_url": "https://api.groq.com/openai/v1",
        "model_name": "llama-3.3-70b-versatile",
        "description": "Tốc độ phản hồi cực nhanh trên chip LPU của Groq.",
        "badge": "Siêu tốc độ"
    },
    {
        "id": "openrouter",
        "provider": "OpenRouter",
        "name": "OpenRouter (Claude 3.5 Sonnet)",
        "base_url": "https://openrouter.ai/api/v1",
        "model_name": "anthropic/claude-3.5-sonnet",
        "description": "Truy cập Claude 3.5 Sonnet, GPT-4o qua cổng OpenRouter.",
        "badge": "Đa mô hình"
    },
    {
        "id": "ollama",
        "provider": "Ollama",
        "name": "Ollama Local (Offline)",
        "base_url": "http://localhost:11434/v1",
        "model_name": "llama3",
        "description": "Chạy mô hình trực tiếp trên máy tính giáo viên không cần internet.",
        "badge": "Chạy cục bộ"
    }
]

class AIConfigCreate(BaseModel):
    provider: str
    name: str
    api_key: str
    base_url: Optional[str] = None
    model_name: str = "gpt-4o-mini"
    is_active: bool = False

class AIConfigUpdate(BaseModel):
    provider: Optional[str] = None
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None
    is_active: Optional[bool] = None

class TestCustomRequest(BaseModel):
    provider: str
    api_key: str
    base_url: Optional[str] = None
    model_name: str

@router.get("/presets")
async def get_presets(current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")
    return AI_PRESETS

@router.get("")
async def get_ai_configs(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền truy cập")
    result = await db.execute(select(AIConfig).order_by(AIConfig.created_at.desc()))
    configs = result.scalars().all()
    return [
        {
            "id": c.id,
            "provider": c.provider,
            "name": c.name,
            "api_key": c.api_key,
            "api_key_masked": c.api_key[:6] + "••••••••" + (c.api_key[-4:] if len(c.api_key) > 10 else ""),
            "base_url": c.base_url,
            "model_name": c.model_name,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat() if c.created_at else None
        }
        for c in configs
    ]

@router.post("")
async def create_ai_config(payload: AIConfigCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thao tác")

    # Điền base_url mặc định nếu để trống
    base_url = payload.base_url
    if not base_url and payload.provider in PROVIDER_DEFAULTS:
        base_url = PROVIDER_DEFAULTS[payload.provider]["base_url"]

    if payload.is_active:
        existing = await db.execute(select(AIConfig))
        for cfg in existing.scalars().all():
            cfg.is_active = False

    new_config = AIConfig(
        provider=payload.provider,
        name=payload.name,
        api_key=payload.api_key,
        base_url=base_url,
        model_name=payload.model_name,
        is_active=payload.is_active
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    return {"success": True, "id": new_config.id, "message": "Đã thêm AI Provider thành công"}

@router.put("/{config_id}")
async def update_ai_config(config_id: int, payload: AIConfigUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thao tác")

    result = await db.execute(select(AIConfig).filter(AIConfig.id == config_id))
    cfg = result.scalars().first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình")

    if payload.is_active:
        existing = await db.execute(select(AIConfig))
        for other in existing.scalars().all():
            other.is_active = (other.id == config_id)

    if payload.provider is not None:
        cfg.provider = payload.provider
    if payload.name is not None:
        cfg.name = payload.name
    if payload.api_key is not None and payload.api_key.strip():
        cfg.api_key = payload.api_key
    if payload.base_url is not None:
        cfg.base_url = payload.base_url
    if payload.model_name is not None:
        cfg.model_name = payload.model_name
    if payload.is_active is not None:
        cfg.is_active = payload.is_active

    await db.commit()
    await db.refresh(cfg)
    return {"success": True, "message": "Đã cập nhật cấu hình AI thành công"}

@router.post("/{config_id}/activate")
async def activate_ai_config(config_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thao tác")

    existing = await db.execute(select(AIConfig))
    found = False
    for cfg in existing.scalars().all():
        if cfg.id == config_id:
            cfg.is_active = True
            found = True
        else:
            cfg.is_active = False

    if not found:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình")

    await db.commit()
    return {"success": True, "message": "Đã kích hoạt AI Provider"}

@router.post("/{config_id}/test")
async def test_existing_ai_config(config_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thao tác")
    result = await db.execute(select(AIConfig).filter(AIConfig.id == config_id))
    cfg = result.scalars().first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình")
    try:
        service = AIService({
            "api_key": cfg.api_key,
            "base_url": cfg.base_url,
            "model_name": cfg.model_name,
            "provider": cfg.provider
        })
        start_time = time.time()
        res = service.generate_questions("Toán học cơ bản về đạo hàm bậc 1", num_questions=1)
        latency = round((time.time() - start_time) * 1000)
        return {
            "success": True,
            "message": f"Kết nối AI thành công! Độ trễ phản hồi: {latency}ms",
            "latency_ms": latency,
            "sample": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Kết nối thất bại: {str(e)}")

@router.post("/test-custom")
async def test_custom_ai_config(payload: TestCustomRequest, current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thao tác")
    try:
        service = AIService({
            "api_key": payload.api_key,
            "base_url": payload.base_url,
            "model_name": payload.model_name,
            "provider": payload.provider
        })
        start_time = time.time()
        res = service.generate_questions("Toán học cơ bản về phương trình bậc 2", num_questions=1)
        latency = round((time.time() - start_time) * 1000)
        return {
            "success": True,
            "message": f"Kiểm tra thành công! Độ trễ phản hồi: {latency}ms",
            "latency_ms": latency,
            "sample": res
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Kiểm tra kết nối thất bại: {str(e)}")

@router.delete("/{config_id}")
async def delete_ai_config(config_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Không có quyền thao tác")

    result = await db.execute(select(AIConfig).filter(AIConfig.id == config_id))
    cfg = result.scalars().first()
    if not cfg:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình")
    await db.delete(cfg)
    await db.commit()
    return {"success": True, "message": "Đã xóa cấu hình thành công"}
