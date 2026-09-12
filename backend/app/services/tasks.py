import json
import uuid
from typing import Dict, Any, Optional
from app.database import get_redis

DEFAULT_TTL = 86400  # 24 hours in seconds

class TaskManager:
    async def create_task(self) -> str:
        task_id = str(uuid.uuid4())
        data = {
            "status": "pending",
            "result": None,
            "error": None
        }
        redis = await get_redis()
        await redis.setex(f"task:{task_id}", DEFAULT_TTL, json.dumps(data))
        return task_id

    async def set_running(self, task_id: str):
        redis = await get_redis()
        raw = await redis.get(f"task:{task_id}")
        if raw:
            data = json.loads(raw)
            data["status"] = "processing"
            await redis.setex(f"task:{task_id}", DEFAULT_TTL, json.dumps(data))

    async def set_completed(self, task_id: str, result: Any):
        redis = await get_redis()
        raw = await redis.get(f"task:{task_id}")
        if raw:
            data = json.loads(raw)
            data["status"] = "completed"
            data["result"] = result
            await redis.setex(f"task:{task_id}", DEFAULT_TTL, json.dumps(data))

    async def set_failed(self, task_id: str, error: str):
        redis = await get_redis()
        raw = await redis.get(f"task:{task_id}")
        if raw:
            data = json.loads(raw)
            data["status"] = "failed"
            data["error"] = error
            await redis.setex(f"task:{task_id}", DEFAULT_TTL, json.dumps(data))

    async def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        redis = await get_redis()
        raw = await redis.get(f"task:{task_id}")
        if raw:
            return json.loads(raw)
        return None

task_manager = TaskManager()
