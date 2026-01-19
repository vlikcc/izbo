import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { examApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Exam, Question } from '../../types';

export const ExamDetailPage: React.FC = () => {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [exam, setExam] = useState<Exam | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);
    const [publishing, setPublishing] = useState(false);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        loadExamDetails();
    }, [examId]);

    const loadExamDetails = async () => {
        try {
            const [examRes, questionsRes] = await Promise.all([
                examApi.get(examId!),
                examApi.getQuestions(examId!)
            ]);

            if (examRes.data.success && examRes.data.data) {
                setExam(examRes.data.data);
            }
            if (questionsRes.data.success && questionsRes.data.data) {
                setQuestions(questionsRes.data.data);
            }
        } catch (error) {
            console.error('Failed to load exam:', error);
            setExam({
                id: examId!,
                classroomId: 'c1',
                classroomName: 'Matematik 101',
                title: 'Ara Sınav - Türev ve İntegral',
                description: 'Türev ve integral konularını kapsayan ara sınav. Bu sınav dönem notunuzun %30\'unu oluşturacaktır.',
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
            });
            setQuestions([
                { id: 'q1', examId: examId!, orderIndex: 1, type: 'MultipleChoice', content: 'f(x) = x² fonksiyonunun türevi nedir?', options: ['2x', 'x', '2', 'x²'], points: 5 },
                { id: 'q2', examId: examId!, orderIndex: 2, type: 'TrueFalse', content: 'Her sürekli fonksiyon türevlenebilirdir.', points: 5 },
                { id: 'q3', examId: examId!, orderIndex: 3, type: 'FillInBlank', content: '∫x dx = ___', points: 10 }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const response = await examApi.publish(examId!);
            if (response.data.success) {
                setExam(prev => prev ? { ...prev, status: 'Published' } : null);
            }
        } catch (error) {
            console.error('Failed to publish:', error);
            setExam(prev => prev ? { ...prev, status: 'Published' } : null);
        } finally {
            setPublishing(false);
            setShowConfirm(false);
        }
    };

    const handleDelete = async () => {
        try {
            await examApi.delete(examId!);
            navigate('/exams');
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleStartExam = () => {
        navigate(`/exams/${examId}/session`);
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

    const getStatusInfo = () => {
        if (!exam) return null;

        const now = new Date();
        const start = new Date(exam.startTime);
        const end = new Date(exam.endTime);

        if (exam.status === 'Draft') {
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-xl">
                    <span>📝</span>
                    <span>Taslak - Henüz yayınlanmadı</span>
                </div>
            );
        }

        if (exam.status === 'InProgress' || (now >= start && now <= end)) {
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-xl">
                    <span className="animate-pulse">🔴</span>
                    <span>Sınav Devam Ediyor</span>
                </div>
            );
        }

        if (now < start) {
            const diff = start.getTime() - now.getTime();
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            return (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-600 rounded-xl">
                    <span>📅</span>
                    <span>{days > 0 ? `${days} gün ${hours} saat sonra` : `${hours} saat sonra`} başlayacak</span>
                </div>
            );
        }

        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-600 rounded-xl">
                <span>✓</span>
                <span>Sınav Tamamlandı</span>
            </div>
        );
    };

    const getQuestionTypeLabel = (type: string) => {
        switch (type) {
            case 'MultipleChoice': return 'Çoktan Seçmeli';
            case 'TrueFalse': return 'Doğru/Yanlış';
            case 'FillInBlank': return 'Boşluk Doldurma';
            case 'Essay': return 'Yazılı';
            case 'Matching': return 'Eşleştirme';
            default: return type;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
                <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Sınav bulunamadı</h2>
                <Link to="/exams" className="text-rose-500 hover:text-rose-600">← Sınavlara Dön</Link>
            </div>
        );
    }

    const canStart = exam.status === 'InProgress' || 
        (exam.status === 'Published' && new Date(exam.startTime) <= new Date() && new Date(exam.endTime) > new Date());

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-6">
                <Link to="/exams" className="text-rose-500 hover:text-rose-600 flex items-center gap-2">
                    ← Sınavlara Dön
                </Link>
            </header>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Exam Hero */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        {getStatusInfo()}
                        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mt-4">{exam.title}</h1>
                        <div className="mt-2">
                            <span className="px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                                {exam.classroomName}
                            </span>
                        </div>
                        {exam.description && (
                            <p className="text-gray-600 mt-4">{exam.description}</p>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-rose-100 p-4 text-center">
                            <span className="text-2xl block mb-2">⏱️</span>
                            <span className="text-2xl font-bold text-gray-900">{exam.durationMinutes}</span>
                            <span className="text-gray-500 text-sm block">Dakika</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-rose-100 p-4 text-center">
                            <span className="text-2xl block mb-2">❓</span>
                            <span className="text-2xl font-bold text-gray-900">{exam.questionCount}</span>
                            <span className="text-gray-500 text-sm block">Soru</span>
                        </div>
                        <div className="bg-white rounded-2xl border border-rose-100 p-4 text-center">
                            <span className="text-2xl block mb-2">🏆</span>
                            <span className="text-2xl font-bold text-gray-900">{exam.totalPoints}</span>
                            <span className="text-gray-500 text-sm block">Toplam Puan</span>
                        </div>
                        {exam.passingScore && (
                            <div className="bg-white rounded-2xl border border-rose-100 p-4 text-center">
                                <span className="text-2xl block mb-2">✓</span>
                                <span className="text-2xl font-bold text-gray-900">{exam.passingScore}</span>
                                <span className="text-gray-500 text-sm block">Geçme Notu</span>
                            </div>
                        )}
                    </div>

                    {/* Schedule */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            📅 Sınav Zamanı
                        </h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="p-4 bg-rose-50 rounded-xl">
                                <span className="text-gray-500 text-sm block mb-1">Başlangıç:</span>
                                <span className="font-medium text-gray-900">{formatDate(exam.startTime)}</span>
                            </div>
                            <div className="p-4 bg-rose-50 rounded-xl">
                                <span className="text-gray-500 text-sm block mb-1">Bitiş:</span>
                                <span className="font-medium text-gray-900">{formatDate(exam.endTime)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            ⚙️ Sınav Ayarları
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                                    exam.shuffleQuestions ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {exam.shuffleQuestions ? '✓' : '✕'}
                                </span>
                                <span className="text-gray-700">Sorular karıştırılsın</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                                    exam.shuffleOptions ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {exam.shuffleOptions ? '✓' : '✕'}
                                </span>
                                <span className="text-gray-700">Seçenekler karıştırılsın</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                                    exam.showResults ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                                }`}>
                                    {exam.showResults ? '✓' : '✕'}
                                </span>
                                <span className="text-gray-700">Sonuçları göster</span>
                            </div>
                        </div>
                    </div>

                    {/* Questions Preview */}
                    {isInstructor && questions.length > 0 && (
                        <div className="bg-white rounded-2xl border border-rose-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                📝 Sorular ({questions.length})
                            </h3>
                            <div className="space-y-3">
                                {questions.map((q, index) => (
                                    <div key={q.id} className="p-4 bg-rose-50 rounded-xl">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-2 py-1 bg-rose-200 text-rose-700 text-xs font-medium rounded">
                                                Soru {index + 1}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500">{getQuestionTypeLabel(q.type)}</span>
                                                <span className="px-2 py-1 bg-white text-rose-600 text-xs font-medium rounded">
                                                    {q.points} puan
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-gray-700">{q.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Actions */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6 space-y-3">
                        {canStart && !isInstructor && (
                            <button 
                                className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-200"
                                onClick={handleStartExam}
                            >
                                🚀 Sınava Başla
                            </button>
                        )}

                        {isInstructor && (
                            <>
                                {exam.status === 'Draft' && (
                                    <button
                                        className="w-full px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-semibold rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                        onClick={() => setShowConfirm(true)}
                                        disabled={publishing}
                                    >
                                        {publishing ? 'Yayınlanıyor...' : '📤 Sınavı Yayınla'}
                                    </button>
                                )}
                                <Link 
                                    to={`/exams/${exam.id}/edit`} 
                                    className="w-full px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    ✏️ Düzenle
                                </Link>
                                <button 
                                    className="w-full px-4 py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
                                    onClick={handleDelete}
                                >
                                    🗑️ Sil
                                </button>
                            </>
                        )}
                    </div>

                    {/* Info */}
                    <div className="bg-white rounded-2xl border border-rose-100 p-6">
                        <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            ℹ️ Bilgilendirme
                        </h4>
                        <ul className="space-y-2 text-sm text-gray-600">
                            <li className="flex items-start gap-2">
                                <span className="text-rose-400 mt-1">•</span>
                                Sınav başladıktan sonra süre işlemeye başlar
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-rose-400 mt-1">•</span>
                                Sayfa kapatılsa bile süre devam eder
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-rose-400 mt-1">•</span>
                                Süre bitiminde sınav otomatik teslim edilir
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Sınavı Yayınla</h3>
                        <p className="text-gray-600 mb-6">Sınav yayınlandıktan sonra sorular değiştirilemez. Devam etmek istiyor musunuz?</p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handlePublish} 
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all"
                            >
                                {publishing ? 'Yayınlanıyor...' : 'Evet, Yayınla'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
