import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
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
  const [selectedSemester, setSelectedSemester] = useState('Spring 2026');
  const [cartCourses, setCartCourses] = useState<ScheduleCourse[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);

  // For now, we'll use a placeholder userId since auth isn't implemented
  // In production, this would come from an auth context
  const userId = localStorage.getItem('userId') || null;

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

      // If no userId, show empty schedule (user not logged in)
      if (!userId) {
        setCartCourses([]);
        setLoading(false);
        return;
      }

      try {
        const params = new URLSearchParams();
        params.append('term', selectedSemester);
        params.append('userId', userId);

        const response = await fetch(`${API_BASE_URL}/api/schedule?${params.toString()}`);
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
  }, [selectedSemester, userId]);

  const handleRemoveCourse = async (sectionId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule/${sectionId}?userId=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setCartCourses(cartCourses.filter(c => c.id !== sectionId));
      }
    } catch (err) {
      console.error('Error removing course:', err);
    }
  };

  const semesters = terms.length > 0 ? terms.map(t => t.label) : ['Fall 2025', 'Spring 2026', 'Summer 2026', 'Fall 2026'];

  const timeSlots = [
    '8:00 AM',
    '9:00 AM',
    '10:00 AM',
    '11:00 AM',
    '12:00 PM',
    '1:00 PM',
    '2:00 PM',
    '3:00 PM',
    '4:00 PM',
  ];

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  const getCoursesForSlot = (day: string, time: string) => {
    const hour = parseInt(time.split(':')[0]);
    const adjustedHour = time.includes('PM') && hour !== 12 ? hour + 12 : hour;

    return cartCourses.filter((course) => {
      const dayMatch =
        course.day.includes(day.substring(0, 1)) ||
        (day === 'Tue' && course.day.includes('T') && !course.day.includes('Th')) ||
        (day === 'Thu' && course.day.includes('Th'));
      const startHour = parseInt(course.startTime.split(':')[0]);
      return dayMatch && startHour === adjustedHour;
    });
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    const start = parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60;
    const end = parseInt(endTime.split(':')[0]) + parseInt(endTime.split(':')[1]) / 60;
    return end - start;
  };

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
          <div className="schedule-actions">
            <button className="action-btn export-btn">📥 Export</button>
            <button className="action-btn share-btn">🔗 Share</button>
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

              {/* Time Slots */}
              {timeSlots.map((time) => (
                <div key={time} className="time-row">
                  <div className="time-label">{time}</div>
                  {daysOfWeek.map((day) => {
                    const courses = getCoursesForSlot(day, time);
                    return (
                      <div key={`${day}-${time}`} className="time-slot">
                        {courses.map((course) => (
                          <div
                            key={course.id}
                            className="course-block"
                            style={{
                              background: course.color,
                              height: `${calculateDuration(course.startTime, course.endTime) * 60}px`,
                            }}
                          >
                            <div className="course-block-code">{course.code}</div>
                            <div className="course-block-name">{course.name}</div>
                            <div className="course-block-prof">{course.professor}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar - Cart Courses */}
          <div className="courses-sidebar">
            <div className="sidebar-section">
              <h3 className="sidebar-title">
                🛒 IN CART ({loading ? '...' : cartCourses.length})
              </h3>
              <div className="course-list">
                {cartCourses.map((course) => (
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
                      {course.day} {course.startTime.substring(0, 5)}-{course.endTime.substring(0, 5)}
                    </div>
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

export default SchedulePage;
