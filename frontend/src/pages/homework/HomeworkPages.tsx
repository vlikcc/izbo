import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { homeworkApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Homework, Submission } from '../../types';

export const HomeworkListPage: React.FC = () => {
    const { user } = useAuthStore();
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        loadHomeworks();
    }, [page]);

    const loadHomeworks = async () => {
        try {
            const response = await homeworkApi.getAll(undefined, page, 10);
            if (response.data.success && response.data.data) {
                setHomeworks(response.data.data.items);
                setTotalPages(response.data.data.totalPages);
            }
        } catch (error) {
            console.error('Failed to load homeworks:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const isOverdue = (dueDate: string) => {
        return new Date(dueDate) < new Date();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500">Ödevler yükleniyor...</p>
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
                        📝 Ödevler
                    </h1>
                    <p className="text-gray-500 mt-1">Tüm ödevlerinizi buradan takip edebilirsiniz</p>
                </div>
                {(user?.role === 'Instructor' || user?.role === 'Admin') && (
                    <Link 
                        to="/homework/new" 
                        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                    >
                        <span>+</span>
                        <span>Yeni Ödev</span>
                    </Link>
                )}
            </header>

            {/* Homework List */}
            {homeworks.length === 0 ? (
                <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-6 bg-rose-100 rounded-full flex items-center justify-center text-4xl">
                        📋
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Henüz ödev yok</h3>
                    <p className="text-gray-500">Ödevler eklendiğinde burada görünecek</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {homeworks.map(hw => (
                        <Link 
                            key={hw.id} 
                            to={`/homework/${hw.id}`} 
                            className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white rounded-2xl border border-rose-100 hover:shadow-xl hover:shadow-rose-100/50 transition-all hover:-translate-y-0.5 group"
                        >
                            <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-orange-200 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                                📝
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-rose-600 transition-colors">
                                        {hw.title}
                                    </h3>
                                    {isOverdue(hw.dueDate) && !hw.allowLateSubmission && (
                                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">Süre Doldu</span>
                                    )}
                                    {isOverdue(hw.dueDate) && hw.allowLateSubmission && (
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">Geç Teslim</span>
                                    )}
                                </div>
                                <p className="text-sm text-rose-500 mb-1">{hw.classroomName}</p>
                                <p className="text-sm text-gray-500 line-clamp-1">{hw.description}</p>
                            </div>
                            
                            <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 text-sm">
                                <div className={`${isOverdue(hw.dueDate) ? 'text-red-500' : 'text-gray-600'}`}>
                                    <span className="text-xs text-gray-400 block">Son Teslim</span>
                                    <span className="font-medium">{formatDate(hw.dueDate)}</span>
                                </div>
                                <div className="flex items-center gap-4 text-gray-500">
                                    <span className="flex items-center gap-1">
                                        <span>🏆</span>
                                        <span>{hw.maxScore} puan</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span>📤</span>
                                        <span>{hw.submissionCount} teslim</span>
                                    </span>
                                </div>
                            </div>
                            
                            <span className="hidden sm:block text-gray-400 group-hover:text-rose-500 transition-colors">→</span>
                        </Link>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ← Önceki
                    </button>
                    <span className="text-gray-600">Sayfa {page} / {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 bg-white border border-rose-200 text-rose-600 font-medium rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Sonraki →
                    </button>
                </div>
            )}
        </div>
    );
};

export const HomeworkDetailPage: React.FC = () => {
    const { user } = useAuthStore();
    const [homework, setHomework] = useState<Homework | null>(null);
    const [submission, setSubmission] = useState<Submission | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const homeworkId = window.location.pathname.split('/').pop()!;

    useEffect(() => {
        loadHomework();
    }, [homeworkId]);

    const loadHomework = async () => {
        try {
            const [hwRes, subRes] = await Promise.all([
                homeworkApi.get(homeworkId),
                homeworkApi.getMySubmission(homeworkId).catch(() => null)
            ]);

            if (hwRes.data.success) {
                setHomework(hwRes.data.data!);
            }
            if (subRes?.data.success) {
                setSubmission(subRes.data.data!);
                setContent(subRes.data.data?.content || '');
            }
        } catch (error) {
            console.error('Failed to load homework:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!content.trim()) return;

        setSubmitting(true);
        try {
            const response = await homeworkApi.submit(homeworkId, { content });
            if (response.data.success) {
                setSubmission(response.data.data!);
                alert('Ödev başarıyla teslim edildi!');
            }
        } catch (error) {
            alert('Ödev teslim edilirken hata oluştu');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!homework) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-16 h-16 mb-4 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                    ⚠️
                </div>
                <p className="text-gray-600">Ödev bulunamadı</p>
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <Link 
                    to="/homework" 
                    className="inline-flex items-center gap-2 text-rose-500 hover:text-rose-600 font-medium mb-4"
                >
                    ← Ödevlere Dön
                </Link>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{homework.title}</h1>
                <span className="inline-block px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                    {homework.classroomName}
                </span>
            </header>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Description */}
                    <section className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            📋 Açıklama
                        </h2>
                        <p className="text-gray-600 whitespace-pre-wrap">{homework.description}</p>

                        {homework.attachmentUrl && (
                            <a 
                                href={homework.attachmentUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition-colors"
                            >
                                📎 Ek Dosyayı İndir
                            </a>
                        )}
                    </section>

                    {/* Submission Section */}
                    {user?.role === 'Student' && (
                        <section className="bg-white rounded-2xl border border-rose-100 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                ✍️ Cevabınız
                            </h2>

                            {submission?.status === 'Graded' ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl">
                                        <div className="text-center">
                                            <span className="text-3xl font-bold text-emerald-600">{submission.score}</span>
                                            <span className="text-lg text-emerald-500">/ {homework.maxScore}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-emerald-700 font-medium">Notlandırıldı</p>
                                        </div>
                                    </div>
                                    {submission.feedback && (
                                        <div className="p-4 bg-gray-50 rounded-xl">
                                            <h4 className="font-medium text-gray-700 mb-2">Geri Bildirim:</h4>
                                            <p className="text-gray-600">{submission.feedback}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder="Cevabınızı buraya yazın..."
                                        rows={10}
                                        disabled={submission?.status === 'Submitted' || submission?.status === 'Late'}
                                        className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                                    />

                                    {submission && (
                                        <p className="text-emerald-600 text-sm flex items-center gap-2">
                                            ✅ Teslim edildi: {new Date(submission.submittedAt!).toLocaleString('tr-TR')}
                                        </p>
                                    )}

                                    <button
                                        className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        onClick={handleSubmit}
                                        disabled={submitting || !content.trim()}
                                    >
                                        {submitting ? 'Gönderiliyor...' : submission ? 'Güncelle' : 'Teslim Et'}
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Ödev Bilgileri</h3>
                        <div className="space-y-4">
                            <div>
                                <span className="text-sm text-gray-500">Son Teslim</span>
                                <p className="font-medium text-gray-900">
                                    {new Date(homework.dueDate).toLocaleDateString('tr-TR', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                            </div>
                            <div>
                                <span className="text-sm text-gray-500">Maksimum Puan</span>
                                <p className="font-medium text-gray-900">{homework.maxScore}</p>
                            </div>
                            <div>
                                <span className="text-sm text-gray-500">Geç Teslim</span>
                                <p className="font-medium text-gray-900">
                                    {homework.allowLateSubmission 
                                        ? `İzin Var (-%${homework.latePenaltyPercent} ceza)` 
                                        : 'İzin Yok'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
