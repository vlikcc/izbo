import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examApi, classroomApi } from '../../services/api';
import type { Classroom } from '../../types';
import './ExamSession.css';

interface QuestionForm {
    id: string;
    type: 'MultipleChoice' | 'TrueFalse' | 'FillInBlank' | 'Essay';
    content: string;
    options: string[];
    correctAnswer: string;
    points: number;
    explanation: string;
}

export const CreateExamPage: React.FC = () => {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingClassrooms, setLoadingClassrooms] = useState(true);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'details' | 'questions'>('details');

    const [formData, setFormData] = useState({
        classroomId: '',
        title: '',
        description: '',
        durationMinutes: 60,
        startTime: '',
        endTime: '',
        shuffleQuestions: true,
        shuffleOptions: true,
        showResults: true,
        passingScore: 50,
    });

    const [questions, setQuestions] = useState<QuestionForm[]>([]);

    useEffect(() => {
        loadClassrooms();
    }, []);

    const loadClassrooms = async () => {
        try {
            const response = await classroomApi.getMyClassrooms(1, 100);
            if (response.data.success && response.data.data) {
                setClassrooms(response.data.data.items);
            }
        } catch (err) {
            console.error('Failed to load classrooms:', err);
        } finally {
            setLoadingClassrooms(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        });
    };

    const addQuestion = () => {
        setQuestions([
            ...questions,
            {
                id: `q-${Date.now()}`,
                type: 'MultipleChoice',
                content: '',
                options: ['', '', '', ''],
                correctAnswer: '',
                points: 10,
                explanation: '',
            },
        ]);
    };

    const updateQuestion = (id: string, field: keyof QuestionForm, value: unknown) => {
        setQuestions(questions.map(q =>
            q.id === id ? { ...q, [field]: value } : q
        ));
    };

    const updateOption = (questionId: string, optionIndex: number, value: string) => {
        setQuestions(questions.map(q => {
            if (q.id === questionId) {
                const newOptions = [...q.options];
                newOptions[optionIndex] = value;
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const removeQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleSubmit = async () => {
        if (questions.length === 0) {
            setError('En az bir soru eklemelisiniz.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create exam
            const examResponse = await examApi.create({
                classroomId: formData.classroomId,
                title: formData.title,
                description: formData.description,
                durationMinutes: formData.durationMinutes,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: new Date(formData.endTime).toISOString(),
                shuffleQuestions: formData.shuffleQuestions,
                shuffleOptions: formData.shuffleOptions,
                showResults: formData.showResults,
                passingScore: formData.passingScore,
            });

            if (examResponse.data.success && examResponse.data.data) {
                const examId = examResponse.data.data.id;

                // Add questions
                for (let i = 0; i < questions.length; i++) {
                    const q = questions[i];
                    await examApi.addQuestion(examId, {
                        orderIndex: i,
                        type: q.type,
                        content: q.content,
                        options: q.type === 'MultipleChoice' ? q.options.filter(o => o.trim()) : undefined,
                        correctAnswer: q.correctAnswer,
                        points: q.points,
                        explanation: q.explanation || undefined,
                    });
                }

                navigate('/exams');
            } else {
                setError(examResponse.data.message || 'Sınav oluşturulamadı');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-exam-page">
            <header className="page-header">
                <div>
                    <h1>📋 Yeni Sınav Oluştur</h1>
                    <p>Sınıfınız için yeni bir sınav hazırlayın</p>
                </div>
            </header>

            {/* Progress Steps */}
            <div className="step-indicator">
                <div className={`step ${step === 'details' ? 'active' : 'completed'}`}>
                    <span className="step-number">1</span>
                    <span className="step-label">Sınav Bilgileri</span>
                </div>
                <div className="step-line"></div>
                <div className={`step ${step === 'questions' ? 'active' : ''}`}>
                    <span className="step-number">2</span>
                    <span className="step-label">Sorular</span>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {step === 'details' && (
                <div className="form-container">
                    <form className="create-form" onSubmit={(e) => { e.preventDefault(); setStep('questions'); }}>
                        <div className="form-group">
                            <label htmlFor="classroomId">Sınıf *</label>
                            <select
                                id="classroomId"
                                name="classroomId"
                                value={formData.classroomId}
                                onChange={handleChange}
                                required
                                disabled={loadingClassrooms}
                            >
                                <option value="">Sınıf seçin...</option>
                                {classrooms.map((classroom) => (
                                    <option key={classroom.id} value={classroom.id}>
                                        {classroom.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="title">Sınav Başlığı *</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Örn: Vize Sınavı"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">Açıklama</label>
                            <textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Sınav hakkında bilgi..."
                                rows={3}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="startTime">Başlangıç Zamanı *</label>
                                <input
                                    type="datetime-local"
                                    id="startTime"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="endTime">Bitiş Zamanı *</label>
                                <input
                                    type="datetime-local"
                                    id="endTime"
                                    name="endTime"
                                    value={formData.endTime}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="durationMinutes">Süre (Dakika) *</label>
                                <input
                                    type="number"
                                    id="durationMinutes"
                                    name="durationMinutes"
                                    value={formData.durationMinutes}
                                    onChange={handleChange}
                                    min={5}
                                    max={300}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="passingScore">Geçme Notu (%)</label>
                                <input
                                    type="number"
                                    id="passingScore"
                                    name="passingScore"
                                    value={formData.passingScore}
                                    onChange={handleChange}
                                    min={0}
                                    max={100}
                                />
                            </div>
                        </div>

                        <div className="checkbox-row">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="shuffleQuestions"
                                    checked={formData.shuffleQuestions}
                                    onChange={handleChange}
                                />
                                Soruları karıştır
                            </label>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="shuffleOptions"
                                    checked={formData.shuffleOptions}
                                    onChange={handleChange}
                                />
                                Seçenekleri karıştır
                            </label>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="showResults"
                                    checked={formData.showResults}
                                    onChange={handleChange}
                                />
                                Sonuçları göster
                            </label>
                        </div>

                        <div className="form-actions">
                            <button type="button" onClick={() => navigate('/exams')} className="cancel-btn">
                                İptal
                            </button>
                            <button type="submit" className="submit-btn">
                                Devam: Soru Ekle →
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {step === 'questions' && (
                <div className="questions-section">
                    <div className="questions-header">
                        <h2>Sorular ({questions.length})</h2>
                        <button type="button" className="add-question-btn" onClick={addQuestion}>
                            + Soru Ekle
                        </button>
                    </div>

                    {questions.length === 0 ? (
                        <div className="empty-questions">
                            <span className="empty-icon">📝</span>
                            <p>Henüz soru eklenmedi. Yukarıdaki butona tıklayarak soru ekleyin.</p>
                        </div>
                    ) : (
                        <div className="questions-list">
                            {questions.map((question, index) => (
                                <div key={question.id} className="question-form-card">
                                    <div className="question-header">
                                        <span className="question-number">Soru {index + 1}</span>
                                        <button
                                            type="button"
                                            className="remove-question-btn"
                                            onClick={() => removeQuestion(question.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="question-form-row">
                                        <div className="form-group">
                                            <label>Soru Tipi</label>
                                            <select
                                                value={question.type}
                                                onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
                                            >
                                                <option value="MultipleChoice">Çoktan Seçmeli</option>
                                                <option value="TrueFalse">Doğru/Yanlış</option>
                                                <option value="FillInBlank">Boşluk Doldurma</option>
                                                <option value="Essay">Açık Uçlu</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label>Puan</label>
                                            <input
                                                type="number"
                                                value={question.points}
                                                onChange={(e) => updateQuestion(question.id, 'points', parseInt(e.target.value))}
                                                min={1}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Soru Metni *</label>
                                        <textarea
                                            value={question.content}
                                            onChange={(e) => updateQuestion(question.id, 'content', e.target.value)}
                                            placeholder="Sorunuzu yazın..."
                                            rows={2}
                                            required
                                        />
                                    </div>

                                    {question.type === 'MultipleChoice' && (
                                        <div className="options-section">
                                            <label>Seçenekler</label>
                                            {question.options.map((option, optIndex) => (
                                                <div key={optIndex} className="option-input">
                                                    <span className="option-letter">{String.fromCharCode(65 + optIndex)}</span>
                                                    <input
                                                        type="text"
                                                        value={option}
                                                        onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                                                        placeholder={`Seçenek ${String.fromCharCode(65 + optIndex)}`}
                                                    />
                                                    <label className="correct-radio">
                                                        <input
                                                            type="radio"
                                                            name={`correct-${question.id}`}
                                                            checked={question.correctAnswer === option && option !== ''}
                                                            onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                                                        />
                                                        Doğru
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {question.type === 'TrueFalse' && (
                                        <div className="true-false-section">
                                            <label>Doğru Cevap</label>
                                            <div className="true-false-options">
                                                <label className="tf-option">
                                                    <input
                                                        type="radio"
                                                        name={`tf-${question.id}`}
                                                        checked={question.correctAnswer === 'true'}
                                                        onChange={() => updateQuestion(question.id, 'correctAnswer', 'true')}
                                                    />
                                                    Doğru
                                                </label>
                                                <label className="tf-option">
                                                    <input
                                                        type="radio"
                                                        name={`tf-${question.id}`}
                                                        checked={question.correctAnswer === 'false'}
                                                        onChange={() => updateQuestion(question.id, 'correctAnswer', 'false')}
                                                    />
                                                    Yanlış
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {(question.type === 'FillInBlank' || question.type === 'Essay') && (
                                        <div className="form-group">
                                            <label>Doğru Cevap {question.type === 'Essay' ? '(Örnek)' : ''}</label>
                                            <input
                                                type="text"
                                                value={question.correctAnswer}
                                                onChange={(e) => updateQuestion(question.id, 'correctAnswer', e.target.value)}
                                                placeholder="Doğru cevabı yazın..."
                                            />
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label>Açıklama (Opsiyonel)</label>
                                        <input
                                            type="text"
                                            value={question.explanation}
                                            onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                                            placeholder="Cevap açıklaması..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" onClick={() => setStep('details')} className="cancel-btn">
                            ← Geri
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="submit-btn"
                            disabled={loading || questions.length === 0}
                        >
                            {loading ? 'Oluşturuluyor...' : 'Sınavı Oluştur'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
