import secrets
import hmac
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "x-csrf-token"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/register",
    "/api/admin/users",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/static"
}

def generate_csrf_token() -> str:
    """Generate a secure cryptographically random CSRF token."""
    return secrets.token_hex(32)

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path
        is_exempt = any(path.startswith(exempt) for exempt in EXEMPT_PATHS)

        if request.method in SAFE_METHODS or is_exempt:
            response: Response = await call_next(request)
            if not request.cookies.get(CSRF_COOKIE_NAME):
                new_token = generate_csrf_token()
                response.set_cookie(
                    key=CSRF_COOKIE_NAME,
                    value=new_token,
                    httponly=False,
                    samesite="lax",
                    path="/"
                )
            return response

        # Check Authorization Bearer header: if request is authenticated with JWT Bearer header, CSRF can be bypassed/auto-generated
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            response: Response = await call_next(request)
            return response

        cookie_csrf = request.cookies.get(CSRF_COOKIE_NAME)
        header_csrf = request.headers.get(CSRF_HEADER_NAME)

        if not cookie_csrf or not header_csrf:
            return Response(
                content='{"detail":"Thiếu mã xác thực CSRF trong cookie hoặc header"}',
                status_code=status.HTTP_403_FORBIDDEN,
                media_type="application/json"
            )

        if not hmac.compare_digest(cookie_csrf, header_csrf):
            return Response(
                content='{"detail":"Mã xác thực CSRF không hợp lệ"}',
                status_code=status.HTTP_403_FORBIDDEN,
                media_type="application/json"
            )

        response: Response = await call_next(request)
        return response
