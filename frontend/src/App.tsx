import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout';
import { LandingPage } from './pages/landing';
import { LoginPage, RegisterPage } from './pages/auth';
import { DashboardPage } from './pages/dashboard';
import { ClassroomsPage } from './pages/classrooms';
import { ExamsPage } from './pages/exams';
import { HomeworkPage } from './pages/homework';
import { LivePage } from './pages/live';
import { ProfilePage } from './pages/profile';
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <span>Yükleniyor...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route (redirect if authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page - Public */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="classrooms" element={<ClassroomsPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="homework" element={<HomeworkPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Legacy redirects */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/classrooms" element={<Navigate to="/app/classrooms" replace />} />
        <Route path="/exams" element={<Navigate to="/app/exams" replace />} />
        <Route path="/homework" element={<Navigate to="/app/homework" replace />} />
        <Route path="/live" element={<Navigate to="/app/live" replace />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />

        {/* Catch all - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
