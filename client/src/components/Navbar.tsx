import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Navbar Component
 *
 * Main navigation bar for the application.
 * Displays logo, navigation links, and user avatar or login button.
 */

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [enrolledCount, setEnrolledCount] = useState(0);

  // Fetch cart count when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchCartCount = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/schedule/count`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            setEnrolledCount(data.count || 0);
          }
        } catch (error) {
          console.error('Error fetching cart count:', error);
        }
      };
      fetchCartCount();
    }
  }, [isAuthenticated, user]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/courses');
  };

  return (
    <header className="navbar">
      <div className="navbar-content">
        <Link to="/" className="logo-container">
          <div className="logo">V</div>
          <div className="brand">
            <div className="brand-name">CourseFlix</div>
            <div className="brand-subtitle">VANDERBILT</div>
          </div>
        </Link>

        <nav className="nav-links">
          <Link
            to="/courses"
            className={`nav-link ${isActive('/courses') ? 'active' : ''}`}
          >
            Courses
          </Link>
          <Link
            to="/schedule"
            className={`nav-link ${isActive('/schedule') ? 'active' : ''}`}
          >
            My Schedule
          </Link>
          <Link
            to="/feedback"
            className={`nav-link ${isActive('/feedback') ? 'active' : ''}`}
          >
            Feedback
          </Link>
          <Link
            to="/about"
            className={`nav-link ${isActive('/about') ? 'active' : ''}`}
          >
            About
          </Link>
        </nav>

        <div className="navbar-right">
          {isAuthenticated ? (
            <>
              <div className="cart-info">
                🛒 {enrolledCount} courses
              </div>
              <div className="user-avatar" onClick={handleLogout} title="Click to logout">
                {user?.initials || 'U'}
              </div>
            </>
          ) : (
            <Link to="/login" className="login-btn">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
