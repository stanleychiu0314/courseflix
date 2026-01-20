import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';

/**
 * LoginPage Component
 *
 * Authentication page with email/password and OAuth options.
 *
 * Backend Integration:
 * - Email/Password login: POST /api/auth/login with { email, password }
 * - Google OAuth: GET /api/auth/google (redirect to Google OAuth)
 * - GitHub OAuth: GET /api/auth/github (redirect to GitHub OAuth)
 * - Sign up: POST /api/auth/signup with { email, password, name }
 * - Store JWT token in localStorage/cookies after successful authentication
 * - Redirect to /courses after successful login
 */

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement email/password login
    console.log('Email login:', { email, password });
    // After successful login, navigate to courses
    navigate('/courses');
  };

  const handleGoogleLogin = () => {
    // TODO: Redirect to Google OAuth
    console.log('Google login');
    window.location.href = '/api/auth/google';
  };

  const handleGitHubLogin = () => {
    // TODO: Redirect to GitHub OAuth
    console.log('GitHub login');
    window.location.href = '/api/auth/github';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo Section */}
        <div className="login-logo-section">
          <div className="login-logo">V</div>
          <div className="login-brand-name">CourseFlix</div>
          <div className="login-brand-subtitle">VANDERBILT</div>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in to continue to CourseFlix</p>

          {/* OAuth Buttons */}
          <div className="oauth-buttons">
            <button className="oauth-btn google-btn" onClick={handleGoogleLogin}>
              <span className="oauth-icon">🔵</span>
              Continue with Google
            </button>
            <button className="oauth-btn github-btn" onClick={handleGitHubLogin}>
              <span className="oauth-icon">⚫</span>
              Continue with GitHub
            </button>
          </div>

          <div className="divider">
            <span>or</span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder="your.email@vanderbilt.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-submit-btn">
              Sign In
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="signup-section">
            Don't have an account?{' '}
            <button className="signup-link" onClick={() => setIsSignUp(!isSignUp)}>
              Sign up
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>By signing in, you agree to our Terms of Service and Privacy Policy</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
