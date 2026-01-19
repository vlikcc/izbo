import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { classroomApi, homeworkApi, examApi } from '../../services/api';
import type { Classroom, Homework, Exam, ClassSession } from '../../types';
import { DashboardSkeleton } from '../../components/common/Skeleton';

export const DashboardPage: React.FC = () => {
    const { user } = useAuthStore();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [upcomingHomework, setUpcomingHomework] = useState<Homework[]>([]);
    const [upcomingExams, setUpcomingExams] = useState<Exam[]>([]);
    const [liveSessions, setLiveSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        try {
            const [classroomsRes, homeworkRes, examsRes, liveRes] = await Promise.all([
                classroomApi.getMyClassrooms(1, 5),
                homeworkApi.getAll(undefined, 1, 5),
                examApi.getAll(undefined, 1, 5),
                classroomApi.getLiveSessions(),
            ]);

            if (classroomsRes.data.success) setClassrooms(classroomsRes.data.data?.items || []);
            if (homeworkRes.data.success) setUpcomingHomework(homeworkRes.data.data?.items || []);
            if (examsRes.data.success) setUpcomingExams(examsRes.data.data?.items || []);
            if (liveRes.data.success) setLiveSessions(liveRes.data.data || []);
        } catch (error) {
            console.error('Dashboard data loading failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Günaydın';
        if (hour < 18) return 'İyi Günler';
        return 'İyi Akşamlar';
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8">
                <DashboardSkeleton />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
                            {getGreeting()}, {user?.firstName}! 👋
                        </h1>
                        <p className="text-gray-500">Bugün neler yapmak istersiniz?</p>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-rose-100 shadow-sm">
                            <span className="text-xl">🏫</span>
                            <div>
                                <div className="text-lg font-bold text-gray-900">{classrooms.length}</div>
                                <div className="text-xs text-gray-500">Sınıf</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-rose-100 shadow-sm">
                            <span className="text-xl">📝</span>
                            <div>
                                <div className="text-lg font-bold text-gray-900">{upcomingHomework.length}</div>
                                <div className="text-xs text-gray-500">Bekleyen Ödev</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 rounded-xl shadow-lg shadow-rose-200">
                            <span className="text-xl">🔴</span>
                            <div>
                                <div className="text-lg font-bold text-white">{liveSessions.length}</div>
                                <div className="text-xs text-rose-100">Canlı Ders</div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Live Sessions */}
            {liveSessions.length > 0 && (
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        Canlı Dersler
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {liveSessions.map((session) => (
                            <Link 
                                key={session.id} 
                                to={`/live/${session.id}`} 
                                className="relative overflow-hidden bg-gradient-to-r from-rose-500 to-rose-400 rounded-2xl p-6 text-white shadow-xl shadow-rose-200 hover:shadow-2xl hover:shadow-rose-300 transition-all hover:-translate-y-1"
                            >
                                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                                    CANLI
                                </div>
                                <h3 className="text-xl font-bold mb-2">{session.title}</h3>
                                <p className="text-rose-100 flex items-center gap-1">
                                    Şimdi katıl <span>→</span>
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Main Grid */}
            <div className="grid lg:grid-cols-3 gap-6">
                {/* Classrooms */}
                <section className="bg-white rounded-2xl border border-rose-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            📚 Sınıflarım
                        </h2>
                        <Link to="/classrooms" className="text-sm text-rose-500 hover:text-rose-600 font-medium">
                            Tümünü Gör →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {classrooms.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto mb-3 bg-rose-100 rounded-full flex items-center justify-center text-xl">
                                    🏫
                                </div>
                                <p className="text-gray-500 text-sm">Henüz sınıfınız yok</p>
                            </div>
                        ) : (
                            classrooms.map((classroom) => (
                                <Link 
                                    key={classroom.id} 
                                    to={`/classrooms/${classroom.id}`} 
                                    className="flex items-center gap-4 p-4 bg-rose-50/50 rounded-xl hover:bg-rose-100/50 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">
                                        🏫
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 truncate group-hover:text-rose-600 transition-colors">
                                            {classroom.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">{classroom.studentCount} öğrenci</p>
                                    </div>
                                    <span className="text-gray-400 group-hover:text-rose-500 transition-colors">→</span>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                {/* Homework */}
                <section className="bg-white rounded-2xl border border-rose-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            📝 Yaklaşan Ödevler
                        </h2>
                        <Link to="/homework" className="text-sm text-rose-500 hover:text-rose-600 font-medium">
                            Tümünü Gör →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {upcomingHomework.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto mb-3 bg-orange-100 rounded-full flex items-center justify-center text-xl">
                                    📝
                                </div>
                                <p className="text-gray-500 text-sm">Bekleyen ödeviniz yok</p>
                            </div>
                        ) : (
                            upcomingHomework.map((hw) => (
                                <Link 
                                    key={hw.id} 
                                    to={`/homework/${hw.id}`} 
                                    className="flex items-center gap-4 p-4 bg-orange-50/50 rounded-xl hover:bg-orange-100/50 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">
                                        📝
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 truncate group-hover:text-rose-600 transition-colors">
                                            {hw.title}
                                        </h3>
                                        <p className="text-sm text-orange-600">
                                            Son Teslim: {formatDate(hw.dueDate)}
                                        </p>
                                    </div>
                                    <span className="text-gray-400 group-hover:text-rose-500 transition-colors">→</span>
                                </Link>
                            ))
                        )}
                    </div>
                </section>

                {/* Exams */}
                <section className="bg-white rounded-2xl border border-rose-100 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            📋 Yaklaşan Sınavlar
                        </h2>
                        <Link to="/exams" className="text-sm text-rose-500 hover:text-rose-600 font-medium">
                            Tümünü Gör →
                        </Link>
                    </div>
                    <div className="space-y-3">
                        {upcomingExams.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-12 h-12 mx-auto mb-3 bg-emerald-100 rounded-full flex items-center justify-center text-xl">
                                    📋
                                </div>
                                <p className="text-gray-500 text-sm">Yaklaşan sınavınız yok</p>
                            </div>
                        ) : (
                            upcomingExams.map((exam) => (
                                <Link 
                                    key={exam.id} 
                                    to={`/exams/${exam.id}`} 
                                    className="flex items-center gap-4 p-4 bg-emerald-50/50 rounded-xl hover:bg-emerald-100/50 transition-colors group"
                                >
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-lg shadow-sm">
                                        📋
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900 truncate group-hover:text-rose-600 transition-colors">
                                            {exam.title}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {formatDate(exam.startTime)} • {exam.durationMinutes} dk
                                        </p>
                                    </div>
                                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                                        exam.status === 'Published' 
                                            ? 'bg-emerald-100 text-emerald-600' 
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {exam.status === 'Published' ? 'Hazır' : exam.status}
                                    </span>
                                </Link>
                            ))
                        )}
                    </div>
                </section>
            </div>

            {/* Quick Actions */}
            <section className="mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Hızlı Erişim</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Link 
                        to="/classrooms" 
                        className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-rose-100 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100/50 transition-all group"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-rose-100 to-rose-200 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            🏫
                        </div>
                        <span className="font-medium text-gray-700">Sınıflar</span>
                    </Link>

                    <Link 
                        to="/homework" 
                        className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-rose-100 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100/50 transition-all group"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            📝
                        </div>
                        <span className="font-medium text-gray-700">Ödevler</span>
                    </Link>

                    <Link 
                        to="/exams" 
                        className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-rose-100 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100/50 transition-all group"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            📋
                        </div>
                        <span className="font-medium text-gray-700">Sınavlar</span>
                    </Link>

                    <Link 
                        to="/live" 
                        className="flex flex-col items-center gap-3 p-5 bg-white rounded-2xl border border-rose-100 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-100/50 transition-all group"
                    >
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            🎥
                        </div>
                        <span className="font-medium text-gray-700">Canlı Dersler</span>
                    </Link>
                </div>
            </section>
        </div>
    );
};
