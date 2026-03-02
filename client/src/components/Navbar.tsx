import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';

/**
 * Navbar Component
 *
 * Main navigation bar for the application.
 * Displays logo, navigation links, and user avatar or login button.
 */

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout, cartCount } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    setIsDropdownOpen(false);
    navigate('/courses');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleCartClick = () => {
    navigate('/schedule');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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
          {isAdmin && (
            <Link
              to="/admin/syllabi"
              className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
            >
              Admin
            </Link>
          )}
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
              <div className="cart-info" onClick={handleCartClick}>
                🛒 {cartCount} courses
              </div>
              <div className="user-menu" ref={dropdownRef}>
                <div className="user-avatar" onClick={toggleDropdown} title="Click for menu">
                  {user?.initials || 'U'}
                </div>
                {isDropdownOpen && (
                  <div className="user-dropdown">
                    <div className="dropdown-item" onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}>
                      View Profile
                    </div>
                    <div className="dropdown-item logout-item" onClick={handleLogout}>
                      Log Out
                    </div>
                  </div>
                )}
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
