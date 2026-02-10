import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import '../styles/SchedulePage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ScheduleCourse {
  id: string;
  code: string;
  name: string;
  professor: string;
  day: string;
  startTime: string;
  endTime: string;
  color: string;
}

interface Term {
  id: string;
  label: string;
}

const SchedulePage: React.FC = () => {
  const { isAuthenticated, refreshCartCount } = useAuth();
  const [selectedSemester, setSelectedSemester] = useState('Spring 2026');
  const [cartCourses, setCartCourses] = useState<ScheduleCourse[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch terms on mount
  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/terms`);
        if (response.ok) {
          const data = await response.json();
          setTerms(data);
          if (data.length > 0) {
            setSelectedSemester(data[0].label);
          }
        }
      } catch (err) {
        console.error('Error fetching terms:', err);
      }
    };

    fetchTerms();
  }, []);

  // Fetch schedule courses when semester changes
  useEffect(() => {
    const fetchSchedule = async () => {
      setLoading(true);

      // If not authenticated, show empty schedule
      if (!isAuthenticated) {
        setCartCourses([]);
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.append('term', selectedSemester);

        const response = await fetch(`${API_BASE_URL}/api/schedule?${params.toString()}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setCartCourses(data);
        }
      } catch (err) {
        console.error('Error fetching schedule:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedSemester, isAuthenticated]);

  const handleRemoveCourse = async (sectionId: string) => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/${sectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setCartCourses(cartCourses.filter(c => c.id !== sectionId));
        await refreshCartCount();
      }
    } catch (err) {
      console.error('Error removing course:', err);
    }
  };

  const semesters = terms.length > 0 ? terms.map(t => t.label) : ['Fall 2025', 'Spring 2026', 'Summer 2026', 'Fall 2026'];

  const HOUR_HEIGHT = 60; // pixels per hour
  const START_HOUR = 8;
  const END_HOUR = 21; // 9 PM
  const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const snapToQuarter = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    const snapped = Math.round(m / 15) * 15;
    if (snapped === 60) return { hours: h + 1, minutes: 0 };
    return { hours: h, minutes: snapped };
  };

  const getTopPosition = (timeStr: string) => {
    const t = snapToQuarter(timeStr);
    return (t.hours - START_HOUR) * HOUR_HEIGHT + (t.minutes / 60) * HOUR_HEIGHT;
  };

  const getBlockHeight = (startTime: string, endTime: string) => {
    return getTopPosition(endTime) - getTopPosition(startTime);
  };

  const getCoursesForDay = (day: string) => {
    return cartCourses.filter(c => c.day === day);
  };

  const formatHour = (hour: number) => {
    if (hour === 12) return '12 PM';
    if (hour > 12) return `${hour - 12} PM`;
    return `${hour} AM`;
  };

  const getOverlapInfo = (course: ScheduleCourse, dayCourses: ScheduleCourse[]) => {
    const courseTop = getTopPosition(course.startTime);
    const courseBottom = courseTop + getBlockHeight(course.startTime, course.endTime);
    const overlapping = dayCourses.filter(c => {
      const cTop = getTopPosition(c.startTime);
      const cBottom = cTop + getBlockHeight(c.startTime, c.endTime);
      return cTop < courseBottom && courseTop < cBottom;
    });
    const index = overlapping.indexOf(course);
    return { count: overlapping.length, index };
  };

  // Deduplicate courses by section id for the sidebar
  const uniqueCourses = cartCourses.filter(
    (course, index, self) => index === self.findIndex(c => c.id === course.id)
  );

  return (
    <div className="schedule-page">
      <Navbar />

      <div className="schedule-container">
        <div className="schedule-header">
          <div className="schedule-title-section">
            <h1 className="schedule-title">My Schedule</h1>
            <select
              className="semester-select"
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
            >
              {semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="schedule-main">
          {/* Calendar Grid */}
          <div className="calendar-section">
            <div className="calendar-grid">
              {/* Header Row */}
              <div className="calendar-header">
                <div className="time-column-header"></div>
                {daysOfWeek.map((day) => (
                  <div key={day} className="day-header">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Body */}
              <div className="calendar-body" style={{ height: TOTAL_HEIGHT }}>
                <div className="time-labels-column">
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="hour-label"
                      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                    >
                      {formatHour(hour)}
                    </div>
                  ))}
                </div>

                {daysOfWeek.map((day) => {
                  const dayCourses = getCoursesForDay(day);
                  return (
                    <div key={day} className="day-column" style={{ backgroundSize: `100% ${HOUR_HEIGHT}px` }}>
                      {dayCourses.map((course, idx) => {
                        const { count, index } = getOverlapInfo(course, dayCourses);
                        const blockHeight = getBlockHeight(course.startTime, course.endTime);
                        const isShort = blockHeight <= 55;
                        return (
                          <div
                            key={`${course.id}-${idx}`}
                            className={`course-block ${isShort ? 'course-block-short' : ''}`}
                            style={{
                              top: getTopPosition(course.startTime),
                              height: blockHeight,
                              background: course.color,
                              left: `${(index / count) * 100}%`,
                              width: `${100 / count}%`,
                            }}
                          >
                            {isShort ? (
                              <div className="course-block-inline">
                                <span className="course-block-code">{course.code}</span>
                                <span className="course-block-name">{course.name}</span>
                                <span className="course-block-prof">{course.professor}</span>
                              </div>
                            ) : (
                              <>
                                <div className="course-block-code">{course.code}</div>
                                <div className="course-block-name">{course.name}</div>
                                <div className="course-block-prof">{course.professor}</div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar - Cart Courses */}
          <div className="courses-sidebar">
            <div className="sidebar-section">
              <h3 className="sidebar-title">
                🛒 IN CART ({loading ? '...' : uniqueCourses.length})
              </h3>
              <div className="course-list">
                {uniqueCourses.map((course) => {
                  const meetings = cartCourses.filter(c => c.id === course.id);
                  const days = [...new Set(meetings.map(m => m.day))].join(', ');
                  return (
                    <div key={course.id} className="sidebar-course-card" style={{ borderLeftColor: course.color }}>
                      <div className="sidebar-course-header">
                        <span className="sidebar-course-code">{course.code}</span>
                        <button
                          className="remove-btn"
                          title="Remove course"
                          onClick={() => handleRemoveCourse(course.id)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="sidebar-course-name">{course.name}</div>
                      <div className="sidebar-course-prof">{course.professor}</div>
                      <div className="sidebar-course-time">
                        {days} {course.startTime}-{course.endTime}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchedulePage;
