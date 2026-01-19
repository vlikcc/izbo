import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Classroom, ClassSession } from '../../types';
import { InviteModal } from '../../components/classroom/InviteModal';
import { StudentListModal } from '../../components/classroom/StudentListModal';
import { ClassroomGridSkeleton } from '../../components/common/Skeleton';

export const ClassroomListPage: React.FC = () => {
    const { user } = useAuthStore();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadClassrooms();
    }, []);

    const loadClassrooms = async () => {
        try {
            const response = await classroomApi.getMyClassrooms(1, 20);
            if (response.data.success && response.data.data) {
                setClassrooms(response.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load classrooms:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="h-8 w-48 bg-rose-100 rounded-lg animate-pulse mb-2"></div>
                        <div className="h-4 w-64 bg-rose-50 rounded animate-pulse"></div>
                    </div>
                </div>
                <ClassroomGridSkeleton />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        🏫 Sınıflarım
                    </h1>
                    <p className="text-gray-500 mt-1">Kayıtlı olduğunuz veya yönettiğiniz sınıflar</p>
                </div>
                {(user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
                    <Link 
                        to="/classrooms/new" 
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                    >
                        <span>+</span>
                        <span>Yeni Sınıf</span>
                    </Link>
                )}
            </header>

            {/* Classroom Grid */}
            {classrooms.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center text-4xl">
                        📚
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Henüz sınıf yok</h3>
                    <p className="text-gray-500">Sınıflara kaydolduğunuzda burada görünecek</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {classrooms.map(classroom => (
                        <Link 
                            key={classroom.id} 
                            to={`/classrooms/${classroom.id}`} 
                            className="group bg-white rounded-2xl border border-rose-100 overflow-hidden hover:shadow-xl hover:shadow-rose-100/50 transition-all hover:-translate-y-1"
                        >
                            <div 
                                className="h-40 bg-gradient-to-br from-rose-100 to-orange-100 flex items-center justify-center relative overflow-hidden"
                                style={{ 
                                    backgroundImage: classroom.coverImageUrl ? `url(${classroom.coverImageUrl})` : undefined,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center'
                                }}
                            >
                                {!classroom.coverImageUrl && (
                                    <span className="text-5xl opacity-50 group-hover:scale-110 transition-transform">🏫</span>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                            </div>
                            <div className="p-5">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-rose-600 transition-colors">
                                    {classroom.name}
                                </h3>
                                <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                                    {classroom.description || 'Açıklama yok'}
                                </p>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-1.5 text-gray-600">
                                        <span>👥</span>
                                        <span>{classroom.studentCount} öğrenci</span>
                                    </span>
                                    {classroom.instructorName && (
                                        <span className="flex items-center gap-1.5 text-gray-600">
                                            <span>👩‍🏫</span>
                                            <span>{classroom.instructorName}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export const ClassroomDetailPage: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [isStudentListModalOpen, setIsStudentListModalOpen] = useState(false);
    const [newSessionData, setNewSessionData] = useState({
        title: '',
        description: '',
        scheduledStartTime: '',
        durationMinutes: 60
    });

    const classroomId = window.location.pathname.split('/').pop()!;

    useEffect(() => {
        loadClassroom();
    }, [classroomId]);

    const loadClassroom = async () => {
        try {
            const [classroomRes, sessionsRes] = await Promise.all([
                classroomApi.get(classroomId),
                classroomApi.getSessions(classroomId)
            ]);

            if (classroomRes.data.success) {
                setClassroom(classroomRes.data.data!);
            }
            if (sessionsRes.data.success) {
                setSessions(sessionsRes.data.data || []);
            }
        } catch (error) {
            console.error('Failed to load classroom:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const startTime = new Date(newSessionData.scheduledStartTime);
            const endTime = new Date(startTime.getTime() + newSessionData.durationMinutes * 60000);

            const response = await classroomApi.createSession(classroomId, {
                title: newSessionData.title,
                description: newSessionData.description,
                scheduledStartTime: newSessionData.scheduledStartTime,
                scheduledEndTime: endTime.toISOString()
            });

            if (response.data.success) {
                setIsCreateSessionModalOpen(false);
                setNewSessionData({ title: '', description: '', scheduledStartTime: '', durationMinutes: 60 });
                loadClassroom();
            }
        } catch (error) {
            console.error('Failed to create session:', error);
            alert('Ders oluşturulurken bir hata oluştu');
        }
    };

    const handleStartSession = async (sessionId: string) => {
        try {
            const response = await classroomApi.startSession(sessionId);
            if (response.data.success) {
                navigate(`/live/${sessionId}`);
            }
        } catch (error) {
            console.error('Failed to start session:', error);
            alert('Ders başlatılamadı');
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!classroom) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-16 h-16 mb-4 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                    ⚠️
                </div>
                <p className="text-gray-600">Sınıf bulunamadı</p>
            </div>
        );
    }

    const liveSessions = sessions.filter(s => s.status === 'Live');
    const upcomingSessions = sessions.filter(s => s.status === 'Scheduled');
    const pastSessions = sessions.filter(s => s.status === 'Ended');

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
            {/* Header */}
            <header className="relative">
                <Link 
                    to="/classrooms" 
                    className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl text-gray-700 hover:bg-white transition-all shadow-sm"
                >
                    ← Sınıflara Dön
                </Link>
                
                <div 
                    className="h-64 bg-gradient-to-br from-rose-200 to-orange-200 flex items-center justify-center relative"
                    style={{ 
                        backgroundImage: classroom.coverImageUrl ? `url(${classroom.coverImageUrl})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div className="relative z-10 text-center text-white px-4">
                        <h1 className="text-3xl lg:text-4xl font-bold mb-2">{classroom.name}</h1>
                        <p className="text-white/80 max-w-xl mx-auto">{classroom.description}</p>
                        <div className="flex items-center justify-center gap-4 mt-4">
                            <span className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
                                👥 {classroom.studentCount} öğrenci
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Actions */}
                {(user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
                    <div className="flex flex-wrap gap-3 mb-8">
                        <button 
                            onClick={() => setIsInviteModalOpen(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors"
                        >
                            🔗 Öğrenci Davet Et
                        </button>
                        <button 
                            onClick={() => setIsStudentListModalOpen(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors"
                        >
                            👥 Öğrenci Listesi ({classroom.studentCount})
                        </button>
                        <button 
                            onClick={() => setIsCreateSessionModalOpen(true)} 
                            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                        >
                            📅 Yeni Canlı Ders Planla
                        </button>
                    </div>
                )}

                {/* Modals */}
                {isInviteModalOpen && (
                    <InviteModal
                        classroomId={classroomId}
                        classroomName={classroom.name}
                        onClose={() => setIsInviteModalOpen(false)}
                    />
                )}

                {isStudentListModalOpen && (
                    <StudentListModal
                        classroomId={classroomId}
                        classroomName={classroom.name}
                        onClose={() => setIsStudentListModalOpen(false)}
                        onStudentCountChange={(count) => setClassroom({ ...classroom, studentCount: count })}
                    />
                )}

                {/* Create Session Modal */}
                {isCreateSessionModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6">Yeni Canlı Ders Planla</h2>
                            <form onSubmit={handleCreateSession} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                                    <input
                                        type="text"
                                        value={newSessionData.title}
                                        onChange={e => setNewSessionData({ ...newSessionData, title: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                                    <textarea
                                        value={newSessionData.description}
                                        onChange={e => setNewSessionData({ ...newSessionData, description: e.target.value })}
                                        required
                                        rows={3}
                                        className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Zamanı</label>
                                    <input
                                        type="datetime-local"
                                        value={newSessionData.scheduledStartTime}
                                        onChange={e => setNewSessionData({ ...newSessionData, scheduledStartTime: e.target.value })}
                                        required
                                        className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Süre (Dakika)</label>
                                    <input
                                        type="number"
                                        value={newSessionData.durationMinutes}
                                        onChange={e => setNewSessionData({ ...newSessionData, durationMinutes: parseInt(e.target.value) })}
                                        required
                                        className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCreateSessionModalOpen(false)}
                                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                                    >
                                        İptal
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                    >
                                        Oluştur
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Live Sessions */}
                {liveSessions.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                            Şu An Canlı
                        </h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {liveSessions.map(session => (
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
                                        Derse katıl <span>→</span>
                                    </p>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}

                {/* Upcoming Sessions */}
                <section className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">📅 Yaklaşan Dersler</h2>
                    {upcomingSessions.length === 0 ? (
                        <div className="bg-white rounded-xl border border-rose-100 p-8 text-center">
                            <p className="text-gray-500">Yaklaşan ders yok</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {upcomingSessions.map(session => (
                                <div key={session.id} className="bg-white rounded-xl border border-rose-100 p-5 hover:shadow-lg transition-shadow">
                                    <div className="text-sm text-rose-500 font-medium mb-2">{formatDate(session.scheduledStartTime)}</div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{session.title}</h3>
                                    <p className="text-gray-500 text-sm mb-4">{session.description}</p>
                                    {(user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin') && (
                                        <button 
                                            onClick={() => handleStartSession(session.id)} 
                                            className="w-full px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-lg hover:from-rose-600 hover:to-rose-500 transition-all"
                                        >
                                            Dersi Başlat
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Past Sessions */}
                <section>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">📚 Geçmiş Dersler</h2>
                    {pastSessions.length === 0 ? (
                        <div className="bg-white rounded-xl border border-rose-100 p-8 text-center">
                            <p className="text-gray-500">Geçmiş ders yok</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pastSessions.slice(0, 6).map(session => (
                                <div key={session.id} className="bg-white rounded-xl border border-rose-100 p-5 opacity-75 hover:opacity-100 transition-opacity">
                                    <div className="text-sm text-gray-400 mb-2">{formatDate(session.scheduledStartTime)}</div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">{session.title}</h3>
                                    {session.recordingUrl && (
                                        <a 
                                            href={session.recordingUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="inline-flex items-center gap-2 text-rose-500 hover:text-rose-600 font-medium"
                                        >
                                            🎥 Kaydı İzle
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
