import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, redis_client
from app.core.security import get_current_user, get_current_teacher
from app.models.user import User
from app.schemas.analytics import (
    DashboardAnalyticsResponse,
    TopicAnalyticsResponse,
    RecommendationsResponse,
    QuestionAnalyticsResponse,
    StudentAnalyticsResponse,
    EnhancedTeacherSummaryResponse,
)
from app.services.analytics_service import AnalyticsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


async def get_analytics_user(current_user: User = Depends(get_current_user)) -> User:
    """Xác thực người dùng có quyền Giáo viên hoặc Quản trị viên để truy cập module Thống kê"""
    if current_user.role not in ["TEACHER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập chức năng này (yêu cầu quyền Giáo viên)"
        )
    return current_user


async def invalidate_analytics_cache(user_id: Optional[int] = None):
    """
    Xóa cache thống kê khi có thay đổi dữ liệu (nộp bài, xóa bài, cập nhật đề thi/câu hỏi).
    Tương thích ngược hoàn toàn với các router gọi hàm này.
    """
    try:
        if user_id:
            keys = await redis_client.keys(f"analytics:*:{user_id}*")
            if keys:
                await redis_client.delete(*keys)
            await redis_client.delete(f"analytics:summary:{user_id}")
        else:
            keys = await redis_client.keys("analytics:*")
            if keys:
                await redis_client.delete(*keys)
    except Exception as e:
        logger.warning(f"Error invalidating analytics cache: {e}")


@router.get(
    "/dashboard",
    response_model=DashboardAnalyticsResponse,
    summary="Dashboard phân tích chất lượng & phổ điểm đa chiều"
)
async def get_analytics_dashboard(
    classroom_id: Optional[int] = Query(None, description="ID lớp học cần lọc"),
    exam_id: Optional[int] = Query(None, description="ID bài kiểm tra / đề thi cần lọc"),
    student_id: Optional[int] = Query(None, description="ID học sinh cần lọc"),
    start_date: Optional[str] = Query(None, description="Thời gian bắt đầu (ISO 8601)"),
    end_date: Optional[str] = Query(None, description="Thời gian kết thúc (ISO 8601)"),
    attempt_filter: Optional[str] = Query("best", description="Bộ lọc lượt thi: best, latest, all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_analytics_user)
):
    """
    Endpoint phân tích đa chiều phục vụ giao diện thống kê:
    - Bộ lọc đa chiều: lớp học, đề thi, học sinh, khoảng thời gian, chế độ lượt làm bài (tốt nhất / mới nhất / tất cả).
    - Thống kê tổng hợp: sĩ số, điểm TB, trung vị, cao nhất, thấp nhất, độ lệch chuẩn, tỷ lệ đạt.
    - Phổ điểm 10 cột (0-1 đến 9-10) và 4 phân loại học lực (Yếu, Trung bình, Khá, Giỏi).
    - Top các chủ đề kiến thức yếu cần củng cố (< 60% độ chính xác).
    - Tổng quan số lượng khuyến nghị sư phạm tích cực.
    """
    cache_key = (
        f"analytics:dashboard:{current_user.id}:{classroom_id}:{exam_id}:"
        f"{student_id}:{start_date}:{end_date}:{attempt_filter}"
    )
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    data = await AnalyticsService.get_dashboard_analytics(
        db=db,
        current_user=current_user,
        classroom_id=classroom_id,
        exam_id=exam_id,
        student_id=student_id,
        start_date=start_date,
        end_date=end_date,
        attempt_filter=attempt_filter
    )

    try:
        resp_dict = data.model_dump(mode="json")
        await redis_client.set(cache_key, json.dumps(resp_dict), ex=60)
    except Exception:
        pass

    return data


@router.get(
    "/topics",
    response_model=TopicAnalyticsResponse,
    summary="Phân tích độ chính xác theo chủ đề, mức độ nhận thức & dạng câu hỏi"
)
async def get_analytics_topics(
    classroom_id: Optional[int] = Query(None, description="ID lớp học cần lọc"),
    exam_id: Optional[int] = Query(None, description="ID bài kiểm tra / đề thi cần lọc"),
    student_id: Optional[int] = Query(None, description="ID học sinh cần lọc"),
    start_date: Optional[str] = Query(None, description="Thời gian bắt đầu (ISO 8601)"),
    end_date: Optional[str] = Query(None, description="Thời gian kết thúc (ISO 8601)"),
    attempt_filter: Optional[str] = Query("best", description="Bộ lọc lượt thi: best, latest, all"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_analytics_user)
):
    """
    Tổng hợp tỷ lệ làm đúng theo từng chuyên đề/chương, phân tích độ thuần thục (mastery level),
    ma trận độ khó (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao) và dạng câu hỏi.
    """
    subs = await AnalyticsService.get_filtered_submissions(
        db=db,
        current_user=current_user,
        classroom_id=classroom_id,
        exam_id=exam_id,
        student_id=student_id,
        start_date=start_date,
        end_date=end_date,
        attempt_filter=attempt_filter
    )
    return await AnalyticsService.calculate_topic_performance(db, subs)


@router.get(
    "/recommendations",
    response_model=RecommendationsResponse,
    summary="Khuyến nghị sư phạm dựa trên luật heuristic và cảnh báo can thiệp"
)
async def get_analytics_recommendations(
    classroom_id: Optional[int] = Query(None, description="ID lớp học cần phân tích"),
    exam_id: Optional[int] = Query(None, description="ID bài kiểm tra / đề thi cần phân tích"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_analytics_user)
):
    """
    Tự động quét các chỉ số và phát hiện bất thường:
    - Chủ đề yếu: Tỷ lệ làm đúng của cả lớp < 60%
    - Học sinh cần can thiệp: Điểm TB < 5.0, thấp hơn TB lớp > 1.5 điểm, hoặc hoàn thành < 50% bài tập
    - Câu hỏi bất thường: Tỷ lệ sai > 65% hoặc phương án nhiễu có bẫy học sinh > 40%
    """
    return await AnalyticsService.generate_recommendations(
        db=db,
        current_user=current_user,
        classroom_id=classroom_id,
        exam_id=exam_id
    )


@router.get(
    "/questions",
    response_model=QuestionAnalyticsResponse,
    summary="Phân tích chất lượng câu hỏi thi và phân bố phương án nhiễu (distractor analysis)"
)
async def get_analytics_questions(
    exam_id: Optional[int] = Query(None, description="ID đề thi cần phân tích"),
    classroom_id: Optional[int] = Query(None, description="ID lớp học tùy chọn"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_analytics_user)
):
    """
    Phân tích từng câu hỏi: số lượt làm bài, số lượt đúng, tỷ lệ làm đúng,
    tần suất chọn từng phương án A/B/C/D và gắn cờ cảnh báo câu hỏi bất thường / bẫy đề thi.
    """
    return await AnalyticsService.analyze_questions(
        db=db,
        current_user=current_user,
        exam_id=exam_id,
        classroom_id=classroom_id
    )


@router.get(
    "/students",
    response_model=StudentAnalyticsResponse,
    summary="Bảng xếp hạng, tỷ lệ hoàn thành và phân tích học lực từng học sinh"
)
async def get_analytics_students(
    classroom_id: Optional[int] = Query(None, description="ID lớp học cần phân tích"),
    exam_id: Optional[int] = Query(None, description="ID bài kiểm tra / đề thi tùy chọn"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_analytics_user)
):
    """
    Phân tích chi tiết từng học sinh trong lớp học: số bài nộp, tỷ lệ hoàn thành bài tập,
    điểm trung bình, điểm bách phân vị (percentile rank), điểm cao nhất, thấp nhất,
    và cờ cảnh báo cần giáo viên can thiệp kèm lý do cụ thể.
    """
    return await AnalyticsService.analyze_students(
        db=db,
        current_user=current_user,
        classroom_id=classroom_id,
        exam_id=exam_id
    )


@router.get(
    "/summary",
    response_model=EnhancedTeacherSummaryResponse,
    summary="Thống kê tổng quan nâng cao cho giáo viên (tương thích ngược)"
)
async def get_teacher_summary(
    request: Request,
    classroom_id: Optional[int] = Query(None, description="ID lớp học tùy chọn"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_analytics_user)
):
    """
    Endpoint thống kê tổng quan nâng cao:
    - Giữ trọn vẹn 100% các khóa tương thích ngược: exams_count, questions_count, classrooms_count,
      students_count, submissions_count, average_score, score_distribution.
    - Bổ sung các chỉ số thống kê chất lượng mới: median_score, highest_score, lowest_score,
      pass_rate, active_recommendations_count.
    """
    cache_key = f"analytics:summary:{current_user.id}:{classroom_id or 'all'}"
    try:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    data = await AnalyticsService.get_enhanced_summary(
        db=db,
        current_user=current_user,
        classroom_id=classroom_id
    )

    try:
        resp_dict = data.model_dump(mode="json")
        await redis_client.set(cache_key, json.dumps(resp_dict), ex=60)
    except Exception:
        pass

    return data