from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from app.services.rendering_service import CodeRenderer
from app.core.security import get_current_teacher
from app.models.user import User

router = APIRouter(prefix="/api/render", tags=["rendering"])

class RenderRequest(BaseModel):
    code: str
    type: str = "python"

@router.post("/code", summary="Biên dịch code Python Matplotlib sang hình ảnh")
async def render_code(
    request: Request,
    data: RenderRequest,
    current_user: User = Depends(get_current_teacher)
):
    if not data.code or not data.code.strip():
        raise HTTPException(status_code=400, detail="Nội dung mã code không được để trống")

    try:
        if data.type == "python":
            url = await CodeRenderer.render_python_matplotlib(data.code)
            return {"url": url}
        else:
            raise HTTPException(status_code=400, detail="Loại code chưa được hỗ trợ")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
