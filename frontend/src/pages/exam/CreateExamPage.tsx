import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examApi, classroomApi } from '../../services/api';
import type { Classroom } from '../../types';

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
        <div className="p-6 lg:p-8 bg-gradient-to-br from-rose-50/50 via-white to-orange-50/50 min-h-screen">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
                    📋 Yeni Sınav Oluştur
                </h1>
                <p className="text-gray-500 mt-1">Sınıfınız için yeni bir sınav hazırlayın</p>
            </header>

            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-4 mb-8">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                    step === 'details' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                    <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                    <span className="font-medium">Sınav Bilgileri</span>
                </div>
                <div className="w-12 h-0.5 bg-rose-200"></div>
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                    step === 'questions' ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                    <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-medium">2</span>
                    <span className="font-medium">Sorular</span>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                    {error}
                </div>
            )}

            {step === 'details' && (
                <div className="max-w-2xl mx-auto">
                    <form className="bg-white rounded-2xl border border-rose-100 p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); setStep('questions'); }}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Sınıf *</label>
                            <select
                                name="classroomId"
                                value={formData.classroomId}
                                onChange={handleChange}
                                required
                                disabled={loadingClassrooms}
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            >
                                <option value="">Sınıf seçin...</option>
                                {classrooms.map((classroom) => (
                                    <option key={classroom.id} value={classroom.id}>
                                        {classroom.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Sınav Başlığı *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Örn: Vize Sınavı"
                                required
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Sınav hakkında bilgi..."
                                rows={3}
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                            />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Başlangıç Zamanı *</label>
                                <input
                                    type="datetime-local"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Bitiş Zamanı *</label>
                                <input
                                    type="datetime-local"
                                    name="endTime"
                                    value={formData.endTime}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Süre (Dakika) *</label>
                                <input
                                    type="number"
                                    name="durationMinutes"
                                    value={formData.durationMinutes}
                                    onChange={handleChange}
                                    min={5}
                                    max={300}
                                    required
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Geçme Notu</label>
                                <input
                                    type="number"
                                    name="passingScore"
                                    value={formData.passingScore}
                                    onChange={handleChange}
                                    min={0}
                                    max={100}
                                    className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="shuffleQuestions"
                                    checked={formData.shuffleQuestions}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded text-rose-500 focus:ring-rose-300 border-rose-200"
                                />
                                <span className="text-gray-700">Soruları karıştır</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="shuffleOptions"
                                    checked={formData.shuffleOptions}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded text-rose-500 focus:ring-rose-300 border-rose-200"
                                />
                                <span className="text-gray-700">Seçenekleri karıştır</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="showResults"
                                    checked={formData.showResults}
                                    onChange={handleChange}
                                    className="w-5 h-5 rounded text-rose-500 focus:ring-rose-300 border-rose-200"
                                />
                                <span className="text-gray-700">Sonuçları göster</span>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button 
                                type="button" 
                                onClick={() => navigate('/exams')} 
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200"
                            >
                                Devam: Soru Ekle →
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {step === 'questions' && (
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Sorular ({questions.length})</h2>
                        <button 
                            type="button" 
                            className="px-4 py-2 bg-rose-500 text-white font-medium rounded-xl hover:bg-rose-600 transition-colors"
                            onClick={addQuestion}
                        >
                            + Soru Ekle
                        </button>
                    </div>

                    {questions.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-rose-100 p-12 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center text-3xl">
                                📝
                            </div>
                            <p className="text-gray-500">Henüz soru eklenmedi. Yukarıdaki butona tıklayarak soru ekleyin.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {questions.map((question, index) => (
                                <div key={question.id} className="bg-white rounded-2xl border border-rose-100 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="px-3 py-1 bg-rose-100 text-rose-600 font-medium rounded-full text-sm">
                                            Soru {index + 1}
                                        </span>
                                        <button
                                            type="button"
                                            className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                                            onClick={() => removeQuestion(question.id)}
                                        >
                                            ✕
                                        </button>
                                    </div>

                                    <div className="grid sm:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Soru Tipi</label>
                                            <select
                                                value={question.type}
                                                onChange={(e) => updateQuestion(question.id, 'type', e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                            >
                                                <option value="MultipleChoice">Çoktan Seçmeli</option>
                                                <option value="TrueFalse">Doğru/Yanlış</option>
                                                <option value="FillInBlank">Boşluk Doldurma</option>
                                                <option value="Essay">Açık Uçlu</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Puan</label>
                                            <input
                                                type="number"
                                                value={question.points}
                                                onChange={(e) => updateQuestion(question.id, 'points', parseInt(e.target.value))}
                                                min={1}
                                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Soru Metni *</label>
                                        <textarea
                                            value={question.content}
                                            onChange={(e) => updateQuestion(question.id, 'content', e.target.value)}
                                            placeholder="Sorunuzu yazın..."
                                            rows={2}
                                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                                        />
                                    </div>

                                    {question.type === 'MultipleChoice' && (
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Seçenekler</label>
                                            <div className="space-y-2">
                                                {question.options.map((option, optIndex) => (
                                                    <div key={optIndex} className="flex items-center gap-3">
                                                        <span className="w-8 h-8 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center font-medium text-sm">
                                                            {String.fromCharCode(65 + optIndex)}
                                                        </span>
                                                        <input
                                                            type="text"
                                                            value={option}
                                                            onChange={(e) => updateOption(question.id, optIndex, e.target.value)}
                                                            placeholder={`Seçenek ${String.fromCharCode(65 + optIndex)}`}
                                                            className="flex-1 px-4 py-2 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                                        />
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name={`correct-${question.id}`}
                                                                checked={question.correctAnswer === option && option !== ''}
                                                                onChange={() => updateQuestion(question.id, 'correctAnswer', option)}
                                                                className="w-4 h-4 text-rose-500 focus:ring-rose-300"
                                                            />
                                                            <span className="text-sm text-gray-600">Doğru</span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {question.type === 'TrueFalse' && (
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Doğru Cevap</label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-rose-50 rounded-xl">
                                                    <input
                                                        type="radio"
                                                        name={`tf-${question.id}`}
                                                        checked={question.correctAnswer === 'true'}
                                                        onChange={() => updateQuestion(question.id, 'correctAnswer', 'true')}
                                                        className="w-4 h-4 text-rose-500 focus:ring-rose-300"
                                                    />
                                                    <span className="text-gray-700">Doğru</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-rose-50 rounded-xl">
                                                    <input
                                                        type="radio"
                                                        name={`tf-${question.id}`}
                                                        checked={question.correctAnswer === 'false'}
                                                        onChange={() => updateQuestion(question.id, 'correctAnswer', 'false')}
                                                        className="w-4 h-4 text-rose-500 focus:ring-rose-300"
                                                    />
                                                    <span className="text-gray-700">Yanlış</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {(question.type === 'FillInBlank' || question.type === 'Essay') && (
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Doğru Cevap {question.type === 'Essay' ? '(Örnek)' : ''}
                                            </label>
                                            <input
                                                type="text"
                                                value={question.correctAnswer}
                                                onChange={(e) => updateQuestion(question.id, 'correctAnswer', e.target.value)}
                                                placeholder="Doğru cevabı yazın..."
                                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama (Opsiyonel)</label>
                                        <input
                                            type="text"
                                            value={question.explanation}
                                            onChange={(e) => updateQuestion(question.id, 'explanation', e.target.value)}
                                            placeholder="Cevap açıklaması..."
                                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-3 mt-6">
                        <button 
                            type="button" 
                            onClick={() => setStep('details')} 
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            ← Geri
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || questions.length === 0}
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Oluşturuluyor...' : 'Sınavı Oluştur'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
