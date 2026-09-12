from fastapi import APIRouter, HTTPException
from app.services.tasks import task_manager

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/{task_id}")
async def get_task_status(task_id: str):
    task = await task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "task_id": task_id,
        "status": task["status"],
        "result": task["result"],
        "error": task["error"]
    }
