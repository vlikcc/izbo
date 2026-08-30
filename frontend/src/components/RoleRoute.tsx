import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';

interface RoleRouteProps {
    roles: Array<User['role']>;
    children: React.ReactNode;
}

// Gates a route by role, on top of the outer ProtectedRoute's auth check.
export const RoleRoute: React.FC<RoleRouteProps> = ({ roles, children }) => {
    const { user } = useAuthStore();

    if (!user || !roles.includes(user.role)) {
        return <Navigate to="/app" replace />;
    }

    return <>{children}</>;
};

export default RoleRoute;
