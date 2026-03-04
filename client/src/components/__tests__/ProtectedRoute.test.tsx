import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import * as AuthContext from '../../context/AuthContext';

// Helper: render ProtectedRoute with a controlled auth state
function renderRoute(authState: Partial<ReturnType<typeof AuthContext.useAuth>>) {
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isLoading: false,
    cartCount: 0,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
    refreshCartCount: vi.fn(),
    ...authState,
  });

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute>
              <div>secret content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.restoreAllMocks());

describe('ProtectedRoute', () => {
  it('shows a loading indicator while auth is being checked', () => {
    renderRoute({ isLoading: true });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /login when the user is not authenticated', () => {
    renderRoute({ isAuthenticated: false });
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders children when the user is authenticated', () => {
    renderRoute({ isAuthenticated: true });
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
