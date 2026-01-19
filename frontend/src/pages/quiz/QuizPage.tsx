import React, { useState, useEffect } from 'react';
import { quizApi, classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Quiz, Classroom } from '../../types';

export const QuizListPage: React.FC = () => {
    const { user } = useAuthStore();
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        loadClassrooms();
    }, []);

    useEffect(() => {
        if (selectedClassroom) {
            loadQuizzes();
        }
    }, [selectedClassroom]);

    const loadClassrooms = async () => {
        try {
            const response = await classroomApi.getMyClassrooms(1, 50);
            if (response.data.success && response.data.data) {
                setClassrooms(response.data.data.items);
                if (response.data.data.items.length > 0) {
                    setSelectedClassroom(response.data.data.items[0].id);
                }
            }
        } catch (error) {
            const mockClassrooms = [
                { id: 'c1', name: 'Matematik 101', description: '', instructorId: '', studentCount: 25, isActive: true, createdAt: '' },
                { id: 'c2', name: 'Fizik 102', description: '', instructorId: '', studentCount: 20, isActive: true, createdAt: '' }
            ];
            setClassrooms(mockClassrooms);
            setSelectedClassroom(mockClassrooms[0].id);
        } finally {
            setLoading(false);
        }
    };

    const loadQuizzes = async () => {
        try {
            const response = await quizApi.getAll(selectedClassroom);
            if (response.data.success && response.data.data) {
                setQuizzes(response.data.data);
            }
        } catch (error) {
            setQuizzes([
                {
                    id: 'q1',
                    classroomId: selectedClassroom,
                    title: 'Bugünkü ders konusunu anladınız mı?',
                    type: 'Poll',
                    isActive: true,
                    options: ['Evet, çok iyi anladım', 'Kısmen anladım', 'Hayır, tekrar gerekiyor'],
                    responses: [
                        { optionIndex: 0, count: 12 },
                        { optionIndex: 1, count: 8 },
                        { optionIndex: 2, count: 3 }
                    ],
                    totalResponses: 23,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'q2',
                    classroomId: selectedClassroom,
                    title: 'Yoklama - 17 Ocak 2026',
                    type: 'Attendance',
                    isActive: false,
                    options: ['Buradayım'],
                    responses: [{ optionIndex: 0, count: 22 }],
                    totalResponses: 22,
                    createdAt: new Date(Date.now() - 86400000).toISOString()
                }
            ]);
        }
    };

    const handleVote = async (quizId: string, optionIndex: number) => {
        try {
            await quizApi.respond(quizId, optionIndex);
            setQuizzes(prev => prev.map(q => {
                if (q.id === quizId) {
                    const newResponses = [...q.responses];
                    newResponses[optionIndex] = {
                        optionIndex,
                        count: (newResponses[optionIndex]?.count || 0) + 1
                    };
                    return { ...q, responses: newResponses, totalResponses: q.totalResponses + 1 };
                }
                return q;
            }));
        } catch (error) {
            setQuizzes(prev => prev.map(q => {
                if (q.id === quizId) {
                    const newResponses = [...q.responses];
                    newResponses[optionIndex] = {
                        optionIndex,
                        count: (newResponses[optionIndex]?.count || 0) + 1
                    };
                    return { ...q, responses: newResponses, totalResponses: q.totalResponses + 1 };
                }
                return q;
            }));
        }
    };

    const handleCloseQuiz = async (quizId: string) => {
        try {
            await quizApi.close(quizId);
            setQuizzes(prev => prev.map(q => 
                q.id === quizId ? { ...q, isActive: false } : q
            ));
        } catch (error) {
            setQuizzes(prev => prev.map(q => 
                q.id === quizId ? { ...q, isActive: false } : q
            ));
        }
    };

    const handleDeleteQuiz = async (quizId: string) => {
        if (!confirm('Bu anketi silmek istediğinize emin misiniz?')) return;
        
        try {
            await quizApi.delete(quizId);
            setQuizzes(prev => prev.filter(q => q.id !== quizId));
        } catch (error) {
            setQuizzes(prev => prev.filter(q => q.id !== quizId));
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

    const getTypeLabel = (type: Quiz['type']) => {
        switch (type) {
            case 'Poll': return '📊 Anket';
            case 'Attendance': return '✋ Yoklama';
            case 'Quiz': return '❓ Quiz';
            default: return type;
        }
    };

    const activeQuizzes = quizzes.filter(q => q.isActive);
    const closedQuizzes = quizzes.filter(q => !q.isActive);

    return (
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        📊 Anketler & Yoklama
                    </h1>
                    <p className="text-gray-500 mt-1">Sınıfınızda anket oluşturun ve sonuçları görüntüleyin</p>
                </div>
                {isInstructor && (
                    <button 
                        className="px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        + Yeni Anket
                    </button>
                )}
            </header>

            {/* Filters */}
            <div className="mb-6">
                <select 
                    value={selectedClassroom} 
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                >
                    {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {activeQuizzes.length > 0 && (
                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                Aktif Anketler
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {activeQuizzes.map(quiz => (
                                    <QuizCard
                                        key={quiz.id}
                                        quiz={quiz}
                                        isInstructor={isInstructor}
                                        onVote={handleVote}
                                        onClose={handleCloseQuiz}
                                        onDelete={handleDeleteQuiz}
                                        formatDate={formatDate}
                                        getTypeLabel={getTypeLabel}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <section>
                        {activeQuizzes.length > 0 && closedQuizzes.length > 0 && (
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 Tamamlanan Anketler</h2>
                        )}
                        {closedQuizzes.length === 0 && activeQuizzes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-rose-100">
                                <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center text-4xl mb-4">
                                    📊
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">Henüz anket yok</h3>
                                <p className="text-gray-500">Bu sınıfta henüz anket oluşturulmamış</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {closedQuizzes.map(quiz => (
                                    <QuizCard
                                        key={quiz.id}
                                        quiz={quiz}
                                        isInstructor={isInstructor}
                                        onVote={handleVote}
                                        onClose={handleCloseQuiz}
                                        onDelete={handleDeleteQuiz}
                                        formatDate={formatDate}
                                        getTypeLabel={getTypeLabel}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {isCreateModalOpen && (
                <CreateQuizModal
                    classroomId={selectedClassroom}
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreated={(newQuiz) => {
                        setQuizzes(prev => [newQuiz, ...prev]);
                        setIsCreateModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

interface QuizCardProps {
    quiz: Quiz;
    isInstructor: boolean;
    onVote: (quizId: string, optionIndex: number) => void;
    onClose: (quizId: string) => void;
    onDelete: (quizId: string) => void;
    formatDate: (date: string) => string;
    getTypeLabel: (type: Quiz['type']) => string;
}

const QuizCard: React.FC<QuizCardProps> = ({
    quiz,
    isInstructor,
    onVote,
    onClose,
    onDelete,
    formatDate,
    getTypeLabel
}) => {
    const [hasVoted, setHasVoted] = useState(false);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    const getPercentage = (count: number) => {
        if (quiz.totalResponses === 0) return 0;
        return Math.round((count / quiz.totalResponses) * 100);
    };

    const handleVote = (optionIndex: number) => {
        if (hasVoted || !quiz.isActive) return;
        setSelectedOption(optionIndex);
        setHasVoted(true);
        onVote(quiz.id, optionIndex);
    };

    return (
        <div className={`bg-white rounded-2xl border border-rose-100 p-5 ${!quiz.isActive ? 'opacity-75' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <span className="px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                    {getTypeLabel(quiz.type)}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatDate(quiz.createdAt)}</span>
                    {isInstructor && (
                        <div className="flex items-center gap-1">
                            {quiz.isActive && (
                                <button 
                                    className="w-7 h-7 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-amber-50 hover:text-amber-500 transition-colors text-sm"
                                    onClick={() => onClose(quiz.id)}
                                    title="Anketi kapat"
                                >
                                    ⏹️
                                </button>
                            )}
                            <button 
                                className="w-7 h-7 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors text-sm"
                                onClick={() => onDelete(quiz.id)}
                                title="Sil"
                            >
                                🗑️
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <h3 className="text-gray-900 font-medium mb-3">{quiz.title}</h3>

            {quiz.expiresAt && quiz.isActive && (
                <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg mb-3">
                    ⏰ {formatDate(quiz.expiresAt)} tarihinde sona erecek
                </div>
            )}

            <div className="space-y-2">
                {quiz.options?.map((option, index) => {
                    const response = quiz.responses.find(r => r.optionIndex === index);
                    const count = response?.count || 0;
                    const percentage = getPercentage(count);
                    const isSelected = selectedOption === index;
                    const showResults = !quiz.isActive || hasVoted || isInstructor;

                    return (
                        <button
                            key={index}
                            className={`w-full relative p-3 rounded-xl border-2 text-left transition-all ${
                                isSelected 
                                    ? 'border-rose-500 bg-rose-50' 
                                    : 'border-rose-100 hover:border-rose-200'
                            } ${(hasVoted || !quiz.isActive) ? 'cursor-default' : 'cursor-pointer'}`}
                            onClick={() => handleVote(index)}
                            disabled={hasVoted || !quiz.isActive}
                        >
                            <span className="relative z-10 text-sm text-gray-700">{option}</span>
                            {showResults && (
                                <>
                                    <div 
                                        className="absolute inset-0 bg-rose-100 rounded-xl transition-all"
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 z-10">
                                        {count} ({percentage}%)
                                    </span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-rose-50">
                <span className="text-sm text-gray-500">
                    👥 {quiz.totalResponses} yanıt
                </span>
                {!quiz.isActive && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-lg">
                        Tamamlandı
                    </span>
                )}
            </div>
        </div>
    );
};

interface CreateQuizModalProps {
    classroomId: string;
    onClose: () => void;
    onCreated: (quiz: Quiz) => void;
}

const CreateQuizModal: React.FC<CreateQuizModalProps> = ({
    classroomId,
    onClose,
    onCreated
}) => {
    const [formData, setFormData] = useState({
        title: '',
        type: 'Poll' as Quiz['type'],
        options: ['', ''],
        expiresInMinutes: 0
    });
    const [loading, setLoading] = useState(false);

    const handleAddOption = () => {
        setFormData({ ...formData, options: [...formData.options, ''] });
    };

    const handleRemoveOption = (index: number) => {
        if (formData.options.length <= 2) return;
        setFormData({ 
            ...formData, 
            options: formData.options.filter((_, i) => i !== index) 
        });
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...formData.options];
        newOptions[index] = value;
        setFormData({ ...formData, options: newOptions });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const validOptions = formData.options.filter(o => o.trim());
        if (validOptions.length < 2) {
            alert('En az 2 seçenek gereklidir');
            setLoading(false);
            return;
        }

        try {
            const response = await quizApi.create({
                classroomId,
                title: formData.title,
                type: formData.type,
                options: validOptions,
                expiresInMinutes: formData.expiresInMinutes || undefined
            });
            if (response.data.success && response.data.data) {
                onCreated(response.data.data);
            }
        } catch {
            const mockQuiz: Quiz = {
                id: Math.random().toString(36).substring(7),
                classroomId,
                title: formData.title,
                type: formData.type,
                isActive: true,
                options: validOptions,
                responses: validOptions.map((_, i) => ({ optionIndex: i, count: 0 })),
                totalResponses: 0,
                createdAt: new Date().toISOString(),
                expiresAt: formData.expiresInMinutes 
                    ? new Date(Date.now() + formData.expiresInMinutes * 60000).toISOString()
                    : undefined
            };
            onCreated(mockQuiz);
        } finally {
            setLoading(false);
        }
    };

    const handleTypeChange = (type: Quiz['type']) => {
        setFormData({ 
            ...formData, 
            type,
            options: type === 'Attendance' ? ['Buradayım'] : formData.options
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-rose-100 relative">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        📊 Yeni Anket Oluştur
                    </h2>
                    <button 
                        className="absolute top-4 right-4 w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                                formData.type === 'Poll' 
                                    ? 'bg-rose-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-rose-50'
                            }`}
                            onClick={() => handleTypeChange('Poll')}
                        >
                            📊 Anket
                        </button>
                        <button
                            type="button"
                            className={`flex-1 px-4 py-3 rounded-xl font-medium transition-all ${
                                formData.type === 'Attendance' 
                                    ? 'bg-rose-500 text-white' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-rose-50'
                            }`}
                            onClick={() => handleTypeChange('Attendance')}
                        >
                            ✋ Yoklama
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Soru / Başlık</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder={formData.type === 'Attendance' ? 'Örn: Yoklama - 17 Ocak' : 'Sorunuzu yazın...'}
                            required
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        />
                    </div>

                    {formData.type !== 'Attendance' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Seçenekler</label>
                            <div className="space-y-2">
                                {formData.options.map((option, index) => (
                                    <div key={index} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            placeholder={`Seçenek ${index + 1}`}
                                            className="flex-1 px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                        />
                                        {formData.options.length > 2 && (
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveOption(index)}
                                                className="w-12 h-12 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="w-full px-4 py-3 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition-colors"
                                >
                                    + Seçenek Ekle
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Süre (dakika, opsiyonel)</label>
                        <input
                            type="number"
                            value={formData.expiresInMinutes || ''}
                            onChange={(e) => setFormData({ ...formData, expiresInMinutes: parseInt(e.target.value) || 0 })}
                            placeholder="Sınırsız için boş bırakın"
                            min={0}
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            İptal
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                        >
                            {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
