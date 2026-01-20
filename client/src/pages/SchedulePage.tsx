import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import '../styles/SchedulePage.css';

/**
 * SchedulePage Component
 *
 * Displays user's schedule in a calendar view with enrolled and cart courses.
 *
 * Backend Integration:
 * - Fetch enrolled courses: GET /api/users/:userId/enrolled
 * - Fetch cart courses: GET /api/users/:userId/cart
 * - Remove from enrolled: DELETE /api/users/:userId/enrolled/:courseId
 * - Remove from cart: DELETE /api/users/:userId/cart/:courseId
 * - Enroll in course: POST /api/users/:userId/enroll with { courseId }
 * - Export schedule: GET /api/users/:userId/schedule/export?format={pdf|ics}
 */

interface ScheduleCourse {
  id: string;
  code: string;
  name: string;
  professor: string;
  day: string;
  startTime: string;
  endTime: string;
  color: string;
  status: 'enrolled' | 'cart' | 'waitlist';
}

const SchedulePage: React.FC = () => {
  const [selectedSemester, setSelectedSemester] = useState('Spring 2026');

  // TODO: Replace with actual API call to fetch user's schedule
  const enrolledCourses: ScheduleCourse[] = [
    {
      id: '1',
      code: 'CS 2201',
      name: 'Program Design',
      professor: 'Dr. Bolton',
      day: 'MWF',
      startTime: '10:00',
      endTime: '11:00',
      color: '#8B7FD9',
      status: 'enrolled',
    },
    {
      id: '2',
      code: 'ECON 1010',
      name: 'Principles of Ma...',
      professor: 'Dr. Chen',
      day: 'TTh',
      startTime: '11:00',
      endTime: '12:15',
      color: '#5FD9A8',
      status: 'enrolled',
    },
    {
      id: '3',
      code: 'PHIL 1500',
      name: 'Ethics & Modern...',
      professor: 'Dr. Webb',
      day: 'MWF',
      startTime: '13:00',
      endTime: '14:00',
      color: '#D9A25F',
      status: 'enrolled',
    },
    {
      id: '4',
      code: 'MATH 2300',
      name: 'Multivariable Ca...',
      professor: 'Dr. Park',
      day: 'MWF',
      startTime: '14:00',
      endTime: '15:00',
      color: '#D95F5F',
      status: 'enrolled',
    },
  ];

  const cartCourses: ScheduleCourse[] = [
    {
      id: '5',
      code: 'PSYC 1200',
      name: 'Psychology',
      professor: '',
      day: 'MWF',
      startTime: '16:00',
      endTime: '17:00',
      color: '#F9D66D',
      status: 'cart',
    },
    {
      id: '6',
      code: 'ASTR 1010',
      name: 'Astronomy',
      professor: '',
      day: 'TTh',
      startTime: '09:35',
      endTime: '10:50',
      color: '#A9D9F9',
      status: 'waitlist',
    },
  ];

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

    return enrolledCourses.filter((course) => {
      const dayMatch = course.day.includes(day.substring(0, 1)) ||
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
            <p className="schedule-subtitle">{selectedSemester}</p>
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

          {/* Sidebar - Course Lists */}
          <div className="courses-sidebar">
            {/* Enrolled Courses */}
            <div className="sidebar-section">
              <h3 className="sidebar-title">✓ ENROLLED ({enrolledCourses.length})</h3>
              <div className="course-list">
                {enrolledCourses.map((course) => (
                  <div key={course.id} className="sidebar-course-card" style={{ borderLeftColor: course.color }}>
                    <div className="sidebar-course-header">
                      <span className="sidebar-course-code">{course.code}</span>
                      <button className="remove-btn" title="Remove course">
                        ×
                      </button>
                    </div>
                    <div className="sidebar-course-prof">{course.professor}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Courses */}
            <div className="sidebar-section">
              <h3 className="sidebar-title">🛒 IN CART ({cartCourses.length})</h3>
              <div className="course-list">
                {cartCourses.map((course) => (
                  <div key={course.id} className="sidebar-course-card" style={{ borderLeftColor: course.color }}>
                    <div className="sidebar-course-header">
                      <span className="sidebar-course-code">{course.code}</span>
                      <span className={`status-badge ${course.status}`}>
                        {course.status === 'waitlist' ? 'WAITLIST' : 'AVAILABLE'}
                      </span>
                    </div>
                    <div className="sidebar-course-time">{course.day} {course.startTime.substring(0, 5)}-{course.endTime.substring(0, 5)}</div>
                    <button className="enroll-btn">Enroll</button>
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
