from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any


class BaseAnalyticsModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# 1. Filters & Query Schemas
# ============================================================================
class AnalyticsFilters(BaseAnalyticsModel):
    classroom_id: Optional[int] = None
    exam_id: Optional[int] = None
    student_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    attempt_filter: Optional[str] = "best"


# ============================================================================
# 2. Score Distribution & Tiers Schemas
# ============================================================================
class ScoreBin(BaseAnalyticsModel):
    bin: str
    min: float
    max: float
    count: int
    percentage: float


class ScoreTier(BaseAnalyticsModel):
    tier: str
    range: str
    count: int
    percentage: float
    color: str


class ScoreDistribution(BaseAnalyticsModel):
    bins: List[ScoreBin]
    tiers: List[ScoreTier]


# ============================================================================
# 3. Summary Statistics Schemas
# ============================================================================
class AnalyticsSummaryStats(BaseAnalyticsModel):
    total_submissions: int
    unique_students: int
    total_exams: int
    average_score: float
    median_score: float
    highest_score: float
    lowest_score: float
    standard_deviation: float
    pass_count: int
    fail_count: int
    pass_rate: float


class TopWeakTopic(BaseAnalyticsModel):
    topic: str
    chapter: Optional[str] = None
    accuracy_rate: float
    question_count: int
    total_attempts: int
    correct_attempts: Optional[int] = None
    status: str = "WEAK"


class RecommendationsSummary(BaseAnalyticsModel):
    high_priority_count: int
    total_recommendations: int


# ============================================================================
# 4. GET /api/analytics/dashboard Response
# ============================================================================
class DashboardAnalyticsResponse(BaseAnalyticsModel):
    filters_applied: AnalyticsFilters
    summary: AnalyticsSummaryStats
    score_distribution: ScoreDistribution
    top_weak_topics: List[TopWeakTopic]
    recommendations_summary: RecommendationsSummary


# ============================================================================
# 5. GET /api/analytics/topics Response
# ============================================================================
class DifficultyStats(BaseAnalyticsModel):
    total: int
    correct: int
    accuracy: float


class TopicPerformance(BaseAnalyticsModel):
    topic: str
    chapter: Optional[str] = None
    subject: Optional[str] = None
    question_count: int
    total_attempts: int
    correct_attempts: int
    accuracy_rate: float
    mastery_level: str  # NEEDS_IMPROVEMENT, SATISFACTORY, GOOD, MASTERED
    difficulty_breakdown: Dict[str, DifficultyStats] = Field(default_factory=dict)


class DifficultySummaryItem(BaseAnalyticsModel):
    difficulty: str
    total: int
    correct: int
    accuracy_rate: float


class QuestionTypeSummaryItem(BaseAnalyticsModel):
    question_type: str
    total: int
    correct: int
    accuracy_rate: float


class TopicAnalyticsResponse(BaseAnalyticsModel):
    topics: List[TopicPerformance]
    difficulty_summary: List[DifficultySummaryItem]
    question_type_summary: List[QuestionTypeSummaryItem]


# ============================================================================
# 6. GET /api/analytics/recommendations Response
# ============================================================================
class RecommendationItem(BaseAnalyticsModel):
    id: str
    priority: str  # HIGH, MEDIUM, LOW
    category: str  # WEAK_TOPIC, STUDENT_INTERVENTION, QUESTION_ANOMALY
    title: str
    description: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    suggested_actions: List[str] = Field(default_factory=list)
    action_type: Optional[str] = None
    action_payload: Optional[Dict[str, Any]] = None


class RecommendationsPrioritySummary(BaseAnalyticsModel):
    high_priority_count: int
    medium_priority_count: int
    low_priority_count: int
    total_recommendations: int


class RecommendationsResponse(BaseAnalyticsModel):
    recommendations: List[RecommendationItem]
    summary: RecommendationsPrioritySummary


# ============================================================================
# 7. GET /api/analytics/questions Response
# ============================================================================
class DistractorOption(BaseAnalyticsModel):
    option_index: int
    option_letter: str
    count: int
    percentage: float
    is_correct: bool


class QuestionItemAnalytics(BaseAnalyticsModel):
    question_id: int
    code: Optional[str] = None
    content: Optional[str] = None
    question_type: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    total_attempts: int
    correct_count: int
    accuracy_rate: float
    distractor_analysis: List[DistractorOption] = Field(default_factory=list)
    is_flagged_anomaly: bool = False
    anomaly_reason: Optional[str] = None


class QuestionAnalyticsResponse(BaseAnalyticsModel):
    questions: List[QuestionItemAnalytics]


# ============================================================================
# 8. GET /api/analytics/students Response
# ============================================================================
class StudentPerformanceItem(BaseAnalyticsModel):
    student_id: int
    student_name: str
    student_email: Optional[str] = None
    submissions_count: int
    assigned_count: int
    completion_rate: float
    average_score: float
    percentile: float
    highest_score: Optional[float] = None
    lowest_score: Optional[float] = None
    needs_intervention: bool = False
    intervention_reasons: List[str] = Field(default_factory=list)


class StudentAnalyticsResponse(BaseAnalyticsModel):
    students: List[StudentPerformanceItem]
    class_average: float
    total_students: int


# ============================================================================
# 9. GET /api/analytics/summary Response (Legacy + Enhanced)
# ============================================================================
class LegacyScoreDistributionItem(BaseAnalyticsModel):
    name: str
    count: int


class EnhancedTeacherSummaryResponse(BaseAnalyticsModel):
    exams_count: int
    questions_count: int
    classrooms_count: int
    students_count: int
    submissions_count: int
    average_score: float
    score_distribution: List[LegacyScoreDistributionItem]
    # Enhanced attributes:
    median_score: Optional[float] = 0.0
    highest_score: Optional[float] = 0.0
    lowest_score: Optional[float] = 0.0
    pass_rate: Optional[float] = 0.0
    active_recommendations_count: Optional[int] = 0
