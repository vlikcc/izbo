import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { examApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Exam } from '../../types';
import './ExamList.css';

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
                return <span className="status-badge draft">📝 Taslak</span>;
            case 'Published':
                return <span className="status-badge published">📋 Yayında</span>;
            case 'InProgress':
                return <span className="status-badge in-progress">🔴 Devam Ediyor</span>;
            case 'Ended':
                return <span className="status-badge ended">✓ Tamamlandı</span>;
            default:
                return <span className="status-badge">{status}</span>;
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
            <div className="exam-list-page">
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Sınavlar yükleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="exam-list-page">
            <header className="page-header">
                <div>
                    <h1>📋 Sınavlar</h1>
                    <p>Tüm sınavlarınızı görüntüleyin ve yönetin</p>
                </div>
                {isInstructor && (
                    <Link to="/exams/new" className="create-btn">
                        + Yeni Sınav
                    </Link>
                )}
            </header>

            <div className="exam-filters">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Sınav ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="search-icon">🔍</span>
                </div>

                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        Tümü ({exams.length})
                    </button>
                    <button
                        className={`filter-tab ${filter === 'InProgress' ? 'active' : ''}`}
                        onClick={() => setFilter('InProgress')}
                    >
                        🔴 Aktif
                    </button>
                    <button
                        className={`filter-tab ${filter === 'Published' ? 'active' : ''}`}
                        onClick={() => setFilter('Published')}
                    >
                        📋 Yaklaşan
                    </button>
                    {isInstructor && (
                        <button
                            className={`filter-tab ${filter === 'Draft' ? 'active' : ''}`}
                            onClick={() => setFilter('Draft')}
                        >
                            📝 Taslak
                        </button>
                    )}
                    <button
                        className={`filter-tab ${filter === 'Ended' ? 'active' : ''}`}
                        onClick={() => setFilter('Ended')}
                    >
                        ✓ Tamamlanan
                    </button>
                </div>
            </div>

            <div className="exam-grid">
                {filteredExams.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📋</span>
                        <h3>Sınav bulunamadı</h3>
                        <p>
                            {searchTerm
                                ? 'Arama kriterlerinize uygun sınav yok'
                                : 'Henüz sınav oluşturulmamış'}
                        </p>
                    </div>
                ) : (
                    filteredExams.map(exam => (
                        <div key={exam.id} className={`exam-card ${exam.status.toLowerCase()}`}>
                            <div className="exam-card-header">
                                {getStatusBadge(exam.status)}
                                <span className="exam-classroom">{exam.classroomName}</span>
                            </div>

                            <h3 className="exam-title">{exam.title}</h3>
                            {exam.description && (
                                <p className="exam-description">{exam.description}</p>
                            )}

                            <div className="exam-info">
                                <div className="info-item">
                                    <span className="info-icon">⏱️</span>
                                    <span>{exam.durationMinutes} dakika</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">❓</span>
                                    <span>{exam.questionCount} soru</span>
                                </div>
                                <div className="info-item">
                                    <span className="info-icon">🏆</span>
                                    <span>{exam.totalPoints} puan</span>
                                </div>
                                {exam.passingScore && (
                                    <div className="info-item">
                                        <span className="info-icon">✓</span>
                                        <span>Geçme: {exam.passingScore}</span>
                                    </div>
                                )}
                            </div>

                            <div className="exam-time">
                                {getTimeInfo(exam)}
                            </div>

                            <div className="exam-actions">
                                {exam.status === 'InProgress' && (
                                    <button
                                        className="action-btn start"
                                        onClick={() => handleStartExam(exam.id)}
                                    >
                                        🚀 Sınava Gir
                                    </button>
                                )}
                                {exam.status === 'Published' && new Date(exam.startTime) <= new Date() && (
                                    <button
                                        className="action-btn start"
                                        onClick={() => handleStartExam(exam.id)}
                                    >
                                        🚀 Sınava Başla
                                    </button>
                                )}
                                <Link to={`/exams/${exam.id}`} className="action-btn detail">
                                    Detaylar →
                                </Link>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
