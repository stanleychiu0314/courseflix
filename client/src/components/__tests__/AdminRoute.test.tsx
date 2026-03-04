import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from '../AdminRoute';
import * as AuthContext from '../../context/AuthContext';

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
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>admin panel</div>
            </AdminRoute>
          }
        />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/courses" element={<div>courses page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => vi.restoreAllMocks());

describe('AdminRoute', () => {
  it('shows a loading indicator while auth is being checked', () => {
    renderRoute({ isLoading: true });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderRoute({ isAuthenticated: false });
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('admin panel')).not.toBeInTheDocument();
  });

  it('redirects to /courses when authenticated but not admin', () => {
    renderRoute({ isAuthenticated: true, isAdmin: false });
    expect(screen.getByText('courses page')).toBeInTheDocument();
    expect(screen.queryByText('admin panel')).not.toBeInTheDocument();
  });

  it('renders children when the user is an admin', () => {
    renderRoute({ isAuthenticated: true, isAdmin: true });
    expect(screen.getByText('admin panel')).toBeInTheDocument();
  });
});
