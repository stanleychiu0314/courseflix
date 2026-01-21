import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import '../styles/FeedbackPage.css';

/**
 * FeedbackPage Component
 *
 * Multi-step form for submitting course feedback/reviews.
 *
 * Backend Integration:
 * - Search courses: GET /api/courses/search?query={searchTerm}
 * - Submit feedback: POST /api/reviews with form data
 * - Upload syllabus: POST /api/courses/:courseId/syllabus (file upload)
 * - Feedback data structure should include:
 *   - courseId, overallRating, hoursPerWeek, effortLevel, wouldTakeAgain,
 *   - workloadTypes[], firstWord, grade, gradingBreakdown{}, syllabus (file), comments
 */

interface GradingItem {
  name: string;
  percentage: number;
}

const FeedbackPage: React.FC = () => {
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    overallRating: 0,
    hoursPerWeek: 6,
    effortLevel: 0,
    wouldTakeAgain: '',
    workloadTypes: [] as string[],
    firstWord: '',
    attendancePolicy: '',
    absencesAllowed: 0,
    grade: '',
    gradingBreakdown: [] as GradingItem[],
    syllabus: null as File | null,
    comments: '',
  });

  const [hoverRating, setHoverRating] = useState(0);

  const toggleWorkloadType = (type: string) => {
    if (formData.workloadTypes.includes(type)) {
      setFormData({
        ...formData,
        workloadTypes: formData.workloadTypes.filter((t) => t !== type),
      });
    } else {
      setFormData({
        ...formData,
        workloadTypes: [...formData.workloadTypes, type],
      });
    }
  };

  const handleSubmit = () => {
    // TODO: Submit form data to backend
    console.log('Submitting feedback:', formData);
    alert('Feedback submitted successfully!');
  };

  const renderStars = () => {
    return [1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        className={`star ${star <= (hoverRating || formData.overallRating) ? 'filled' : ''}`}
        onMouseEnter={() => setHoverRating(star)}
        onMouseLeave={() => setHoverRating(0)}
        onClick={() => setFormData({ ...formData, overallRating: star })}
      >
        ★
      </span>
    ));
  };

  return (
    <div className="feedback-page">
      <Navbar />
      <div className="feedback-container">
        <div className="feedback-header">
          <h1 className="feedback-title">Submit Course Feedback</h1>
          <p className="feedback-subtitle">Help your fellow students by sharing your experience</p>
        </div>

        <div className="feedback-form">
            {/* Question 1: Select Course */}
            <div className="form-section">
              <label className="form-label">
                <span className="section-number">1</span>
                Which course are you reviewing?<span className="required">*</span>
              </label>
              <div className="search-container">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search for a course (e.g., CS 2201, Microeconomics, Dr. Bolton)"
                />
              </div>
              <div className="course-result" onClick={() => setSelectedCourse('CS 2201')}>
                <div className="course-result-title">CS 2201: Program Design & Data Structures</div>
                <div className="course-result-meta">Dr. Jeremy Bolton • MWF 10:10-11:00a • Fall 2025</div>
              </div>
            </div>

            {/* Question 2: Overall Rating */}
            <div className="form-section">
              <label className="form-label">
                <span className="section-number">2</span>
                Overall Rating<span className="required">*</span>
              </label>
              <p className="form-description">How would you rate this course overall?</p>
              <div className="star-rating">{renderStars()}</div>
            </div>

            {/* Question 3: Hours per Week */}
            <div className="form-section">
              <label className="form-label">
                <span className="section-number">3</span>
                How much work do you put in per week?<span className="required">*</span>
              </label>
              <p className="form-description">Include time spent in class, homework, studying, and projects</p>
              <div className="slider-value">{formData.hoursPerWeek} hours</div>
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="12"
                  step="0.5"
                  value={formData.hoursPerWeek}
                  className="slider"
                  onChange={(e) => setFormData({ ...formData, hoursPerWeek: parseFloat(e.target.value) })}
                />
                <div className="slider-labels">
                  <span>0 hrs</span>
                  <span>6 hrs</span>
                  <span>12+ hrs</span>
                </div>
              </div>
            </div>

            {/* Question 4: Effort Level */}
            <div className="form-section">
              <label className="form-label">
                <span className="section-number">4</span>
                What is the effort level?<span className="required">*</span>
              </label>
              <p className="form-description">How challenging is this course?</p>
              <div className="options-grid">
                {[
                  { value: 1, label: 'Very Easy' },
                  { value: 2, label: 'Easy' },
                  { value: 3, label: 'Moderate' },
                  { value: 4, label: 'Hard' },
                  { value: 5, label: 'Very Hard' },
                ].map((option) => (
                  <div
                    key={option.value}
                    className={`option-card ${formData.effortLevel === option.value ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, effortLevel: option.value })}
                  >
                    <div className="option-number">{option.value}</div>
                    <div className="option-label">{option.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Question 5: Would Take Again */}
            <div className="form-section">
              <label className="form-label">
                <span className="section-number">5</span>
                Would you take it again?<span className="required">*</span>
              </label>
              <div className="options-grid two-col">
                {['Yes', 'No'].map((option) => (
                  <div
                    key={option}
                    className={`option-card ${formData.wouldTakeAgain === option ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, wouldTakeAgain: option })}
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>

            {/* Question 6: Workload Type */}
            <div className="form-section">
              <label className="form-label">
                <span className="section-number">6</span>
                What type of workload is this course?<span className="required">*</span>
              </label>
              <p className="form-description">Select all that apply</p>
              <div className="checkbox-group">
                {['Exam Heavy', 'Project Heavy', 'Paper Heavy', 'Discussion-based'].map((type) => (
                  <label key={type} className={`checkbox-item ${formData.workloadTypes.includes(type) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={formData.workloadTypes.includes(type)}
                      onChange={() => toggleWorkloadType(type)}
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

          {/* Question 7: First Word */}
          <div className="form-section">
            <label className="form-label">
              <span className="section-number">7</span>
              What is the first word that comes to mind?<span className="required">*</span>
            </label>
            <p className="form-description">When you reflect about this course, what's the first word you think of?</p>
            <input
              type="text"
              className="text-input"
              placeholder="e.g., challenging, rewarding, interesting..."
              value={formData.firstWord}
              onChange={(e) => setFormData({ ...formData, firstWord: e.target.value })}
            />
          </div>

          {/* Question 8: Attendance */}
          <div className="form-section">
            <label className="form-label">
              <span className="section-number">8</span>
              What was the attendance policy?<span className="required">*</span>
            </label>
            <p className="form-description">Select the attendance policy and number of absences allowed</p>
            <div className="options-grid two-col" style={{ marginBottom: '1rem' }}>
              {['Flexible', 'Strict'].map((policy) => (
                <div
                  key={policy}
                  className={`option-card ${formData.attendancePolicy === policy ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, attendancePolicy: policy })}
                >
                  {policy}
                </div>
              ))}
            </div>
            <label className="form-sublabel">Number of absences allowed before points deducted:</label>
            <input
              type="number"
              className="text-input"
              placeholder="e.g., 3"
              min="0"
              value={formData.absencesAllowed || ''}
              onChange={(e) => setFormData({ ...formData, absencesAllowed: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Question 9: Grade */}
          <div className="form-section">
            <label className="form-label">
              <span className="section-number">9</span>
              What grade did you get? <span className="optional">(Optional)</span>
            </label>
            <div className="grade-grid">
              {['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'].map((grade) => (
                <div
                  key={grade}
                  className={`grade-option ${formData.grade === grade ? 'selected' : ''}`}
                  onClick={() => setFormData({ ...formData, grade })}
                >
                  {grade}
                </div>
              ))}
            </div>
          </div>

          {/* Question 10: Grading Breakdown */}
          <div className="form-section">
            <label className="form-label">
              <span className="section-number">10</span>
              What was the grading breakdown?<span className="required">*</span>
            </label>
            <p className="form-description">Share how grades were calculated (e.g., exams, papers, projects, participation)</p>
            <div className="grading-breakdown">
              <details>
                <summary className="breakdown-toggle">▼ Click to expand and enter grading breakdown</summary>
                <div className="breakdown-content">
                  <div className="breakdown-rows">
                    {['Midterm Exam', 'Final Exam', 'Paper 1', 'Paper 2', 'Projects', 'Attendance', 'Participation'].map(
                      (item, idx) => (
                        <div key={idx} className="breakdown-row">
                          <input type="text" className="breakdown-name" placeholder={`e.g., ${item}`} />
                          <input type="number" className="breakdown-percentage" placeholder="0" min="0" max="100" />
                          <span className="percentage-symbol">%</span>
                        </div>
                      )
                    )}
                  </div>
                  <button className="add-row-btn">+ Add Row</button>
                  <div className="breakdown-total">Total: 0%</div>
                </div>
              </details>
            </div>
          </div>

          {/* Question 11: Syllabus Upload */}
          <div className="form-section">
            <label className="form-label">
              <span className="section-number">11</span>
              Submit a copy of the syllabus<span className="required">*</span>
            </label>
            <p className="form-description">Help future students by uploading the course syllabus (PDF format preferred)</p>
            <div className="file-upload">
              <div className="file-upload-icon">📄</div>
              <div className="file-upload-text">
                <strong>Click to upload</strong> or drag and drop
                <br />
                PDF, DOC, DOCX (Max 10MB)
              </div>
              <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} />
            </div>
          </div>

          {/* Question 12: Overall Comments */}
          <div className="form-section">
            <label className="form-label">
              <span className="section-number">12</span>
              Overall Comments<span className="required">*</span>
            </label>
            <p className="form-description">Share your overall thoughts about this course. What should future students know?</p>
            <textarea
              className="text-input"
              rows={6}
              placeholder="Share your experience with the course, professor, workload, key takeaways, tips for success, etc."
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button className="submit-btn" onClick={handleSubmit}>
              Submit Feedback
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
