import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { User } from '../../types';

/**
 * Shown while the session is being resolved. Both guards render this rather than deciding, because a
 * decision taken before `checkAuth` settles is a decision taken without knowing who the user is.
 */
export const AuthPending = () => (
    <div className="flex h-screen items-center justify-center" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        <span className="sr-only">Yükleniyor</span>
    </div>
);

/** Requires a session. Sends the visitor to the login page, remembering where they were headed. */
export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const location = useLocation();

    if (!isInitialized) {
        return <AuthPending />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};

/**
 * Requires one of `roles`.
 *
 * The role lives on `user`, which is null until the profile has been fetched. Treating that null as
 * "not permitted" bounced anyone who opened a role-guarded page directly — or simply reloaded one —
 * to the dashboard, because the redirect ran on the first render, before `checkAuth` had returned.
 * Waiting for `isInitialized` is what makes a deep link work.
 */
export const RoleRoute = ({
    children,
    roles,
}: {
    children: ReactNode;
    roles: User['role'][];
}) => {
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const location = useLocation();

    if (!isInitialized) {
        return <AuthPending />;
    }

    // No session at all is a login problem, not an authorisation one; sending these to the dashboard
    // would just bounce them again from the route guard there.
    if (!isAuthenticated || !user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!roles.includes(user.role)) {
        return <Navigate to="/app" replace />;
    }

    return <>{children}</>;
};
