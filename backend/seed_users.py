import asyncio
import sys
import os

# Add the current directory to sys.path to find the app module
sys.path.append(os.path.abspath(os.getcwd()))

from app.database import engine, Base, get_db
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

async def create_users():
    async with engine.begin() as conn:
        # Tables should exist but let's be sure
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as db:
        # Check if admin exists
        result = await db.execute(select(User).filter(User.email == "admin@example.com"))
        admin = result.scalars().first()

        if not admin:
            admin = User(
                email="admin@example.com",
                full_name="System Admin",
                hashed_password=get_password_hash("admin123"),
                role="ADMIN",
                is_active=True
            )
            db.add(admin)
            print("Admin user created: admin@example.com / admin123")
        else:
            # Update password just in case
            admin.hashed_password = get_password_hash("admin123")
            print("Admin user already exists, password updated to admin123")

        # Check if student exists
        result = await db.execute(select(User).filter(User.email == "student@example.com"))
        student = result.scalars().first()

        if not student:
            student = User(
                email="student@example.com",
                full_name="Test Student",
                hashed_password=get_password_hash("student123"),
                role="STUDENT",
                is_active=True
            )
            db.add(student)
            print("Student user created: student@example.com / student123")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(create_users())
