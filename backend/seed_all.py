import asyncio
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.question import Question
from app.core.security import get_password_hash

async def seed():
    async with AsyncSessionLocal() as db:
        # Check users
        result = await db.execute(select(User))
        users = result.scalars().all()
        if not users:
            print("Creating test users...")
            teacher = User(email="teacher@example.com", full_name="Teacher Test", hashed_password=get_password_hash("Password@123!"), role="TEACHER")
            student = User(email="student@example.com", full_name="Student Test", hashed_password=get_password_hash("Password@123!"), role="STUDENT")
            db.add_all([teacher, student])
            await db.commit()
            print("Users created successfully!")

        # Check questions
        q_result = await db.execute(select(Question))
        questions = q_result.scalars().all()
        if not questions:
            print("Creating sample questions...")
            q1 = Question(
                content="Hỏi: 2 + 2 bằng mấy?",
                question_type="MULTIPLE_CHOICE",
                options=["3", "4", "5", "6"],
                correct_option=1,
                explanation="2 + 2 = 4",
                creator_id=2
            )
            q2 = Question(
                content="Hỏi: Thủ đô của Việt Nam là gì?",
                question_type="SHORT_ANSWER",
                correct_answer="Hà Nội",
                explanation="Hà Nội là thủ đô.",
                creator_id=2
            )
            db.add_all([q1, q2])
            await db.commit()
            print("Sample questions created!")

if __name__ == "__main__":
    asyncio.run(seed())
