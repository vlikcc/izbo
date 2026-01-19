import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examApi } from '../../services/api';
import { useExamHub } from '../../hooks/useSignalR';
import type { StartExamResponse, ExamResult } from '../../types';

export const ExamSessionPage: React.FC = () => {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { invoke } = useExamHub();

    const [session, setSession] = useState<StartExamResponse | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<ExamResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        startExam();
    }, [examId]);

    useEffect(() => {
        if (remainingSeconds <= 0) return;

        const timer = setInterval(() => {
            setRemainingSeconds((prev) => {
                if (prev <= 1) {
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [remainingSeconds]);

    const startExam = async () => {
        try {
            const response = await examApi.startExam(examId!);
            if (response.data.success && response.data.data) {
                setSession(response.data.data);
                setRemainingSeconds(response.data.data.remainingSeconds);
                invoke('JoinExam', examId);
            } else {
                setError(response.data.message || 'Sınav başlatılamadı');
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setError(error.response?.data?.message || 'Sınav başlatılırken hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = useCallback(async (questionId: string, answer: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: answer }));

        if (session) {
            await examApi.saveAnswer(session.sessionId, { questionId, answer });
        }
    }, [session]);

    const handleSubmit = async () => {
        if (!session) return;

        setSubmitting(true);
        try {
            const response = await examApi.submitExam(session.sessionId);
            if (response.data.success && response.data.data) {
                setResult(response.data.data);
            }
        } catch (err) {
            console.error('Submit failed:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
                <div className="w-10 h-10 mb-4 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin"></div>
                <p className="text-gray-500">Sınav yükleniyor...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50">
                <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md">
                    <div className="text-4xl mb-4">❌</div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Hata</h2>
                    <p className="text-gray-600 mb-6">{error}</p>
                    <button 
                        onClick={() => navigate('/exams')}
                        className="px-6 py-3 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors"
                    >
                        Sınavlara Dön
                    </button>
                </div>
            </div>
        );
    }

    if (result) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 p-4">
                <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md w-full">
                    <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-4xl ${
                        result.isPassed ? 'bg-emerald-100' : 'bg-red-100'
                    }`}>
                        {result.isPassed ? '🎉' : '😔'}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        {result.isPassed ? 'Tebrikler!' : 'Maalesef'}
                    </h1>
                    <h2 className="text-gray-600 mb-6">{result.examTitle}</h2>

                    <div className="mb-6">
                        <span className="text-5xl font-bold text-gray-900">{result.totalScore}</span>
                        <span className="text-2xl text-gray-400">/ {result.maxScore}</span>
                    </div>

                    <div className="mb-6">
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                            <div
                                className={`h-full rounded-full ${result.isPassed ? 'bg-emerald-500' : 'bg-red-500'}`}
                                style={{ width: `${result.percentage}%` }}
                            ></div>
                        </div>
                        <span className="text-gray-600">%{result.percentage.toFixed(1)}</span>
                    </div>

                    <p className={`text-lg font-semibold mb-6 ${result.isPassed ? 'text-emerald-600' : 'text-red-600'}`}>
                        {result.isPassed ? '✓ Geçtiniz' : '✕ Kaldınız'}
                    </p>

                    <button 
                        onClick={() => navigate('/exams')} 
                        className="w-full px-6 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                    >
                        Sınavlara Dön
                    </button>
                </div>
            </div>
        );
    }

    if (!session) return null;

    const currentQuestion = session.questions[currentQuestionIndex];
    const totalQuestions = session.questions.length;
    const answeredCount = Object.keys(answers).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-rose-100 p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-gray-600">Soru {currentQuestionIndex + 1} / {totalQuestions}</span>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-rose-500 rounded-full transition-all"
                            style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
                        ></div>
                    </div>
                </div>

                <div className={`px-4 py-2 rounded-xl font-mono font-bold ${
                    remainingSeconds < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-rose-100 text-rose-600'
                }`}>
                    ⏱️ {formatTime(remainingSeconds)}
                </div>

                <div className="text-gray-600">
                    ✓ {answeredCount} / {totalQuestions} yanıtlandı
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 p-4 lg:p-8 flex items-center justify-center">
                <div className="bg-white rounded-2xl border border-rose-100 p-6 lg:p-8 max-w-3xl w-full">
                    <div className="flex items-center justify-between mb-4">
                        <span className="px-3 py-1 bg-rose-100 text-rose-600 text-sm font-medium rounded-full">
                            {currentQuestion.type === 'MultipleChoice' ? 'Çoktan Seçmeli' :
                             currentQuestion.type === 'TrueFalse' ? 'Doğru/Yanlış' :
                             currentQuestion.type === 'FillInBlank' ? 'Boşluk Doldurma' : 'Yazılı'}
                        </span>
                        <span className="px-3 py-1 bg-amber-100 text-amber-600 text-sm font-medium rounded-full">
                            {currentQuestion.points} puan
                        </span>
                    </div>

                    <div className="mb-6">
                        <p className="text-lg text-gray-900">{currentQuestion.content}</p>
                        {currentQuestion.imageUrl && (
                            <img src={currentQuestion.imageUrl} alt="Question" className="mt-4 rounded-xl max-w-full" />
                        )}
                    </div>

                    <div className="space-y-3">
                        {currentQuestion.type === 'MultipleChoice' && currentQuestion.options?.map((option, index) => (
                            <button
                                key={index}
                                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                                    answers[currentQuestion.id] === option 
                                        ? 'border-rose-500 bg-rose-50' 
                                        : 'border-rose-100 hover:border-rose-200 hover:bg-rose-50/50'
                                }`}
                                onClick={() => handleAnswer(currentQuestion.id, option)}
                            >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-medium ${
                                    answers[currentQuestion.id] === option 
                                        ? 'bg-rose-500 text-white' 
                                        : 'bg-rose-100 text-rose-600'
                                }`}>
                                    {String.fromCharCode(65 + index)}
                                </span>
                                <span className="text-gray-700">{option}</span>
                            </button>
                        ))}

                        {currentQuestion.type === 'TrueFalse' && (
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        answers[currentQuestion.id] === 'true' 
                                            ? 'border-emerald-500 bg-emerald-50' 
                                            : 'border-rose-100 hover:border-emerald-200 hover:bg-emerald-50/50'
                                    }`}
                                    onClick={() => handleAnswer(currentQuestion.id, 'true')}
                                >
                                    <span className="text-lg font-medium text-emerald-600">✓ Doğru</span>
                                </button>
                                <button
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        answers[currentQuestion.id] === 'false' 
                                            ? 'border-red-500 bg-red-50' 
                                            : 'border-rose-100 hover:border-red-200 hover:bg-red-50/50'
                                    }`}
                                    onClick={() => handleAnswer(currentQuestion.id, 'false')}
                                >
                                    <span className="text-lg font-medium text-red-600">✕ Yanlış</span>
                                </button>
                            </div>
                        )}

                        {(currentQuestion.type === 'FillInBlank' || currentQuestion.type === 'Essay') && (
                            <textarea
                                value={answers[currentQuestion.id] || ''}
                                onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                                placeholder="Cevabınızı yazın..."
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                                rows={currentQuestion.type === 'Essay' ? 6 : 2}
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-rose-100 p-4">
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {session.questions.map((q, index) => (
                        <button
                            key={q.id}
                            className={`w-10 h-10 rounded-lg font-medium transition-all ${
                                index === currentQuestionIndex 
                                    ? 'bg-rose-500 text-white' 
                                    : answers[q.id] 
                                        ? 'bg-emerald-100 text-emerald-600' 
                                        : 'bg-gray-100 text-gray-600 hover:bg-rose-50'
                            }`}
                            onClick={() => setCurrentQuestionIndex(index)}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>

                <div className="flex justify-center gap-4">
                    <button
                        className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                        onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                        disabled={currentQuestionIndex === 0}
                    >
                        ← Önceki
                    </button>

                    {currentQuestionIndex < totalQuestions - 1 ? (
                        <button
                            className="px-6 py-3 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors"
                            onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                        >
                            Sonraki →
                        </button>
                    ) : (
                        <button
                            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-500 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? 'Gönderiliyor...' : '✓ Sınavı Bitir'}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
};
