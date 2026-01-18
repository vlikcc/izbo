import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Sidebar } from './components/common/Sidebar';
import { LoginPage, RegisterPage, ForgotPasswordPage } from './pages/auth/AuthPages';
import { VerifyEmailPage, ResendVerificationPage, PendingVerificationPage } from './pages/auth/VerifyEmailPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { ExamSessionPage } from './pages/exam/ExamSessionPage';
import { CreateExamPage } from './pages/exam/CreateExamPage';
import { ExamListPage } from './pages/exam/ExamListPage';
import { ExamDetailPage } from './pages/exam/ExamDetailPage';
import { ClassroomListPage, ClassroomDetailPage } from './pages/classroom/ClassroomPages';
import { JoinClassroomPage } from './pages/classroom/JoinClassroomPage';
import { CreateClassroomPage } from './pages/classroom/CreateClassroomPage';
import { LiveSessionPage } from './pages/classroom/LiveSessionPage';
import { LiveSessionsListPage } from './pages/live/LiveSessionsListPage';
import { HomeworkListPage, HomeworkDetailPage } from './pages/homework/HomeworkPages';
import { CreateHomeworkPage } from './pages/homework/CreateHomeworkPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { AnnouncementsPage } from './pages/announcements/AnnouncementsPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { QuizListPage } from './pages/quiz/QuizPage';
import { CalendarPage } from './pages/calendar/CalendarPage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { AdminDashboard, AdminUsers } from './pages/admin/AdminPages';
import { LandingPage } from './pages/landing/LandingPage';
import { GamificationPage } from './pages/gamification/GamificationPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './components/common/Toast';
import './App.css';

// Protected route wrapper
const ProtectedRoute = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

// Auth route wrapper (redirects if already logged in)
const AuthRoute = () => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth routes */}
        <Route element={<AuthRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/resend-verification" element={<ResendVerificationPage />} />
          <Route path="/pending-verification" element={<PendingVerificationPage />} />
        </Route>

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/quiz" element={<QuizListPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/gamification" element={<GamificationPage />} />

          {/* Classrooms */}
          <Route path="/classrooms" element={<ClassroomListPage />} />
          <Route path="/classrooms/new" element={<CreateClassroomPage />} />
          <Route path="/classrooms/:id" element={<ClassroomDetailPage />} />
          <Route path="/join" element={<JoinClassroomPage />} />
          <Route path="/join/:code" element={<JoinClassroomPage />} />

          {/* Homework */}
          <Route path="/homework" element={<HomeworkListPage />} />
          <Route path="/homework/new" element={<CreateHomeworkPage />} />
          <Route path="/homework/:id" element={<HomeworkDetailPage />} />

          {/* Exams */}
          <Route path="/exams" element={<ExamListPage />} />
          <Route path="/exams/new" element={<CreateExamPage />} />
          <Route path="/exams/:examId" element={<ExamDetailPage />} />
          <Route path="/exams/:examId/session" element={<ExamSessionPage />} />

          {/* Live Sessions */}
          <Route path="/live" element={<LiveSessionsListPage />} />
          <Route path="/live/:sessionId" element={<LiveSessionPage />} />

          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </ErrorBoundary>
  );
}

export default App;
