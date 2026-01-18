import React, { useState, useEffect } from 'react';
import { quizApi, classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Quiz, Classroom } from '../../types';
import './Quiz.css';

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
            // Mock data
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
            // Mock data
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
                },
                {
                    id: 'q3',
                    classroomId: selectedClassroom,
                    title: 'Sınıf gezisi için hangi tarih uygun?',
                    type: 'Poll',
                    isActive: true,
                    options: ['25 Ocak Cumartesi', '26 Ocak Pazar', '1 Şubat Cumartesi'],
                    responses: [
                        { optionIndex: 0, count: 15 },
                        { optionIndex: 1, count: 5 },
                        { optionIndex: 2, count: 4 }
                    ],
                    totalResponses: 24,
                    createdAt: new Date(Date.now() - 3600000).toISOString(),
                    expiresAt: new Date(Date.now() + 86400000).toISOString()
                }
            ]);
        }
    };

    const handleVote = async (quizId: string, optionIndex: number) => {
        try {
            await quizApi.respond(quizId, optionIndex);
            // Update local state
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
            // Mock vote
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
        <div className="quiz-page">
            <header className="page-header">
                <div>
                    <h1>📊 Anketler & Yoklama</h1>
                    <p>Sınıfınızda anket oluşturun ve sonuçları görüntüleyin</p>
                </div>
                {isInstructor && (
                    <button 
                        className="create-btn"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        + Yeni Anket
                    </button>
                )}
            </header>

            <div className="quiz-filters">
                <select 
                    value={selectedClassroom} 
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="classroom-filter"
                >
                    {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Yükleniyor...</p>
                </div>
            ) : (
                <div className="quiz-content">
                    {activeQuizzes.length > 0 && (
                        <section className="active-section">
                            <h2>🔴 Aktif Anketler</h2>
                            <div className="quiz-list">
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

                    <section className="closed-section">
                        {activeQuizzes.length > 0 && <h2>📋 Tamamlanan Anketler</h2>}
                        {closedQuizzes.length === 0 && activeQuizzes.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">📊</span>
                                <h3>Henüz anket yok</h3>
                                <p>Bu sınıfta henüz anket oluşturulmamış</p>
                            </div>
                        ) : (
                            <div className="quiz-list">
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
        <div className={`quiz-card ${!quiz.isActive ? 'closed' : ''}`}>
            <div className="quiz-header">
                <span className="quiz-type">{getTypeLabel(quiz.type)}</span>
                <span className="quiz-date">{formatDate(quiz.createdAt)}</span>
                {isInstructor && (
                    <div className="quiz-actions">
                        {quiz.isActive && (
                            <button 
                                className="close-quiz-btn"
                                onClick={() => onClose(quiz.id)}
                                title="Anketi kapat"
                            >
                                ⏹️
                            </button>
                        )}
                        <button 
                            className="delete-quiz-btn"
                            onClick={() => onDelete(quiz.id)}
                            title="Sil"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>

            <h3 className="quiz-title">{quiz.title}</h3>

            {quiz.expiresAt && quiz.isActive && (
                <div className="quiz-expires">
                    ⏰ {formatDate(quiz.expiresAt)} tarihinde sona erecek
                </div>
            )}

            <div className="quiz-options">
                {quiz.options?.map((option, index) => {
                    const response = quiz.responses.find(r => r.optionIndex === index);
                    const count = response?.count || 0;
                    const percentage = getPercentage(count);
                    const isSelected = selectedOption === index;
                    const showResults = !quiz.isActive || hasVoted || isInstructor;

                    return (
                        <button
                            key={index}
                            className={`option-btn ${isSelected ? 'selected' : ''} ${showResults ? 'show-results' : ''}`}
                            onClick={() => handleVote(index)}
                            disabled={hasVoted || !quiz.isActive}
                        >
                            <span className="option-text">{option}</span>
                            {showResults && (
                                <>
                                    <div 
                                        className="option-bar" 
                                        style={{ width: `${percentage}%` }}
                                    ></div>
                                    <span className="option-percentage">
                                        {count} ({percentage}%)
                                    </span>
                                </>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="quiz-footer">
                <span className="total-responses">
                    👥 {quiz.totalResponses} yanıt
                </span>
                {!quiz.isActive && (
                    <span className="closed-badge">Tamamlandı</span>
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
            // Mock creation
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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content quiz-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📊 Yeni Anket Oluştur</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="quiz-type-selector">
                        <button
                            type="button"
                            className={`type-btn ${formData.type === 'Poll' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('Poll')}
                        >
                            📊 Anket
                        </button>
                        <button
                            type="button"
                            className={`type-btn ${formData.type === 'Attendance' ? 'active' : ''}`}
                            onClick={() => handleTypeChange('Attendance')}
                        >
                            ✋ Yoklama
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Soru / Başlık</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder={formData.type === 'Attendance' ? 'Örn: Yoklama - 17 Ocak' : 'Sorunuzu yazın...'}
                            required
                        />
                    </div>

                    {formData.type !== 'Attendance' && (
                        <div className="form-group">
                            <label>Seçenekler</label>
                            <div className="options-builder">
                                {formData.options.map((option, index) => (
                                    <div key={index} className="option-input">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handleOptionChange(index, e.target.value)}
                                            placeholder={`Seçenek ${index + 1}`}
                                        />
                                        {formData.options.length > 2 && (
                                            <button 
                                                type="button"
                                                onClick={() => handleRemoveOption(index)}
                                                className="remove-option-btn"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddOption}
                                    className="add-option-btn"
                                >
                                    + Seçenek Ekle
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>Süre (dakika, opsiyonel)</label>
                        <input
                            type="number"
                            value={formData.expiresInMinutes || ''}
                            onChange={(e) => setFormData({ ...formData, expiresInMinutes: parseInt(e.target.value) || 0 })}
                            placeholder="Sınırsız için boş bırakın"
                            min={0}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose}>İptal</button>
                        <button type="submit" disabled={loading}>
                            {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
