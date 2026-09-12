import os
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from app.core.security import get_current_teacher
from app.core.rate_limiter import parse_rate_limit
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["upload"])

@router.post("/image", dependencies=[Depends(parse_rate_limit(settings.UPLOAD_RATE_LIMIT))], summary="Tải lên ảnh câu hỏi")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_teacher)
):
    client_ip = request.client.host if request.client else "unknown"
    # Read file content for size and magic bytes inspection
    contents = await file.read()

    # Check file size
    if len(contents) > settings.MAX_UPLOAD_SIZE:
        logger.warning(f"Image upload failed: File too large by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=413, detail="Tệp tin quá lớn (Tối đa 5MB)")

    # Verify true MIME type via magic bytes (python-magic or manual check for common image formats)
    # Common formats: PNG, JPEG, GIF, WEBP
    allowed_signatures = {
        b'\x89PNG\r\n\x1a\n': 'image/png',
        b'\xff\xd8\xff': 'image/jpeg',
        b'GIF87a': 'image/gif',
        b'GIF89a': 'image/gif',
        b'RIFF': 'image/webp', # WebP starts with RIFF....WEBP
    }

    is_valid_image = False
    for sig, mime in allowed_signatures.items():
        if sig == b'RIFF':
            if contents.startswith(b'RIFF') and contents[8:12] == b'WEBP':
                is_valid_image = True
                break
        elif contents.startswith(sig):
            is_valid_image = True
            break

    if not is_valid_image:
        logger.warning(f"Image upload failed: Invalid format by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Invalid image file format or MIME type")

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Create a unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
        ext = '.png'
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    # Write file
    try:
        with open(filepath, "wb") as f:
            f.write(contents)
    except Exception as e:
        logger.error(f"Image upload failed: Save error by {current_user.email} from IP {client_ip}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    logger.info(f"Image uploaded: {filename} by {current_user.email} from IP {client_ip}")
    # Return the URL (authenticated endpoint)
    return {"url": f"/api/uploads/{filename}"}
