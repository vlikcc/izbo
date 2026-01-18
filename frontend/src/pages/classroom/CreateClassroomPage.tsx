import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classroomApi } from '../../services/api';
import './Classroom.css';

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
        <div className="classroom-page">
            <header className="page-header">
                <h1>Yeni Sınıf Oluştur</h1>
            </header>

            <div className="form-container">
                <form onSubmit={handleSubmit} className="classroom-form">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="name">Sınıf Adı</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Örn: Matematik 101"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Açıklama</label>
                        <textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Sınıf hakkında kısa bilgi..."
                            rows={4}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="coverImageUrl">Kapak Görseli URL (İsteğe bağlı)</label>
                        <input
                            type="url"
                            id="coverImageUrl"
                            value={formData.coverImageUrl}
                            onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={() => navigate('/classrooms')} className="cancel-btn">
                            İptal
                        </button>
                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Oluşturuluyor...' : 'Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
