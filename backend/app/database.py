from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings
import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)

import os
import re

import urllib.parse
from sqlalchemy.pool import NullPool

def clean_database_url(url: str) -> str:
    if not url:
        return "sqlite+aiosqlite:///./quiz.db"
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif os.getenv("VERCEL") and "sqlite" in url and ("./quiz.db" in url or "quiz.db" in url):
        return "sqlite+aiosqlite:////tmp/quiz.db"

    if "postgresql" in url:
        u = urllib.parse.urlsplit(url)
        params = urllib.parse.parse_qs(u.query)
        clean_params = {"ssl": "require"}
        new_query = urllib.parse.urlencode(clean_params)
        return urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, new_query, u.fragment))
    return url

db_url = clean_database_url(settings.DATABASE_URL)

engine_kwargs = {"echo": False}
if "postgresql" in db_url:
    engine_kwargs["connect_args"] = {
        "statement_cache_size": 0,
        "command_timeout": 30
    }
    if os.getenv("VERCEL"):
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_pre_ping"] = True
else:
    engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(db_url, **engine_kwargs)
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

class DummyRedis:
    async def get(self, *args, **kwargs): return None
    async def set(self, *args, **kwargs): return True
    async def delete(self, *args, **kwargs): return True
    async def incr(self, *args, **kwargs): return 1
    async def keys(self, *args, **kwargs): return []
    async def ping(self, *args, **kwargs): return False

if os.getenv("VERCEL") and ("localhost" in settings.REDIS_URL or "127.0.0.1" in settings.REDIS_URL or not settings.REDIS_URL):
    redis_client = DummyRedis()
else:
    redis_client = SafeRedis(settings.REDIS_URL)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def get_redis():
    return redis_client
