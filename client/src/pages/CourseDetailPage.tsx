import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/CourseDetailPage.css';

/**
 * CourseDetailPage Component
 *
 * Detailed view of a single course with tabs for Overview, Reviews, Grade Distribution, and Comments.
 *
 * Backend Integration:
 * - Fetch course details: GET /api/courses/:id
 * - Fetch reviews: GET /api/courses/:id/reviews
 * - Fetch grade distribution: GET /api/courses/:id/grades
 * - Fetch comments: GET /api/courses/:id/comments
 * - Add to cart: POST /api/cart with { courseId, userId }
 * - Like review: POST /api/reviews/:reviewId/like
 */

interface Review {
  id: string;
  rating: number;
  difficulty: string;
  grade: string;
  text: string;
  date: string;
  helpful: number;
}

const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const [activeTab, setActiveTab] = useState('overview');

  // TODO: Replace with actual API call to fetch course details
  const course = {
    code: 'CS 2201',
    credits: 3,
    enrolled: '42/50 Enrolled',
    name: 'Program Design & Data Structures',
    professor: 'Dr. Jeremy Bolton',
    schedule: 'MWF 10:10-11:00a',
    location: 'FGH 134',
    rating: 4.2,
    reviewCount: 47,
    avgHoursWeek: '10-12',
    difficulty: '4.1/5',
    wouldTakeAgain: '85%',
    gradingStyle: 'Exam Heavy',
    description:
      'Introduction to algorithms and data structures including lists, stacks, queues, trees, and graphs. Emphasis on programming techniques including recursion, sorting, searching, and hashing. Laboratory exercises in C++.',
    prerequisites: ['CS 1101', 'MATH 1300'],
    commentHighlights: ['Exam Heavy', 'Challenging Projects', 'Helpful Office Hours', 'Great Professor', 'Time-Consuming'],
    gradeDistribution: {
      A: 35,
      'A-': 20,
      'B+': 18,
      B: 12,
      'B-': 8,
      'C+': 4,
      C: 2,
      'C-': 1,
    },
  };

  const mockReviews: Review[] = [
    {
      id: '1',
      rating: 5,
      difficulty: '5/5',
      grade: 'A',
      text: "Dr. Bolton is an excellent lecturer who really cares about student understanding. The projects are challenging but you learn so much. Office hours are super helpful.",
      date: 'Fall 2025 • 2 weeks ago',
      helpful: 24,
    },
    {
      id: '2',
      rating: 4,
      difficulty: '4/5',
      grade: 'A-',
      text: 'Very well-structured course. The exams are tough but fair. Make sure to start projects early and attend recitation sections. The TAs are really knowledgeable.',
      date: 'Fall 2025 • 3 weeks ago',
      helpful: 18,
    },
  ];

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={`star ${i < rating ? 'filled' : ''}`}>
        ★
      </span>
    ));
  };

  return (
    <div className="course-detail-page">
      <Navbar />

      <div className="breadcrumb">
        <Link to="/courses">Courses</Link>
        <span> › </span>
        <Link to="/courses?dept=cs">Computer Science</Link>
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
              <span className="badge badge-enrolled">{course.enrolled}</span>
            </div>
            <h1 className="course-name">{course.name}</h1>
            <div className="course-info-row">
              <span className="info-item">👤 {course.professor}</span>
              <span className="info-item">📅 {course.schedule}</span>
              <span className="info-item">📍 {course.location}</span>
            </div>
          </div>
          <div className="course-header-rating">
            <div className="rating-large">{course.rating}</div>
            <div className="stars-large">{renderStars(Math.round(course.rating))}</div>
            <div className="review-count">({course.reviewCount} reviews)</div>
            <button className="add-to-cart-btn">🛒 Add to Cart</button>
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
          <button className={`tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
            Comments
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          <div className="content-main">
            {activeTab === 'overview' && (
              <div className="overview-content">
                <div className="section">
                  <h3 className="section-title">COURSE DESCRIPTION</h3>
                  <p className="description-text">{course.description}</p>
                </div>

                <div className="section">
                  <h3 className="section-title">PREREQUISITES</h3>
                  <div className="prerequisites">
                    {course.prerequisites.map((prereq) => (
                      <span key={prereq} className="prerequisite-badge">
                        {prereq}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="section">
                  <h3 className="section-title">COMMENT HIGHLIGHTS</h3>
                  <div className="comment-highlights">
                    {course.commentHighlights.map((highlight) => (
                      <span key={highlight} className="highlight-badge">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="reviews-content">
                <h3 className="section-title">STUDENT REVIEWS ({course.reviewCount})</h3>
                <div className="reviews-list">
                  {mockReviews.map((review) => (
                    <div key={review.id} className="review-card">
                      <div className="review-header">
                        <div className="review-stars">{renderStars(review.rating)}</div>
                        <div className="review-meta">
                          <span className="review-badge difficulty">Difficulty: {review.difficulty}</span>
                          <span className="review-badge grade">Grade: {review.grade}</span>
                          <span className="review-date">{review.date}</span>
                        </div>
                      </div>
                      <p className="review-text">{review.text}</p>
                      <button className="helpful-btn">🔥 Helpful ({review.helpful})</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'grades' && (
              <div className="grades-content">
                <h3 className="section-title">GRADE DISTRIBUTION - ALL SECTIONS</h3>
                <div className="grade-bars">
                  {Object.entries(course.gradeDistribution).map(([grade, percentage]) => (
                    <div key={grade} className="grade-row">
                      <div className="grade-label">{grade}</div>
                      <div className="grade-bar-container">
                        <div className="grade-bar" style={{ width: `${percentage}%` }}></div>
                      </div>
                      <div className="grade-percentage">{percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="comments-content">
                <h3 className="section-title">TOP COMMENT KEYWORDS</h3>
                <div className="comment-keywords">
                  {course.commentHighlights.map((keyword, idx) => (
                    <span key={keyword} className="keyword-badge">
                      {keyword} ({32 - idx * 4})
                    </span>
                  ))}
                </div>

                <h3 className="section-title" style={{ marginTop: '2rem' }}>
                  DETAILED COMMENTS
                </h3>
                <div className="detailed-comments">
                  <div className="comment-card">
                    <div className="comment-tags">
                      <span className="comment-tag">Exam Heavy</span>
                      <span className="comment-tag">Challenging Projects</span>
                      <span className="comment-tag">Great Professor</span>
                    </div>
                    <p className="comment-text">
                      "The exams are really tough and require deep understanding of the concepts. Projects take a lot of time but Dr. Bolton's lectures
                      prepare you well. Office hours are a lifesaver."
                    </p>
                    <div className="comment-meta">Fall 2025 • Anonymous</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Quick Stats */}
          <div className="content-sidebar">
            <h3 className="sidebar-title">QUICK STATS</h3>

            <div className="stat-item">
              <div className="stat-icon">⏰</div>
              <div className="stat-content">
                <div className="stat-label">Avg. Hours/Week</div>
                <div className="stat-value">{course.avgHoursWeek}</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">💪</div>
              <div className="stat-content">
                <div className="stat-label">Difficulty</div>
                <div className="stat-value">{course.difficulty}</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">🔁</div>
              <div className="stat-content">
                <div className="stat-label">Would Take Again</div>
                <div className="stat-value">{course.wouldTakeAgain}</div>
              </div>
            </div>

            <div className="stat-item">
              <div className="stat-icon">📚</div>
              <div className="stat-content">
                <div className="stat-label">Grading Style</div>
                <div className="stat-value">{course.gradingStyle}</div>
              </div>
            </div>

            <div className="grade-distribution-preview">
              <h4 className="sidebar-title">GRADE DISTRIBUTION</h4>
              <div className="mini-grade-bars">
                {Object.entries(course.gradeDistribution)
                  .slice(0, 2)
                  .map(([grade, percentage]) => (
                    <div key={grade} className="mini-grade-row">
                      <span className="mini-grade-label">{grade}</span>
                      <div className="mini-grade-bar" style={{ width: `${percentage}%` }}></div>
                      <span className="mini-grade-value">{percentage}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;
