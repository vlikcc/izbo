import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { examApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Exam } from '../../types';

type ExamStatus = 'all' | 'Draft' | 'Published' | 'InProgress' | 'Ended';

export const ExamListPage: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<ExamStatus>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        loadExams();
    }, []);

    const loadExams = async () => {
        try {
            const response = await examApi.getAll(undefined, 1, 50);
            if (response.data.success && response.data.data) {
                setExams(response.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load exams:', error);
            // Mock data for development
            setExams([
                {
                    id: '1',
                    classroomId: 'c1',
                    classroomName: 'Matematik 101',
                    title: 'Ara Sınav - Türev ve İntegral',
                    description: 'Türev ve integral konularını kapsayan ara sınav',
                    durationMinutes: 60,
                    startTime: new Date(Date.now() + 86400000).toISOString(),
                    endTime: new Date(Date.now() + 86400000 + 3600000).toISOString(),
                    totalPoints: 100,
                    questionCount: 20,
                    shuffleQuestions: true,
                    shuffleOptions: true,
                    showResults: true,
                    passingScore: 50,
                    status: 'Published',
                    createdAt: new Date().toISOString()
                },
                {
                    id: '2',
                    classroomId: 'c1',
                    classroomName: 'Fizik 102',
                    title: 'Quiz - Newton Yasaları',
                    description: 'Newton yasaları hakkında kısa quiz',
                    durationMinutes: 30,
                    startTime: new Date().toISOString(),
                    endTime: new Date(Date.now() + 1800000).toISOString(),
                    totalPoints: 50,
                    questionCount: 10,
                    shuffleQuestions: false,
                    shuffleOptions: true,
                    showResults: true,
                    status: 'InProgress',
                    createdAt: new Date().toISOString()
                },
                {
                    id: '3',
                    classroomId: 'c2',
                    classroomName: 'Matematik 101',
                    title: 'Final Sınavı - Tüm Konular',
                    description: 'Dönem boyunca işlenen tüm konuları kapsayan final sınavı',
                    durationMinutes: 120,
                    startTime: new Date(Date.now() + 604800000).toISOString(),
                    endTime: new Date(Date.now() + 604800000 + 7200000).toISOString(),
                    totalPoints: 100,
                    questionCount: 40,
                    shuffleQuestions: true,
                    shuffleOptions: true,
                    showResults: false,
                    passingScore: 60,
                    status: 'Draft',
                    createdAt: new Date().toISOString()
                },
                {
                    id: '4',
                    classroomId: 'c1',
                    classroomName: 'Fizik 102',
                    title: 'Geçmiş Sınav - Termodinamik',
                    durationMinutes: 45,
                    startTime: new Date(Date.now() - 604800000).toISOString(),
                    endTime: new Date(Date.now() - 604800000 + 2700000).toISOString(),
                    totalPoints: 75,
                    questionCount: 15,
                    shuffleQuestions: true,
                    shuffleOptions: true,
                    showResults: true,
                    status: 'Ended',
                    createdAt: new Date(Date.now() - 1209600000).toISOString()
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const filteredExams = exams.filter(exam => {
        const matchesFilter = filter === 'all' || exam.status === filter;
        const matchesSearch = exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            exam.classroomName.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Draft':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">📝 Taslak</span>;
            case 'Published':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded-full">📋 Yayında</span>;
            case 'InProgress':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-600 text-xs font-medium rounded-full">🔴 Devam Ediyor</span>;
            case 'Ended':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-600 text-xs font-medium rounded-full">✓ Tamamlandı</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">{status}</span>;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getTimeInfo = (exam: Exam) => {
        const now = new Date();
        const start = new Date(exam.startTime);
        const end = new Date(exam.endTime);

        if (exam.status === 'InProgress') {
            const remaining = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 60000));
            return `⏳ ${remaining} dakika kaldı`;
        }

        if (exam.status === 'Published' && start > now) {
            const diff = start.getTime() - now.getTime();
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            if (days > 0) return `📅 ${days} gün sonra`;
            if (hours > 0) return `⏰ ${hours} saat sonra`;
            return `⏰ Yakında başlayacak`;
        }

        return formatDate(exam.startTime);
    };

    const handleStartExam = (examId: string) => {
        navigate(`/exams/${examId}/session`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500">Sınavlar yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        📋 Sınavlar
                    </h1>
                    <p className="text-gray-500 mt-1">Tüm sınavlarınızı görüntüleyin ve yönetin</p>
                </div>
                {isInstructor && (
                    <Link 
                        to="/exams/new" 
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                    >
                        <span>+</span>
                        <span>Yeni Sınav</span>
                    </Link>
                )}
            </header>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mb-8">
                <div className="relative flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Sınav ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            filter === 'all' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setFilter('all')}
                    >
                        Tümü ({exams.length})
                    </button>
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            filter === 'InProgress' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setFilter('InProgress')}
                    >
                        🔴 Aktif
                    </button>
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            filter === 'Published' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setFilter('Published')}
                    >
                        📋 Yaklaşan
                    </button>
                    {isInstructor && (
                        <button
                            className={`px-4 py-2 rounded-xl font-medium transition-all ${
                                filter === 'Draft' 
                                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                    : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                            }`}
                            onClick={() => setFilter('Draft')}
                        >
                            📝 Taslak
                        </button>
                    )}
                    <button
                        className={`px-4 py-2 rounded-xl font-medium transition-all ${
                            filter === 'Ended' 
                                ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
                                : 'bg-white border border-rose-100 text-gray-600 hover:bg-rose-50'
                        }`}
                        onClick={() => setFilter('Ended')}
                    >
                        ✓ Tamamlanan
                    </button>
                </div>
            </div>

            {/* Exam Grid */}
            {filteredExams.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center text-4xl">
                        📋
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Sınav bulunamadı</h3>
                    <p className="text-gray-500">
                        {searchTerm
                            ? 'Arama kriterlerinize uygun sınav yok'
                            : 'Henüz sınav oluşturulmamış'}
                    </p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredExams.map(exam => (
                        <div 
                            key={exam.id} 
                            className={`bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 ${
                                exam.status === 'InProgress' 
                                    ? 'border-red-200 shadow-lg shadow-red-100' 
                                    : 'border-rose-100 hover:shadow-rose-100/50'
                            }`}
                        >
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    {getStatusBadge(exam.status)}
                                    <span className="text-sm text-gray-500">{exam.classroomName}</span>
                                </div>

                                <h3 className="text-lg font-semibold text-gray-900 mb-2">{exam.title}</h3>
                                {exam.description && (
                                    <p className="text-gray-500 text-sm line-clamp-2 mb-4">{exam.description}</p>
                                )}

                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span>⏱️</span>
                                        <span>{exam.durationMinutes} dakika</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span>❓</span>
                                        <span>{exam.questionCount} soru</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span>🏆</span>
                                        <span>{exam.totalPoints} puan</span>
                                    </div>
                                    {exam.passingScore && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <span>✓</span>
                                            <span>Geçme: {exam.passingScore}</span>
                                        </div>
                                    )}
                                </div>

                                <div className={`text-sm font-medium mb-4 ${
                                    exam.status === 'InProgress' ? 'text-red-500' : 'text-gray-500'
                                }`}>
                                    {getTimeInfo(exam)}
                                </div>

                                <div className="flex gap-2">
                                    {exam.status === 'InProgress' && (
                                        <button
                                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                            onClick={() => handleStartExam(exam.id)}
                                        >
                                            🚀 Sınava Gir
                                        </button>
                                    )}
                                    {exam.status === 'Published' && new Date(exam.startTime) <= new Date() && (
                                        <button
                                            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                                            onClick={() => handleStartExam(exam.id)}
                                        >
                                            🚀 Sınava Başla
                                        </button>
                                    )}
                                    <Link 
                                        to={`/exams/${exam.id}`} 
                                        className="flex-1 px-4 py-2.5 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors text-center"
                                    >
                                        Detaylar →
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
