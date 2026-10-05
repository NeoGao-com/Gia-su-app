import os
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse, RedirectResponse
from app.core.config import settings
from app.services.storage import StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

@router.get("/{filename}", summary="Lấy tệp tải lên")
async def get_uploaded_file(
    request: Request,
    filename: str
):
    client_ip = request.client.host if request.client else "unknown"
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Tên tệp tin không hợp lệ")

    filepath = os.path.join(settings.UPLOAD_DIR, filename)
    if os.path.exists(filepath) and os.path.isfile(filepath):
        return FileResponse(filepath)

    # Fallback to Supabase Storage if configured
    public_url = StorageService.get_public_url(filename)
    if public_url:
        return RedirectResponse(url=public_url, status_code=307)

    raise HTTPException(status_code=404, detail="Không tìm thấy tệp tin")
