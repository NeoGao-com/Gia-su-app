import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserResponse, UserCreate, UserUpdate
from app.core.security import get_current_user, get_password_hash
from app.core.rate_limiter import parse_rate_limit
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

async def get_admin(request: Request, current_user: User = Depends(get_current_user)):
    if current_user.role not in ("ADMIN", "TEACHER"):
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(f"Unauthorized admin access attempt by {current_user.email} from IP {client_ip}")
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập chức năng quản trị")
    return current_user

@router.get("/users", response_model=dict, dependencies=[Depends(parse_rate_limit(settings.ADMIN_RATE_LIMIT))], summary="Danh sách người dùng (Quản trị)")
async def get_users(
    request: Request,
    role: Optional[str] = None,
    grade_level: Optional[int] = None,
    classroom_id: Optional[int] = None,
    search: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin)
):
    client_ip = request.client.host if request.client else "unknown"
    offset = (page - 1) * limit
    query = select(User).filter(User.is_deleted == False)
    if role:
        query = query.filter(User.role == role)
    if grade_level:
        query = query.filter(User.grade_level == grade_level)
    if classroom_id:
        from app.models.classroom import ClassroomStudent
        query = query.join(ClassroomStudent, ClassroomStudent.student_id == User.id).filter(ClassroomStudent.classroom_id == classroom_id)
    if search:
        query = query.filter(User.full_name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    users = result.scalars().all()
    users_response = [UserResponse.model_validate(u).model_dump(mode="json") for u in users]
    logger.info(f"Admin listed users by {current_admin.email} from IP {client_ip}")

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit if limit > 0 else 0,
        "items": users_response
    }

@router.post("/users", response_model=UserResponse, dependencies=[Depends(parse_rate_limit(settings.ADMIN_RATE_LIMIT))], summary="Tạo người dùng mới (Quản trị)")
async def create_user(
    request: Request,
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.email == user_in.email))
    if result.scalars().first():
        logger.warning(f"Admin creation failed: Email {user_in.email} already registered by {current_admin.email} from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role or "STUDENT",
        grade_level=user_in.grade_level
    )
    db.add(user)
    await db.flush()

    if getattr(user_in, 'classroom_id', None):
        from app.models.classroom import Classroom
        classroom = await db.get(Classroom, user_in.classroom_id)
        if classroom:
            classroom.students.append(user)

    await db.commit()
    await db.refresh(user)
    logger.info(f"Admin created user: {user.email} by {current_admin.email} from IP {client_ip}")
    return user


@router.put("/users/{user_id}", response_model=UserResponse, dependencies=[Depends(parse_rate_limit(settings.ADMIN_RATE_LIMIT))], summary="Cập nhật thông tin người dùng")
async def update_user(
    request: Request,
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        logger.warning(f"Admin update failed: User {user_id} not found by {current_admin.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.email and user_in.email != user.email:
        existing_user = await db.execute(select(User).filter(User.email == user_in.email))
        if existing_user.scalars().first():
            logger.warning(f"Admin update failed: Email {user_in.email} taken by {current_admin.email} from IP {client_ip}")
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = user_in.email
    if user_in.full_name:
        user.full_name = user_in.full_name
    if user_in.password:
        user.hashed_password = get_password_hash(user_in.password)
    if user_in.role:
        user.role = user_in.role
    if user_in.grade_level:
        user.grade_level = user_in.grade_level

    await db.commit()
    await db.refresh(user)
    logger.info(f"Admin updated user: {user.id} by {current_admin.email} from IP {client_ip}")
    return user

@router.put("/users/{user_id}/reset-password", dependencies=[Depends(parse_rate_limit(settings.ADMIN_RATE_LIMIT))], summary="Đặt lại mật khẩu người dùng mặc định")
async def reset_password(
    request: Request,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin)
):
    client_ip = request.client.host if request.client else "unknown"
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        logger.warning(f"Admin reset failed: User {user_id} not found by {current_admin.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash("Password@123!")
    await db.commit()
    logger.info(f"Admin reset password for user: {user.id} by {current_admin.email} from IP {client_ip}")
    return {"message": "Password reset to Password@123!"}

@router.delete("/users/{user_id}", dependencies=[Depends(parse_rate_limit(settings.ADMIN_RATE_LIMIT))], summary="Xóa người dùng (Vô hiệu hóa)")
async def delete_user(
    request: Request,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_admin)
):
    client_ip = request.client.host if request.client else "unknown"
    if user_id == current_admin.id:
        logger.warning(f"Admin delete failed: Self-deletion attempt by {current_admin.email} from IP {client_ip}")
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if not user:
        logger.warning(f"Admin delete failed: User {user_id} not found by {current_admin.email} from IP {client_ip}")
        raise HTTPException(status_code=404, detail="User not found")

    user.is_deleted = True
    await db.commit()
    logger.info(f"Admin soft-deleted user: {user_id} by {current_admin.email} from IP {client_ip}")
    return {"message": "User deleted successfully"}