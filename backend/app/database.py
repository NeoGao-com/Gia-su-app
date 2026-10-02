from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings
import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)
Base = declarative_base()

import time

class SafeRedis:
    def __init__(self, url):
        self.client = redis.from_url(url, decode_responses=True, socket_connect_timeout=0.05, socket_timeout=0.05)
        self._disabled_until = 0.0

    def _is_disabled(self):
        return time.time() < self._disabled_until

    def _record_failure(self):
        self._disabled_until = time.time() + 30.0

    def _record_success(self):
        self._disabled_until = 0.0

    async def get(self, *args, **kwargs):
        if self._is_disabled():
            return None
        try:
            res = await self.client.get(*args, **kwargs)
            self._record_success()
            return res
        except Exception:
            self._record_failure()
            return None

    async def set(self, *args, **kwargs):
        if self._is_disabled():
            return None
        try:
            res = await self.client.set(*args, **kwargs)
            self._record_success()
            return res
        except Exception:
            self._record_failure()
            return None

    async def delete(self, *args, **kwargs):
        if self._is_disabled():
            return None
        try:
            res = await self.client.delete(*args, **kwargs)
            self._record_success()
            return res
        except Exception:
            self._record_failure()
            return None

    async def incr(self, *args, **kwargs):
        if self._is_disabled():
            return None
        try:
            res = await self.client.incr(*args, **kwargs)
            self._record_success()
            return res
        except Exception:
            self._record_failure()
            return None

    async def keys(self, *args, **kwargs):
        if self._is_disabled():
            return []
        try:
            res = await self.client.keys(*args, **kwargs)
            self._record_success()
            return res
        except Exception:
            self._record_failure()
            return []

    async def ping(self, *args, **kwargs):
        if self._is_disabled():
            return False
        try:
            res = await self.client.ping(*args, **kwargs)
            self._record_success()
            return res
        except Exception:
            self._record_failure()
            return False

redis_client = SafeRedis(settings.REDIS_URL)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def get_redis():
    return redis_client
