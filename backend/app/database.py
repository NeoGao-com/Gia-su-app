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

class SafeRedis:
    def __init__(self, url):
        self.client = redis.from_url(url, decode_responses=True, socket_connect_timeout=0.05, socket_timeout=0.05)
        self._available = None

    async def _check(self):
        try:
            await self.client.ping()
            return True
        except Exception:
            return False

    async def get(self, *args, **kwargs):
        try:
            return await self.client.get(*args, **kwargs)
        except Exception:
            return None

    async def set(self, *args, **kwargs):
        try:
            return await self.client.set(*args, **kwargs)
        except Exception:
            return None

    async def delete(self, *args, **kwargs):
        try:
            return await self.client.delete(*args, **kwargs)
        except Exception:
            return None

    async def incr(self, *args, **kwargs):
        try:
            return await self.client.incr(*args, **kwargs)
        except Exception:
            return None

    async def keys(self, *args, **kwargs):
        try:
            return await self.client.keys(*args, **kwargs)
        except Exception:
            return []

    async def ping(self, *args, **kwargs):
        return await self.client.ping(*args, **kwargs)

redis_client = SafeRedis(settings.REDIS_URL)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def get_redis():
    return redis_client
