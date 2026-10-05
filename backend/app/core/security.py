import asyncio
import logging
import json
import bcrypt
import uuid
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.core.config import settings
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db, redis_client
from app.models.user import User

logger = logging.getLogger(__name__)

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "jti": uuid.uuid4().hex
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    import time
    t_start = time.time()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập. Vui lòng đăng nhập lại.",
    )
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        jti: str = payload.get("jti")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Check if token (jti) is in Redis blacklist
    if jti:
        try:
            is_blacklisted = await asyncio.wait_for(redis_client.get(f"blacklist:{jti}"), timeout=0.05)
            if is_blacklisted:
                raise credentials_exception
        except HTTPException:
            raise
        except Exception as e:
            # If Redis is temporarily unreachable, log and allow or fail gracefully
            logger.error(f"Redis blacklist check error: {str(e)}")

    # Check if user is cached
    cache_key = f"auth:user:{email}"
    try:
        cached_str = await redis_client.get(cache_key)
        if cached_str:
            data = json.loads(cached_str)
            user = User(
                id=data["id"],
                email=data["email"],
                full_name=data.get("full_name"),
                role=data["role"],
                is_active=data.get("is_active", True)
            )
            return user
    except Exception:
        pass

    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception

    try:
        u_data = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active
        }
        await redis_client.set(cache_key, json.dumps(u_data), ex=60)
    except Exception:
        pass

    return user

async def get_current_teacher(current_user: User = Depends(get_current_user)):
    if current_user.role != "TEACHER":
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập chức năng này (yêu cầu quyền Giáo viên)")
    return current_user