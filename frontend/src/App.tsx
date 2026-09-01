import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { ProtectedRoute, RoleRoute } from './components/auth/RouteGuards';
import { MainLayout } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastHost } from './components/ui/ToastHost';
import { UpgradeModal } from './components/subscription/UpgradeModal';
import './index.css';

const LandingPage = lazy(() => import('./pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ClassroomsPage = lazy(() => import('./pages/classrooms/ClassroomsPage').then((m) => ({ default: m.ClassroomsPage })));
const ClassroomDetailPage = lazy(() => import('./pages/classrooms/ClassroomDetailPage').then((m) => ({ default: m.ClassroomDetailPage })));
const ExamsPage = lazy(() => import('./pages/exams/ExamsPage').then((m) => ({ default: m.ExamsPage })));
const ExamBuilderPage = lazy(() => import('./pages/exams/ExamBuilderPage').then((m) => ({ default: m.ExamBuilderPage })));
const ExamTakePage = lazy(() => import('./pages/exams/ExamTakePage').then((m) => ({ default: m.ExamTakePage })));
const ExamResultPage = lazy(() => import('./pages/exams/ExamResultPage').then((m) => ({ default: m.ExamResultPage })));
const HomeworkPage = lazy(() => import('./pages/homework/HomeworkPage').then((m) => ({ default: m.HomeworkPage })));
const HomeworkSubmitPage = lazy(() => import('./pages/homework/HomeworkSubmitPage').then((m) => ({ default: m.HomeworkSubmitPage })));
const HomeworkGradePage = lazy(() => import('./pages/homework/HomeworkGradePage').then((m) => ({ default: m.HomeworkGradePage })));
const LivePage = lazy(() => import('./pages/live/LivePage'));
const CustomLiveRoomPage = lazy(() => import('./pages/live/CustomLiveRoomPage').then((m) => ({ default: m.CustomLiveRoomPage })));
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const LiveQuizPresenterPage = lazy(() => import('./pages/exams/LiveQuizPresenterPage').then((m) => ({ default: m.LiveQuizPresenterPage })));
const LiveQuizVoterPage = lazy(() => import('./pages/exams/LiveQuizVoterPage').then((m) => ({ default: m.LiveQuizVoterPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const CalendarPage = lazy(() => import('./pages/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const GradebookPage = lazy(() => import('./pages/reports/GradebookPage').then((m) => ({ default: m.GradebookPage })));
const PricingPage = lazy(() => import('./pages/pricing/PricingPage').then((m) => ({ default: m.PricingPage })));
const BillingPage = lazy(() => import('./pages/billing/BillingPage').then((m) => ({ default: m.BillingPage })));
const SubscriptionsAdminPage = lazy(() => import('./pages/admin/SubscriptionsAdminPage').then((m) => ({ default: m.SubscriptionsAdminPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/legal/TermsPage').then((m) => ({ default: m.TermsPage })));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
});

const PageFallback = () => (
    <div className="flex h-screen items-center justify-center" role="status">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        <span className="sr-only">Yükleniyor</span>
    </div>
);

function AppRoutes() {
    const { checkAuth } = useAuthStore();

    useEffect(() => {
        void checkAuth();
    }, [checkAuth]);

    return (
        <Suspense fallback={<PageFallback />}>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />

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
                    <Route path="classrooms/:id" element={<ClassroomDetailPage />} />
                    <Route path="homework" element={<HomeworkPage />} />
                    <Route path="homework/:id/submit" element={<HomeworkSubmitPage />} />
                    <Route
                        path="homework/:id/grade"
                        element={
                            <RoleRoute roles={['Instructor', 'Admin', 'SuperAdmin']}>
                                <HomeworkGradePage />
                            </RoleRoute>
                        }
                    />
                    <Route path="exams" element={<ExamsPage />} />
                    <Route
                        path="exams/:id/builder"
                        element={
                            <RoleRoute roles={['Instructor', 'Admin', 'SuperAdmin']}>
                                <ExamBuilderPage />
                            </RoleRoute>
                        }
                    />
                    <Route path="exams/:id/take" element={<ExamTakePage />} />
                    <Route path="exams/sessions/:sessionId/result" element={<ExamResultPage />} />
                    <Route path="live" element={<LivePage />} />
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route
                        path="gradebook"
                        element={
                            <RoleRoute roles={['Instructor', 'Admin', 'SuperAdmin']}>
                                <GradebookPage />
                            </RoleRoute>
                        }
                    />
                    <Route
                        path="admin"
                        element={
                            <RoleRoute roles={['Admin', 'SuperAdmin']}>
                                <AdminUsersPage />
                            </RoleRoute>
                        }
                    />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="billing" element={<BillingPage />} />
                    <Route
                        path="admin/subscriptions"
                        element={
                            <RoleRoute roles={['Admin', 'SuperAdmin']}>
                                <SubscriptionsAdminPage />
                            </RoleRoute>
                        }
                    />
                </Route>

                <Route
                    path="/live/:sessionId"
                    element={
                        <ProtectedRoute>
                            <CustomLiveRoomPage />
                        </ProtectedRoute>
                    }
                />
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

                <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <BrowserRouter>
                    <AppRoutes />
                    <ToastHost />
                    <UpgradeModal />
                </BrowserRouter>
            </ErrorBoundary>
        </QueryClientProvider>
    );
}

export default App;
