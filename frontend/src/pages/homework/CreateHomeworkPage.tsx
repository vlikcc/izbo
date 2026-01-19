import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeworkApi, classroomApi } from '../../services/api';
import type { Classroom } from '../../types';

export const CreateHomeworkPage: React.FC = () => {
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingClassrooms, setLoadingClassrooms] = useState(true);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        classroomId: '',
        title: '',
        description: '',
        attachmentUrl: '',
        maxScore: 100,
        dueDate: '',
        allowLateSubmission: false,
        latePenaltyPercent: 10,
    });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await homeworkApi.create({
                classroomId: formData.classroomId,
                title: formData.title,
                description: formData.description,
                attachmentUrl: formData.attachmentUrl || undefined,
                maxScore: formData.maxScore,
                dueDate: new Date(formData.dueDate).toISOString(),
                allowLateSubmission: formData.allowLateSubmission,
                latePenaltyPercent: formData.latePenaltyPercent,
            });

            if (response.data.success) {
                navigate('/homework');
            } else {
                setError(response.data.message || 'Ödev oluşturulamadı');
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
                    📝 Yeni Ödev Oluştur
                </h1>
                <p className="text-gray-500 mt-1">Sınıfınız için yeni bir ödev tanımlayın</p>
            </header>

            <div className="max-w-2xl mx-auto">
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-rose-100 p-6 space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                            {error}
                        </div>
                    )}

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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ödev Başlığı *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Örn: Hafta 1 - Matematik Ödev"
                            required
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama *</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Ödev hakkında detaylı bilgi..."
                            rows={5}
                            required
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                        />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Son Teslim Tarihi *</label>
                            <input
                                type="datetime-local"
                                name="dueDate"
                                value={formData.dueDate}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Maksimum Puan *</label>
                            <input
                                type="number"
                                name="maxScore"
                                value={formData.maxScore}
                                onChange={handleChange}
                                min={1}
                                max={1000}
                                required
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Ek Dosya URL (İsteğe bağlı)</label>
                        <input
                            type="url"
                            name="attachmentUrl"
                            value={formData.attachmentUrl}
                            onChange={handleChange}
                            placeholder="https://example.com/dosya.pdf"
                            className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="allowLateSubmission"
                                checked={formData.allowLateSubmission}
                                onChange={handleChange}
                                className="w-5 h-5 rounded text-rose-500 focus:ring-rose-300 border-rose-200"
                            />
                            <span className="text-gray-700">Geç teslime izin ver</span>
                        </label>
                    </div>

                    {formData.allowLateSubmission && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Geç Teslim Ceza Yüzdesi</label>
                            <input
                                type="number"
                                name="latePenaltyPercent"
                                value={formData.latePenaltyPercent}
                                onChange={handleChange}
                                min={0}
                                max={100}
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                            <p className="text-sm text-gray-500 mt-1">Her geç gün için puandan düşülecek yüzde</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button 
                            type="button" 
                            onClick={() => navigate('/homework')} 
                            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                        >
                            İptal
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Oluşturuluyor...' : 'Ödevi Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
