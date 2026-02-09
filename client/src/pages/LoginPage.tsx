import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import { useAuth } from '../context/AuthContext';
import '../styles/LoginPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msalReady, setMsalReady] = useState(false);

  // Get the page user was trying to access before being redirected to login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/courses';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const msalInstance = useMemo(() => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined;
    const redirectUri = (import.meta.env.VITE_MICROSOFT_REDIRECT_URI as string | undefined)
      || `${window.location.origin}/login`;

    if (!clientId) {
      return null;
    }

    return new PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/common',
        redirectUri,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    });
  }, []);

  useEffect(() => {
    if (!msalInstance) {
      setErrorMessage('Missing VITE_MICROSOFT_CLIENT_ID in the frontend environment.');
      return;
    }

    let mounted = true;

    (async () => {
      try {
        await msalInstance.initialize();
        const result = await msalInstance.handleRedirectPromise();
        console.log('[Auth] MSAL redirect result:', result ? 'Got token' : 'No token');
        if (result?.idToken) {
          console.log('[Auth] Sending idToken to backend...');
          const response = await fetch(`${API_BASE_URL}/api/auth/microsoft/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ idToken: result.idToken }),
          });

          console.log('[Auth] Backend response status:', response.status);
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            console.error('[Auth] Backend error:', data);
            throw new Error(data.message || 'Login failed');
          }

          const data = await response.json();
          console.log('[Auth] Backend success, user:', data.user);
          if (data.user) {
            login(data.user);
            console.log('[Auth] Called login(), navigating to:', from);
          }

          navigate(from, { replace: true });
          return;
        }
        if (mounted) {
          setMsalReady(true);
        }
      } catch (error) {
        console.error('[Auth] Microsoft redirect error', error);
        if (mounted) {
          setErrorMessage('Microsoft login failed. Please try again.');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [msalInstance, login, from, navigate]);

  const handleMicrosoftLogin = async () => {
    if (!msalInstance) {
      setErrorMessage('Microsoft login is not configured on this frontend.');
      return;
    }

    if (!msalReady) {
      setErrorMessage('Microsoft login is still initializing. Please try again in a moment.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await msalInstance.loginRedirect({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
        prompt: 'select_account',
      });
    } catch (error) {
      console.error('Microsoft login error', error);
      setErrorMessage('Microsoft login failed. Please use a @vanderbilt.edu account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo-section">
          <div className="login-logo">V</div>
          <div className="login-brand-name">CourseFlix</div>
          <div className="login-brand-subtitle">VANDERBILT</div>
        </div>

        <div className="login-card">
          <h1 className="login-title">Sign In</h1>
          <p className="login-subtitle">Use your Vanderbilt Microsoft account to continue.</p>

          <div className="oauth-buttons">
            <button
              className="oauth-btn google-btn"
              onClick={handleMicrosoftLogin}
              disabled={isSubmitting}
            >
              <span className="oauth-icon">🔵</span>
              {isSubmitting ? 'Signing In...' : 'Continue with Microsoft'}
            </button>
          </div>

          {errorMessage && <p className="login-error">{errorMessage}</p>}
        </div>

        <div className="login-footer">
          <p>Only Vanderbilt emails are permitted.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
