import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from '../Navbar';
import * as AuthContext from '../../context/AuthContext';

function renderNavbar(authState: Partial<ReturnType<typeof AuthContext.useAuth>>) {
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
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  );
}

beforeEach(() => vi.restoreAllMocks());

describe('Navbar', () => {
  it('shows a Login link when the user is not authenticated', () => {
    renderNavbar({ isAuthenticated: false });
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument();
    expect(screen.queryByText(/courses/i, { selector: '.cart-info' })).not.toBeInTheDocument();
  });

  it('shows the cart and user initials when authenticated', () => {
    renderNavbar({
      isAuthenticated: true,
      user: { id: '1', email: 'test@vanderbilt.edu', name: 'Jane Doe', initials: 'JD', isAdmin: false },
      cartCount: 3,
    });

    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText(/3 courses/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /login/i })).not.toBeInTheDocument();
  });

  it('always shows the core nav links', () => {
    renderNavbar({});
    expect(screen.getByRole('link', { name: /courses/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /about/i })).toBeInTheDocument();
  });

  it('shows the Admin link only for admins', () => {
    renderNavbar({ isAuthenticated: true, isAdmin: true });
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument();
  });

  it('hides the Admin link for non-admins', () => {
    renderNavbar({ isAuthenticated: true, isAdmin: false });
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });
});
