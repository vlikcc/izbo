import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { classroomApi } from '../../services/api';

export const CreateClassroomPage: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        coverImageUrl: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await classroomApi.create(formData);
            if (response.data.success) {
                navigate('/classrooms');
            } else {
                setError(response.data.message || 'Sınıf oluşturulamadı');
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
                <Link 
                    to="/classrooms" 
                    className="inline-flex items-center gap-2 text-rose-500 hover:text-rose-600 font-medium mb-4"
                >
                    ← Sınıflara Dön
                </Link>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Yeni Sınıf Oluştur</h1>
            </header>

            <div className="max-w-2xl">
                <div className="bg-white rounded-2xl border border-rose-100 p-6 lg:p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                                ⚠️ {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                                Sınıf Adı
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Örn: Matematik 101"
                                required
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                                Açıklama
                            </label>
                            <textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Sınıf hakkında kısa bilgi..."
                                rows={4}
                                required
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all resize-none"
                            />
                        </div>

                        <div>
                            <label htmlFor="coverImageUrl" className="block text-sm font-medium text-gray-700 mb-2">
                                Kapak Görseli URL (İsteğe bağlı)
                            </label>
                            <input
                                type="url"
                                id="coverImageUrl"
                                value={formData.coverImageUrl}
                                onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                                placeholder="https://example.com/image.jpg"
                                className="w-full px-4 py-3 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button 
                                type="button" 
                                onClick={() => navigate('/classrooms')} 
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                type="submit" 
                                className="flex-1 px-4 py-3 bg-gradient-to-r from-rose-500 to-rose-400 text-white font-medium rounded-xl hover:from-rose-600 hover:to-rose-500 transition-all shadow-lg shadow-rose-200 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
