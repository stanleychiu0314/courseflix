import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';

/**
 * Navbar Component
 *
 * Main navigation bar for the application.
 * Displays logo, navigation links, and user avatar.
 *
 * Backend Integration:
 * - User avatar initials: Fetch from authenticated user context/state
 * - Course count: Fetch from user's cart/enrolled courses count
 * - Navigation links: Update based on user authentication status
 */

const Navbar: React.FC = () => {
  const location = useLocation();

  // TODO: Replace with actual user data from authentication context
  const userInitials = 'SC';
  const enrolledCount = 3;

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="navbar">
      <div className="navbar-content">
        <Link to="/" className="logo-container">
          <div className="logo">V</div>
          <div className="brand">
            <div className="brand-name">OpenDore</div>
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
          <div className="cart-info">
            🛒 {enrolledCount} courses
          </div>
          <div className="user-avatar">{userInitials}</div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
