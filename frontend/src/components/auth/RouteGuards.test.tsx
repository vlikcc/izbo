import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProtectedRoute, RoleRoute } from './RouteGuards';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

const admin: User = {
    id: 'a1',
    email: 'admin@test.local',
    firstName: 'Sys',
    lastName: 'Admin',
    role: 'SuperAdmin',
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
};

const student: User = { ...admin, id: 's1', role: 'Student' };

function setAuth(state: Partial<ReturnType<typeof useAuthStore.getState>>) {
    useAuthStore.setState(state);
}

/** Renders the guard at /app/admin with somewhere recognisable to be redirected to. */
function renderGuarded(element: React.ReactElement) {
    return render(
        <MemoryRouter initialEntries={['/app/admin']}>
            <Routes>
                <Route path="/app/admin" element={element} />
                <Route path="/app" element={<div>dashboard</div>} />
                <Route path="/login" element={<div>login</div>} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('RoleRoute', () => {
    beforeEach(() => {
        setAuth({ user: null, isAuthenticated: false, isInitialized: false, isLoading: false });
    });

    it('waits instead of redirecting while the session is still being resolved', () => {
        // The regression: on a hard load isAuthenticated is seeded from the stored token but user is
        // still null, so the guard used to redirect before checkAuth had a chance to run.
        setAuth({ user: null, isAuthenticated: true, isInitialized: false });

        renderGuarded(<RoleRoute roles={['SuperAdmin']}><div>admin page</div></RoleRoute>);

        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('login')).not.toBeInTheDocument();
    });

    it('renders the page once the profile has loaded with a permitted role', () => {
        setAuth({ user: admin, isAuthenticated: true, isInitialized: true });

        renderGuarded(<RoleRoute roles={['Admin', 'SuperAdmin']}><div>admin page</div></RoleRoute>);

        expect(screen.getByText('admin page')).toBeInTheDocument();
    });

    it('sends a signed-in user without the role to the dashboard', () => {
        setAuth({ user: student, isAuthenticated: true, isInitialized: true });

        renderGuarded(<RoleRoute roles={['Admin', 'SuperAdmin']}><div>admin page</div></RoleRoute>);

        expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    it('sends a visitor with no session to login rather than bouncing them off the dashboard', () => {
        setAuth({ user: null, isAuthenticated: false, isInitialized: true });

        renderGuarded(<RoleRoute roles={['SuperAdmin']}><div>admin page</div></RoleRoute>);

        expect(screen.getByText('login')).toBeInTheDocument();
    });
});

describe('ProtectedRoute', () => {
    beforeEach(() => {
        setAuth({ user: null, isAuthenticated: false, isInitialized: false, isLoading: false });
    });

    it('waits while the session is still being resolved', () => {
        setAuth({ isAuthenticated: true, isInitialized: false });

        renderGuarded(<ProtectedRoute><div>private page</div></ProtectedRoute>);

        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders once a session is confirmed', () => {
        setAuth({ user: student, isAuthenticated: true, isInitialized: true });

        renderGuarded(<ProtectedRoute><div>private page</div></ProtectedRoute>);

        expect(screen.getByText('private page')).toBeInTheDocument();
    });

    it('redirects to login when the session turned out to be invalid', () => {
        setAuth({ user: null, isAuthenticated: false, isInitialized: true });

        renderGuarded(<ProtectedRoute><div>private page</div></ProtectedRoute>);

        expect(screen.getByText('login')).toBeInTheDocument();
    });
});
