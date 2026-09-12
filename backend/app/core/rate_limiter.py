import time
import asyncio
import logging
from fastapi import Request, HTTPException, status
from jose import jwt, JWTError
from app.database import redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, times: int, seconds: int, key_prefix: str = "ratelimit"):
        self.times = times
        self.seconds = seconds
        self.key_prefix = key_prefix

    async def __call__(self, request: Request):
        identifier = None

        if hasattr(request.state, "user") and request.state.user:
            user = request.state.user
            identifier = f"user:{getattr(user, 'id', user)}"
        else:
            token = request.cookies.get("access_token")
            if not token:
                auth_header = request.headers.get("Authorization")
                if auth_header and auth_header.startswith("Bearer "):
                    token = auth_header.split(" ", 1)[1].strip()

            if token:
                try:
                    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                    user_id = payload.get("sub") or payload.get("user_id") or payload.get("jti")
                    if user_id:
                        identifier = f"user:{user_id}"
                except JWTError:
                    logger.debug("RateLimiter: invalid JWT, falling back to IP identifier")

        if not identifier:
            identifier = f"ip:{request.client.host if request.client else 'unknown'}"

        path = request.url.path
        key = f"{self.key_prefix}:{path}:{identifier}"

        try:
            # Wrap redis call with asyncio.wait_for to fail instantly (0.05s) if Redis is down
            current = await asyncio.wait_for(redis_client.get(key), timeout=0.05)
            if current is None:
                await asyncio.wait_for(redis_client.set(key, 1, ex=self.seconds), timeout=0.05)
            else:
                current_count = int(current)
                if current_count >= self.times:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng thử lại sau ít phút."
                    )
                await asyncio.wait_for(redis_client.incr(key), timeout=0.05)
        except HTTPException:
            raise
        except Exception:
            # Fallback instantly if Redis is unreachable without slowing down the request
            logger.debug("RateLimiter: Redis unavailable, skipping rate limit for %s", path)
            return

def parse_rate_limit(limit_str: str):
    times, duration = limit_str.split('/')
    seconds = 0
    if "minutes" in duration:
        seconds = int(duration.replace("minutes", "")) * 60
    elif "seconds" in duration:
        seconds = int(duration.replace("seconds", ""))
    return RateLimiter(times=int(times), seconds=seconds)
