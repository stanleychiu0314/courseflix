import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import SchedulePage from './pages/SchedulePage';
import FeedbackPage from './pages/FeedbackPage';
import LoginPage from './pages/LoginPage';
import AboutPage from './pages/AboutPage';

/**
 * App Component
 *
 * Main application component with routing configuration.
 *
 * Routes:
 * - / - Redirects to /courses
 * - /login - Login/authentication page
 * - /courses - Course listing page
 * - /course/:courseId - Individual course detail page
 * - /schedule - User's schedule page
 * - /feedback - Feedback submission form
 * - /about - About page (to be implemented)
 *
 * Backend Integration:
 * - Add authentication check: Use context/state to check if user is authenticated
 * - Protected routes: Wrap routes that require authentication
 * - User context: Create AuthContext to manage user state across the app
 */

function App() {
  // TODO: Add authentication state management
  // const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Routes>
        {/* Redirect root to courses */}
        <Route path="/" element={<Navigate to="/courses" replace />} />

        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />

        {/* Main app routes */}
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/course/:courseId" element={<CourseDetailPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />

        {/* About page */}
        <Route path="/about" element={<AboutPage />} />

        {/* 404 page */}
        <Route
          path="*"
          element={
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h1>404 - Page Not Found</h1>
              <p>The page you're looking for doesn't exist.</p>
              <a href="/courses" style={{ color: '#C4B084' }}>
                Go back to courses
              </a>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
