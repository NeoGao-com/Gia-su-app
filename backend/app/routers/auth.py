import logging
import secrets
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db, redis_client
from app.models.user import User
from app.schemas.auth import UserCreate, UserResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.core.security import get_password_hash, verify_password, create_access_token, get_current_user
from app.core.config import settings
from app.core.csrf import generate_csrf_token, CSRF_COOKIE_NAME
from app.core.rate_limiter import parse_rate_limit
from app.core.email import send_reset_password_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=UserResponse, dependencies=[Depends(parse_rate_limit(settings.REGISTER_RATE_LIMIT))], summary="Đăng ký tài khoản học sinh")
async def register(request: Request, user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalars().first():
        logger.warning(f"Registration failed: Email already registered - {user_in.email} from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký trong hệ thống")

    assigned_role = "TEACHER" if (user_in.role or "").upper() in ["TEACHER", "GIÁO VIÊN"] else "STUDENT"
    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=assigned_role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"New user registered: {user.email} (role: {user.role}) from IP {client_ip}")
    return user

@router.api_route("/login", methods=["POST", "OPTIONS"], summary="Đăng nhập vào hệ thống")
async def login(request: Request, response: Response, payload: dict = Body(None), db: AsyncSession = Depends(get_db)):
    if request.method == "OPTIONS":
        return Response(status_code=200)

    email = payload.get("email")
    password = payload.get("password")
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        logger.warning(f"Login failed: Incorrect email or password for {email} from IP {client_ip}")
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không chính xác")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản của bạn đã bị vô hiệu hóa")

    access_token = create_access_token(data={"sub": user.email})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        path="/"
    )
    # Set CSRF token cookie on login (non-HttpOnly for JS access)
    csrf_token = generate_csrf_token()
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        samesite="lax",
        path="/"
    )
    logger.info(f"User logged in successfully: {user.email} (role: {user.role}) from IP {client_ip}")
    return {
        "message": "Đăng nhập thành công",
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump()
    }

@router.post("/logout", summary="Đăng xuất khỏi hệ thống")
async def logout(request: Request, response: Response):
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            jti: str = payload.get("jti")
            exp: int = payload.get("exp")
            if jti and exp:
                now_ts = int(datetime.now(timezone.utc).timestamp())
                ttl = exp - now_ts
                if ttl > 0:
                    try:
                        await redis_client.set(f"blacklist:{jti}", "1", ex=ttl)
                    except Exception as e:
                        logger.error(f"Redis blacklist store error: {str(e)}")
        except JWTError:
            pass
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key=CSRF_COOKIE_NAME, path="/")
    return {"message": "Đăng xuất thành công"}

@router.get("/me", response_model=UserResponse, summary="Lấy thông tin tài khoản hiện tại")
async def me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/forgot-password", dependencies=[Depends(parse_rate_limit(settings.REGISTER_RATE_LIMIT))])
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.email == payload.email))
    user = result.scalars().first()

    # Always return a generic success message to prevent user enumeration
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token = token
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES)
        await db.commit()

        await send_reset_password_email(user.email, token)
        logger.info(f"Password reset requested for email: {user.email} from IP {client_ip}")
    else:
        logger.warning(f"Password reset requested for non-existent email: {payload.email} from IP {client_ip}")

    return {"message": "Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi."}

@router.post("/reset-password", dependencies=[Depends(parse_rate_limit(settings.REGISTER_RATE_LIMIT))])
async def reset_password(request: Request, payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.reset_token == payload.token))
    user = result.scalars().first()

    if not user or not user.reset_token_expires:
        logger.warning(f"Password reset failed: Invalid or expired token from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Token không hợp lệ hoặc đã hết hạn")

    # Check expiration
    expires = user.reset_token_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) > expires:
        logger.warning(f"Password reset failed: Token expired for user ID {user.id} from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Token đã hết hạn")

    user.hashed_password = get_password_hash(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()
    logger.info(f"Password successfully reset for user ID {user.id} ({user.email}) from IP {client_ip}")

    return {"message": "Đặt lại mật khẩu thành công"}
