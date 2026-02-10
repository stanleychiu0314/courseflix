import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/CoursesPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Course {
  id: string;
  code: string;
  name: string;
  professor: string;
  schedule: string;
  location: string;
  avgHoursWeek: number;
  effortLevel: number;
  classSize: string;
  rating: number;
  difficulty: string;
  tags: string[];
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Term {
  id: string;
  label: string;
}

const CoursesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('Spring 2026');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // Fetch departments and terms on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [deptRes, termsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/departments`),
          fetch(`${API_BASE_URL}/api/terms`)
        ]);

        if (deptRes.ok) {
          const deptData = await deptRes.json();
          setDepartments(deptData);
        }

        if (termsRes.ok) {
          const termsData = await termsRes.json();
          setTerms(termsData);
          if (termsData.length > 0) {
            setSelectedSemester(termsData[0].label);
          }
        }
      } catch (err) {
        console.error('Error fetching metadata:', err);
      }
    };

    fetchMetadata();
  }, []);

  // Fetch courses with filters and pagination
  const fetchCourses = useCallback(async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (searchQuery) params.append('search', searchQuery);
      if (selectedDepartment !== 'All Departments') params.append('department', selectedDepartment);
      if (selectedSemester) params.append('term', selectedSemester);
      if (selectedDays.length > 0) params.append('days', selectedDays.join(','));
      if (selectedTimes.length > 0) params.append('times', selectedTimes.join(','));
      if (selectedCategories.length > 0) params.append('categories', selectedCategories.join(','));
      params.append('page', page.toString());
      params.append('limit', ITEMS_PER_PAGE.toString());

      const response = await fetch(`${API_BASE_URL}/api/courses?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch courses');
      }

      const data = await response.json();

      // Handle both old format (array) and new format (object with pagination)
      if (Array.isArray(data)) {
        // Old format - no pagination
        setCourses(data);
        setCurrentPage(1);
        setTotalPages(1);
        setTotalCount(data.length);
      } else {
        // New format with pagination
        setCourses(data.courses);
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedDepartment, selectedSemester, selectedDays, selectedTimes, selectedCategories]);

  // Debounce search and fetch courses - reset to page 1 when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchCourses(1);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [fetchCourses]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchCourses(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleFilter = (filterArray: string[], setFilter: (val: string[]) => void, value: string) => {
    if (filterArray.includes(value)) {
      setFilter(filterArray.filter((item) => item !== value));
    } else {
      setFilter([...filterArray, value]);
    }
  };

  return (
    <div className="courses-page">
      <Navbar />

      <div className="courses-container">
        {/* Search and Filters Section */}
        <div className="search-filters-section">
          <div className="search-row">
            <div className="search-container">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search courses, professors, or departments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="semester-select"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              {terms.length > 0 ? (
                terms.map((term) => (
                  <option key={term.id} value={term.label}>
                    {term.label}
                  </option>
                ))
              ) : (
                <option>Spring 2026</option>
              )}
            </select>
            <select
              className="department-select"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
            >
              <option>All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filters-row">
            <div className="filter-group">
              <div className="filter-label">DAYS</div>
              <div className="filter-buttons">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                  <button
                    key={day}
                    className={`filter-btn ${selectedDays.includes(day) ? 'active' : ''}`}
                    onClick={() => toggleFilter(selectedDays, setSelectedDays, day)}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <div className="filter-label">TIMES</div>
              <div className="filter-buttons">
                {['Early AM', 'Morning', 'Afternoon', 'Evening'].map((time) => (
                  <button
                    key={time}
                    className={`filter-btn ${selectedTimes.includes(time) ? 'active' : ''}`}
                    onClick={() => toggleFilter(selectedTimes, setSelectedTimes, time)}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <div className="filter-label">CATEGORIES</div>
              <div className="filter-buttons">
                {['AXLE', 'Writing', 'FYS'].map((category) => (
                  <button
                    key={category}
                    className={`filter-btn ${selectedCategories.includes(category) ? 'active' : ''}`}
                    onClick={() => toggleFilter(selectedCategories, setSelectedCategories, category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="results-section">
          <div className="results-header">
            <div className="results-count">
              {loading ? (
                'Loading courses...'
              ) : error ? (
                <span className="error-text">Error: {error}</span>
              ) : (
                <>
                  Showing <span className="count-number">{courses.length}</span> of{' '}
                  <span className="count-number">{totalCount}</span> courses
                  {totalPages > 1 && ` (Page ${currentPage} of ${totalPages})`}
                </>
              )}
            </div>
          </div>

          {/* Course Cards */}
          <div className="courses-list">
            {loading ? (
              <div className="loading-message">Loading courses...</div>
            ) : error ? (
              <div className="error-message">Failed to load courses. Please try again.</div>
            ) : courses.length === 0 ? (
              <div className="no-results-message">No courses found matching your criteria.</div>
            ) : (
              courses.map((course: Course, index: number) => (
                <Link to={`/course/${course.id}`} key={course.id} className="course-card">
                  <div className="course-number">#{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</div>
                  <div className="course-main">
                    <h3 className="course-title">
                      {course.code}: {course.name}
                    </h3>
                    <div className="course-meta">
                      <span className="meta-item">👤 {course.professor}</span>
                      <span className="meta-item">📅 {course.schedule}</span>
                      <span className="meta-item">📍 {course.location}</span>
                      <span className={`meta-badge ${course.difficulty.replace(' ', '-').toLowerCase()}`}>
                        {course.difficulty}
                      </span>
                    </div>
                    <div className="course-tags">
                      {course.tags?.map((tag: string) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="course-stats">
                    <div className="stat">
                      <div className="stat-value">{course.avgHoursWeek || 0}</div>
                      <div className="stat-label">AVG HRS/WEEK</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{course.effortLevel || 0}</div>
                      <div className="stat-label">EFFORT LEVEL</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{course.classSize || 'N/A'}</div>
                      <div className="stat-label">CLASS SIZE</div>
                    </div>
                    <div className="stat rating-stat">
                      <div className="stat-value">⭐ {course.rating || 0}</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && !error && totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                First
              </button>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>

              <div className="pagination-pages">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      className={`pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                className="pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoursesPage;
