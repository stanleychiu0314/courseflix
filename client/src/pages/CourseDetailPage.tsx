import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import '../styles/CourseDetailPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Review {
  id: string;
  rating: number;
  difficulty: string;
  grade: string;
  text: string;
  date: string;
  tags: string[];
  helpfulCount?: number;
}

interface GradeBreakdownItem {
  name: string;
  percentage: number;
}

interface CourseDetails {
  id: string;
  sectionId: string | null;
  code: string;
  credits: number;
  maxSeats: number;
  name: string;
  professor: string;
  schedule: string;
  location: string;
  rating: number;
  reviewCount: number;
  description: string;
  prerequisites: string | null;
  commentHighlights: string[];
  gradeDistribution: Record<string, number>;
  gradeBreakdown: GradeBreakdownItem[];
  avgHoursPerWeek: number;
  difficulty: string;
  wouldTakeAgain: string;
  attendancePolicy: string;
  absencesAllowed: number;
  departmentCode?: string;
  departmentName?: string;
}

const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, refreshCartCount } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const handleWriteReview = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/courses/${courseId}` } });
      return;
    }

    // Navigate to feedback page with course pre-selected
    navigate('/feedback', {
      state: {
        preSelectedCourse: {
          id: course?.id,
          sectionId: course?.sectionId,
          code: course?.code,
          name: course?.name,
          professor: course?.professor,
          schedule: course?.schedule,
          termLabel: 'Spring 2026', // You might want to get this from the course data
        },
      },
    });
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/courses/${courseId}` } });
      return;
    }

    if (!course?.sectionId) {
      setCartMessage('No section available to add.');
      return;
    }

    setAddingToCart(true);
    setCartMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sectionId: course.sectionId }),
      });

      if (response.ok) {
        setCartMessage('Added to cart!');
        await refreshCartCount();
      } else {
        const data = await response.json();
        setCartMessage(data.error || 'Failed to add to cart.');
      }
    } catch {
      setCartMessage('Failed to add to cart.');
    } finally {
      setAddingToCart(false);
      setTimeout(() => setCartMessage(null), 3000);
    }
  };

  useEffect(() => {
    const fetchCourseData = async () => {
      if (!courseId) return;

      setLoading(true);
      setError(null);

      try {
        const [courseRes, reviewsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/courses/${courseId}`),
          fetch(`${API_BASE_URL}/api/courses/${courseId}/reviews`)
        ]);

        if (!courseRes.ok) {
          throw new Error('Course not found');
        }

        const courseData = await courseRes.json();
        setCourse(courseData);

        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          setReviews(reviewsData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    fetchCourseData();
  }, [courseId]);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="course-detail-page">
        <Navbar />
        <div className="loading-container">Loading course details...</div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="course-detail-page">
        <Navbar />
        <div className="error-container">
          <p>{error || 'Course not found'}</p>
          <Link to="/courses">Back to Courses</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="course-detail-page">
      <Navbar />

      <div className="breadcrumb">
        <Link to="/courses">Courses</Link>
        <span> › </span>
        <Link to={`/courses?department=${course.departmentName}`}>{course.departmentCode}</Link>
        <span> › </span>
        <span>{course.code}</span>
      </div>

      <div className="course-detail-container">
        {/* Course Header */}
        <div className="course-header">
          <div className="course-header-main">
            <div className="course-badges">
              <span className="badge badge-code">{course.code}</span>
              <span className="badge badge-credits">{course.credits} Credits</span>
              <span className="badge badge-enrolled">{course.maxSeats} Max Seats</span>
            </div>
            <h1 className="course-name">{course.name}</h1>
            <div className="course-info-row">
              <span className="info-item">👤 {course.professor}</span>
              <span className="info-item">📅 {course.schedule}</span>
              <span className="info-item">📍 {course.location}</span>
            </div>
          </div>
          <div className="course-header-rating">
            <div className="rating-large">{course.rating || 0}</div>
            <div className="stars-large">{renderStars(Math.round(course.rating || 0))}</div>
            <div className="review-count">({course.reviewCount || 0} reviews)</div>
            <div className="action-buttons">
              <button
                className="write-review-btn"
                onClick={handleWriteReview}
              >
                ✍️ Write a Review!
              </button>
              <button
                className={`add-to-cart-btn ${cartMessage === 'Added to cart!' ? 'added' : ''}`}
                onClick={handleAddToCart}
                disabled={addingToCart}
              >
                {addingToCart ? 'Adding...' : '🛒 Add to Cart'}
              </button>
            </div>
            {cartMessage && (
              <div className={`cart-message ${cartMessage === 'Added to cart!' ? 'success' : 'error'}`}>
                {cartMessage}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            Overview
          </button>
          <button className={`tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
            Reviews
          </button>
          <button className={`tab ${activeTab === 'grades' ? 'active' : ''}`} onClick={() => setActiveTab('grades')}>
            Grade Distribution
          </button>
          <button className={`tab ${activeTab === 'breakdown' ? 'active' : ''}`} onClick={() => setActiveTab('breakdown')}>
            Grade Breakdown
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          <div className="content-main">
            {activeTab === 'overview' && (
              <div className="overview-content">
                <div className="section">
                  <h3 className="section-title">COURSE DESCRIPTION</h3>
                  <p className="description-text">{course.description || 'No description available.'}</p>
                </div>

                <div className="section">
                  <h3 className="section-title">PREREQUISITES</h3>
                  <div className="prerequisites">
                    <span className={course.prerequisites ? "prerequisite-text" : "no-prereqs"}>
                      {course.prerequisites || 'None'}
                    </span>
                  </div>
                </div>

                <div className="section">
                  <h3 className="section-title">COMMENT HIGHLIGHTS</h3>
                  <div className="comment-highlights">
                    {course.commentHighlights && course.commentHighlights.length > 0 ? (
                      course.commentHighlights.map((highlight: string) => (
                        <span key={highlight} className="highlight-badge">
                          {highlight}
                        </span>
                      ))
                    ) : (
                      <span className="no-highlights">No highlights yet</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="reviews-content">
                <h3 className="section-title">TOP COMMENT KEYWORDS</h3>
                <div className="comment-keywords">
                  {course.commentHighlights && course.commentHighlights.map((keyword: string, idx: number) => (
                    <span key={keyword} className="keyword-badge">
                      {keyword} ({32 - idx * 4})
                    </span>
                  ))}
                </div>

                <h3 className="section-title" style={{ marginTop: '2rem' }}>
                  DETAILED REVIEWS ({reviews.length})
                </h3>
                <div className="reviews-list">
                  {reviews.length === 0 ? (
                    <p className="no-reviews">No reviews yet. Be the first to review this course!</p>
                  ) : (
                    reviews.map((review: Review) => (
                      <div key={review.id} className="review-card">
                        <div className="review-header">
                          <div className="review-stars">{renderStars(review.rating)}</div>
                          <div className="review-meta">
                            <span className="review-badge difficulty">Difficulty: {review.difficulty}</span>
                            <span className="review-badge grade">Grade: {review.grade}</span>
                            <span className="review-date">{review.date}</span>
                          </div>
                        </div>
                        <div className="comment-tags">
                          {review.tags?.map((tag: string) => (
                            <span key={tag} className="comment-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="review-text">{review.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'grades' && (
              <div className="grades-content">
                <h3 className="section-title">GRADE DISTRIBUTION - ALL SECTIONS</h3>
                <div className="grade-bars">
                  {course.gradeDistribution && Object.keys(course.gradeDistribution).length > 0 ? (
                    Object.entries(course.gradeDistribution).map(([grade, percentage]) => (
                      <div key={grade} className="grade-row">
                        <div className="grade-label">{grade}</div>
                        <div className="grade-bar-container">
                          <div className="grade-bar" style={{ width: `${percentage}%` }}></div>
                        </div>
                        <div className="grade-percentage">{percentage}%</div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">No grade distribution data available.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'breakdown' && (
              <div className="breakdown-content">
                <h3 className="section-title">GRADE BREAKDOWN</h3>
                <div className="grade-breakdown-table">
                  <div className="breakdown-header">
                    <div className="breakdown-col">Requirements</div>
                    <div className="breakdown-col">Grade %</div>
                  </div>
                  {course.gradeBreakdown && course.gradeBreakdown.length > 0 ? (
                    course.gradeBreakdown.map((item: GradeBreakdownItem, idx: number) => (
                      <div key={idx} className="breakdown-row">
                        <div className="breakdown-col">{item.name}</div>
                        <div className="breakdown-col">{item.percentage}</div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">No grade breakdown data available.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Quick Stats */}
          <div className="content-sidebar">
            <h3 className="sidebar-title">QUICK STATS</h3>

            <div className="stat-item">
              <div className="stat-icon">⏱️</div>
              <div className="stat-content">
                <div className="stat-label">Avg Hours/Week</div>
                <div className="stat-value">{course.avgHoursPerWeek || 0} hrs</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-label">Difficulty</div>
                <div className="stat-value">{course.difficulty || 'N/A'}</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">🔄</div>
              <div className="stat-content">
                <div className="stat-label">Would Take Again</div>
                <div className="stat-value">{course.wouldTakeAgain || 'N/A'}</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">📋</div>
              <div className="stat-content">
                <div className="stat-label">Attendance Policy</div>
                <div className="stat-value">{course.attendancePolicy || 'N/A'}</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">🚫</div>
              <div className="stat-content">
                <div className="stat-label">Absences Allowed</div>
                <div className="stat-value">{course.absencesAllowed || 0}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
