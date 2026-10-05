import os
import json
import secrets
import logging
import urllib.request
import urllib.parse
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserResponse
from app.core.security import get_password_hash, create_access_token
from app.core.config import settings
from app.core.csrf import generate_csrf_token, CSRF_COOKIE_NAME

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth/oauth", tags=["OAuth"])

class GoogleCredentialRequest(BaseModel):
    credential: str

class OAuthSyncRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    provider: Optional[str] = "oauth"
    avatar_url: Optional[str] = None

def get_base_frontend_url(request: Request) -> str:
    # Prefer explicit frontend URL from settings if configured
    if settings.FRONTEND_URL and not "localhost" in settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip("/")
    # Dynamic header lookup
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    proto = request.headers.get("x-forwarded-proto", "https" if not "localhost" in (host or "") else "http")
    if host:
        return f"{proto}://{host}".rstrip("/")
    return settings.FRONTEND_URL.rstrip("/")

async def get_or_create_oauth_user(db: AsyncSession, email: str, full_name: Optional[str], default_role: str = "STUDENT") -> User:
    result = await db.execute(select(User).filter(User.email == email))
    user = result.scalars().first()
    if not user:
        logger.info(f"Creating new user from OAuth: {email}")
        user = User(
            email=email,
            full_name=full_name or email.split("@")[0],
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            role=default_role,
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user

@router.get("/config")
async def get_oauth_config(request: Request):
    frontend_url = get_base_frontend_url(request)
    return {
        "google_configured": bool(settings.GOOGLE_CLIENT_ID),
        "zalo_configured": bool(settings.ZALO_APP_ID),
        "google_client_id": settings.GOOGLE_CLIENT_ID,
        "zalo_app_id": settings.ZALO_APP_ID,
        "supabase_url": settings.SUPABASE_URL,
        "google_callback_url": f"{frontend_url}/api/auth/oauth/google/callback",
        "zalo_callback_url": f"{frontend_url}/api/auth/oauth/zalo/callback",
        "frontend_url": frontend_url
    }

@router.get("/google")
async def login_google(request: Request):
    frontend_url = get_base_frontend_url(request)
    if not settings.GOOGLE_CLIENT_ID:
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=google_not_configured")

    callback_url = f"{frontend_url}/api/auth/oauth/google/callback"
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": callback_url,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "prompt": "select_account"
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=url)

@router.get("/google/callback")
async def google_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    frontend_url = get_base_frontend_url(request)
    if error or not code:
        logger.warning(f"Google OAuth error received: {error}")
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=google_cancelled")

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=google_not_configured")

    callback_url = f"{frontend_url}/api/auth/oauth/google/callback"
    try:
        token_data = urllib.parse.urlencode({
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": callback_url,
            "grant_type": "authorization_code"
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://oauth2.googleapis.com/token",
            data=token_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_json = json.loads(resp.read().decode())

        access_token_google = token_json.get("access_token")
        # Fetch user info
        user_req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token_google}"}
        )
        with urllib.request.urlopen(user_req, timeout=10) as resp:
            user_info = json.loads(resp.read().decode())

        email = user_info.get("email")
        if not email:
            return RedirectResponse(url=f"{frontend_url}/login?oauth_error=no_email")

        name = user_info.get("name") or user_info.get("given_name") or email.split("@")[0]
        user = await get_or_create_oauth_user(db, email=email, full_name=name)

        token = create_access_token(data={"sub": user.email})
        target_url = f"{frontend_url}/oauth-callback?token={token}&role={user.role.lower()}"
        response = RedirectResponse(url=target_url)
        response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax", path="/")
        response.set_cookie(key=CSRF_COOKIE_NAME, value=generate_csrf_token(), httponly=False, samesite="lax", path="/")
        return response
    except Exception as e:
        logger.error(f"Google OAuth callback error: {str(e)}")
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=google_failed")

@router.post("/google/credential")
async def google_credential_login(payload: GoogleCredentialRequest, response: Response, db: AsyncSession = Depends(get_db)):
    try:
        url = f"https://oauth2.googleapis.com/tokeninfo?id_token={payload.credential}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            info = json.loads(resp.read().decode())

        email = info.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Không tìm thấy email từ tài khoản Google")

        name = info.get("name") or email.split("@")[0]
        user = await get_or_create_oauth_user(db, email=email, full_name=name)

        access_token = create_access_token(data={"sub": user.email})
        response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", path="/")
        csrf_token = generate_csrf_token()
        response.set_cookie(key=CSRF_COOKIE_NAME, value=csrf_token, httponly=False, samesite="lax", path="/")

        return {
            "message": "Đăng nhập Google thành công",
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.model_validate(user).model_dump()
        }
    except Exception as e:
        logger.error(f"Google ID token verification failed: {e}")
        raise HTTPException(status_code=400, detail="Xác thực Google ID Token thất bại")

@router.get("/zalo")
async def login_zalo(request: Request):
    frontend_url = get_base_frontend_url(request)
    if not settings.ZALO_APP_ID:
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=zalo_not_configured")

    callback_url = f"{frontend_url}/api/auth/oauth/zalo/callback"
    params = {
        "app_id": settings.ZALO_APP_ID,
        "redirect_uri": callback_url,
        "state": "zalo_auth_login"
    }
    url = "https://oauth.zaloapp.com/v4/permission?" + urllib.parse.urlencode(params)
    return RedirectResponse(url=url)

@router.get("/zalo/callback")
async def zalo_callback(request: Request, code: Optional[str] = None, error: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    frontend_url = get_base_frontend_url(request)
    if error or not code:
        logger.warning(f"Zalo OAuth error received: {error}")
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=zalo_cancelled")

    if not settings.ZALO_APP_ID or not settings.ZALO_APP_SECRET:
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=zalo_not_configured")

    callback_url = f"{frontend_url}/api/auth/oauth/zalo/callback"
    try:
        token_data = urllib.parse.urlencode({
            "code": code,
            "app_id": settings.ZALO_APP_ID,
            "grant_type": "authorization_code"
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://oauth.zaloapp.com/v4/access_token",
            data=token_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "secret_key": settings.ZALO_APP_SECRET
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_json = json.loads(resp.read().decode())

        zalo_access_token = token_json.get("access_token")
        if not zalo_access_token:
            logger.error(f"Zalo exchange code error: {token_json}")
            return RedirectResponse(url=f"{frontend_url}/login?oauth_error=zalo_failed")

        # Fetch Zalo user profile
        user_req = urllib.request.Request(
            "https://graph.zalo.me/v2.0/me?fields=id,name,picture",
            headers={"access_token": zalo_access_token}
        )
        with urllib.request.urlopen(user_req, timeout=10) as resp:
            zalo_user = json.loads(resp.read().decode())

        zalo_id = zalo_user.get("id")
        zalo_name = zalo_user.get("name") or "Người dùng Zalo"
        if not zalo_id:
            return RedirectResponse(url=f"{frontend_url}/login?oauth_error=zalo_no_id")

        # Unique synthetic email for Zalo account
        email = f"zalo_{zalo_id}@zalo.me"
        user = await get_or_create_oauth_user(db, email=email, full_name=zalo_name)

        token = create_access_token(data={"sub": user.email})
        target_url = f"{frontend_url}/oauth-callback?token={token}&role={user.role.lower()}"
        response = RedirectResponse(url=target_url)
        response.set_cookie(key="access_token", value=token, httponly=True, samesite="lax", path="/")
        response.set_cookie(key=CSRF_COOKIE_NAME, value=generate_csrf_token(), httponly=False, samesite="lax", path="/")
        return response
    except Exception as e:
        logger.error(f"Zalo OAuth callback error: {str(e)}")
        return RedirectResponse(url=f"{frontend_url}/login?oauth_error=zalo_failed")

@router.post("/sync-user")
async def sync_oauth_user(payload: OAuthSyncRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Sync an authenticated user from client-side OAuth (e.g. Supabase Auth) into the local user database"""
    if not payload.email:
        raise HTTPException(status_code=400, detail="Thiếu địa chỉ email")

    user = await get_or_create_oauth_user(db, email=payload.email, full_name=payload.full_name)

    access_token = create_access_token(data={"sub": user.email})
    response.set_cookie(key="access_token", value=access_token, httponly=True, samesite="lax", path="/")
    csrf_token = generate_csrf_token()
    response.set_cookie(key=CSRF_COOKIE_NAME, value=csrf_token, httponly=False, samesite="lax", path="/")

    return {
        "message": f"Đăng nhập thành công qua {payload.provider}",
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).model_dump()
    }
