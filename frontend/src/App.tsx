import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { MainLayout } from './components/layout';
import { LandingPage } from './pages/landing';
import { LoginPage, RegisterPage } from './pages/auth';
import { ClassroomsPage, ClassroomDetailPage } from './pages/classrooms';
import { ExamsPage } from './pages/exams';
import { ExamBuilderPage } from './pages/exams/ExamBuilderPage';
import { LiveQuizPresenterPage } from './pages/exams/LiveQuizPresenterPage';
import { LiveQuizVoterPage } from './pages/exams/LiveQuizVoterPage';
import { HomeworkPage } from './pages/homework';
import LivePage from './pages/live/LivePage';
import CustomLiveRoomPage from './pages/live/CustomLiveRoomPage';
import { ProfilePage } from './pages/profile';
import './index.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected Application Routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/classrooms" replace />} />
          <Route path="classrooms" element={<ClassroomsPage />} />
          <Route path="classrooms/:id" element={<ClassroomDetailPage />} />
          <Route path="homework" element={<HomeworkPage />} />
          <Route path="exams" element={<ExamsPage />} />
          <Route path="exams/:id/builder" element={<ExamBuilderPage />} />
          <Route path="live" element={<LivePage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Full Screen Live Room (No Layout) */}
        <Route
          path="/live/:sessionId"
          element={
            <ProtectedRoute>
              <CustomLiveRoomPage />
            </ProtectedRoute>
          }
        />

        {/* Live Quiz Routes (Full Screen) */}
        <Route
          path="/quiz/presenter/:id"
          element={
            <ProtectedRoute>
              <LiveQuizPresenterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quiz/join/:code?"
          element={
            <ProtectedRoute>
              <LiveQuizVoterPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
