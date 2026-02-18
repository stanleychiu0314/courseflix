import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import CoursesPage from './pages/CoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import SchedulePage from './pages/SchedulePage';
import FeedbackPage from './pages/FeedbackPage';
import LoginPage from './pages/LoginPage';
import AboutPage from './pages/AboutPage';
import ProfilePage from './pages/ProfilePage';
import AdminSyllabiPage from './pages/AdminSyllabiPage';

/**
 * App Component
 *
 * Main application component with routing configuration.
 */

// Check if URL contains MSAL redirect response (hash with code/id_token)
const hasMsalResponse = () => {
  const hash = window.location.hash;
  return hash.includes('code=') || hash.includes('id_token=') || hash.includes('error=');
};

// Root redirect component - handles MSAL redirect or goes to courses
const RootRedirect: React.FC = () => {
  // If there's an MSAL response in the URL, redirect to login to process it
  if (hasMsalResponse()) {
    return <Navigate to={`/login${window.location.hash}`} replace />;
  }
  return <Navigate to="/courses" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Root - check for MSAL response or redirect to courses */}
          <Route path="/" element={<RootRedirect />} />

          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/course/:courseId" element={<CourseDetailPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Protected routes - require authentication */}
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <SchedulePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback"
            element={
              <ProtectedRoute>
                <FeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/syllabi"
            element={
              <AdminRoute>
                <AdminSyllabiPage />
              </AdminRoute>
            }
          />

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
    </AuthProvider>
  );
}

export default App;
