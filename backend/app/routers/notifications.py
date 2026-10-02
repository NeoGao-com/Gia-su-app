from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.core.security import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("")
async def get_notifications(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    notifs = result.scalars().all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "is_read": n.is_read,
            "type": n.type,
            "created_at": n.created_at
        }
        for n in notifs
    ]

@router.post("/{notification_id}/read")
async def mark_notification_as_read(notification_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Notification).filter(Notification.id == notification_id, Notification.user_id == current_user.id))
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo")
    notif.is_read = True
    await db.commit()
    return {"success": True}
