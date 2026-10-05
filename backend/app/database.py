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

import fnmatch

class InMemoryCache:
    """High-performance in-memory cache with TTL support for serverless/local environments."""
    def __init__(self, max_items=3000):
        self._store = {}
        self._expires = {}
        self._max_items = max_items

    def _prune(self):
        now = time.time()
        expired = [k for k, exp in self._expires.items() if exp and exp < now]
        for k in expired:
            self._store.pop(k, None)
            self._expires.pop(k, None)
        if len(self._store) > self._max_items:
            excess = len(self._store) - self._max_items
            old_keys = list(self._store.keys())[:excess]
            for k in old_keys:
                self._store.pop(k, None)
                self._expires.pop(k, None)

    async def get(self, key: str, *args, **kwargs):
        now = time.time()
        exp = self._expires.get(key)
        if exp and exp < now:
            self._store.pop(key, None)
            self._expires.pop(key, None)
            return None
        val = self._store.get(key)
        return str(val) if val is not None else None

    async def set(self, key: str, value, ex=None, expire=None, px=None, **kwargs):
        self._prune()
        ttl = ex if ex is not None else expire
        if px is not None:
            ttl = px / 1000.0
        now = time.time()
        self._store[key] = str(value) if not isinstance(value, (str, int, float)) else value
        if ttl:
            self._expires[key] = now + float(ttl)
        else:
            self._expires.pop(key, None)
        return True

    async def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self._store:
                self._store.pop(k, None)
                self._expires.pop(k, None)
                count += 1
        return count

    async def incr(self, key: str, amount: int = 1):
        self._prune()
        now = time.time()
        exp = self._expires.get(key)
        if exp and exp < now:
            self._store.pop(key, None)
            self._expires.pop(key, None)
        val = int(self._store.get(key, 0)) + amount
        self._store[key] = val
        return val

    async def keys(self, pattern: str = "*"):
        now = time.time()
        res = []
        for k, exp in list(self._expires.items()):
            if exp and exp < now:
                self._store.pop(k, None)
                self._expires.pop(k, None)
                continue
            if fnmatch.fnmatch(k, pattern):
                res.append(k)
        for k in list(self._store.keys()):
            if k not in res and fnmatch.fnmatch(k, pattern):
                res.append(k)
        return res

    async def ping(self, *args, **kwargs):
        return True

if os.getenv("VERCEL") and ("localhost" in settings.REDIS_URL or "127.0.0.1" in settings.REDIS_URL or not settings.REDIS_URL):
    redis_client = InMemoryCache()
else:
    redis_client = SafeRedis(settings.REDIS_URL)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def get_redis():
    return redis_client
