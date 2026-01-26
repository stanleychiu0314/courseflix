import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import '../styles/CoursesPage.css';

/**
 * CoursesPage Component
 *
 * Main page for browsing and searching courses.
 * Features: Search, filters (days, times, categories), sorting, and course cards.
 *
 * Backend Integration:
 * - Fetch courses: GET /api/courses?search={query}&day={day}&time={time}&category={category}
 * - Search functionality: Implement debounced search to filter courses by name, professor, department
 * - Filters: Apply backend filtering for days, times, and categories
 * - Sorting: Implement sorting by rating, hours/week, class size
 * - Pagination: Add pagination if course list is large
 */

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

const CoursesPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('Spring 2026');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('Rating');

  // TODO: Replace with actual API call to fetch courses
  const mockCourses: Course[] = [
    {
      id: '1',
      code: 'CS 2201',
      name: 'Program Design & Data Structures',
      professor: 'Dr. Jeremy Bolton',
      schedule: 'MWF 10:10-11:00a',
      location: 'FGH 134',
      avgHoursWeek: 8.5,
      effortLevel: 4.2,
      classSize: '45',
      rating: 4.2,
      difficulty: 'Hard',
      tags: ['Exam Heavy', 'Project Heavy', 'Discussion-based'],
    },
    {
      id: '2',
      code: 'ECON 1010',
      name: 'Principles of Macroeconomics',
      professor: 'Dr. Sarah Chen',
      schedule: 'TTh 11:00-12:15p',
      location: 'Calhoun 109',
      avgHoursWeek: 4.2,
      effortLevel: 3.1,
      classSize: '120',
      rating: 4.6,
      difficulty: 'Time Consuming',
      tags: ['Exam Heavy', 'Papers'],
    },
    {
      id: '3',
      code: 'PHIL 1500',
      name: 'Ethics and the Modern World',
      professor: 'Dr. Michael Webb',
      schedule: 'MWF 1:10-2:00p',
      location: 'Stevenson 3210',
      avgHoursWeek: 3.5,
      effortLevel: 2.3,
      classSize: '25',
      rating: 4.8,
      difficulty: 'Easy',
      tags: ['Discussion-based', 'Papers'],
    },
  ];

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
              <option>Spring 2026</option>
              <option>Fall 2025</option>
              <option>Summer 2025</option>
            </select>
            <select
              className="department-select"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
            >
              <option>All Departments</option>
              <option>Computer Science</option>
              <option>Economics</option>
              <option>Philosophy</option>
              <option>Mathematics</option>
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
              Showing <span className="count-number">{mockCourses.length}</span> courses
            </div>
            <div className="sort-container">
              <label htmlFor="sort-select">Sort by:</label>
              <select
                id="sort-select"
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option>Rating ↓</option>
                <option>Avg Hours/Week</option>
                <option>Class Size</option>
              </select>
            </div>
          </div>

          {/* Course Cards */}
          <div className="courses-list">
            {mockCourses.map((course, index) => (
              <Link to={`/course/${course.id}`} key={course.id} className="course-card">
                <div className="course-number">#{index + 1}</div>
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
                    {course.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="course-stats">
                  <div className="stat">
                    <div className="stat-value">{course.avgHoursWeek}</div>
                    <div className="stat-label">AVG HRS/WEEK</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{course.effortLevel}</div>
                    <div className="stat-label">EFFORT LEVEL</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{course.classSize}</div>
                    <div className="stat-label">CLASS SIZE</div>
                  </div>
                  <div className="stat rating-stat">
                    <div className="stat-value">⭐ {course.rating}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursesPage;
