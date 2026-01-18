import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeworkApi, classroomApi } from '../../services/api';
import type { Classroom } from '../../types';
import './Homework.css';

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
        <div className="homework-page">
            <header className="page-header">
                <div>
                    <h1>📝 Yeni Ödev Oluştur</h1>
                    <p>Sınıfınız için yeni bir ödev tanımlayın</p>
                </div>
            </header>

            <div className="form-container">
                <form onSubmit={handleSubmit} className="create-form">
                    {error && <div className="error-message">{error}</div>}

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
                        <label htmlFor="title">Ödev Başlığı *</label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="Örn: Hafta 1 - Matematik Ödev"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Açıklama *</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Ödev hakkında detaylı bilgi..."
                            rows={5}
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="dueDate">Son Teslim Tarihi *</label>
                            <input
                                type="datetime-local"
                                id="dueDate"
                                name="dueDate"
                                value={formData.dueDate}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="maxScore">Maksimum Puan *</label>
                            <input
                                type="number"
                                id="maxScore"
                                name="maxScore"
                                value={formData.maxScore}
                                onChange={handleChange}
                                min={1}
                                max={1000}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="attachmentUrl">Ek Dosya URL (İsteğe bağlı)</label>
                        <input
                            type="url"
                            id="attachmentUrl"
                            name="attachmentUrl"
                            value={formData.attachmentUrl}
                            onChange={handleChange}
                            placeholder="https://example.com/dosya.pdf"
                        />
                    </div>

                    <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                name="allowLateSubmission"
                                checked={formData.allowLateSubmission}
                                onChange={handleChange}
                            />
                            <span className="checkmark"></span>
                            Geç teslime izin ver
                        </label>
                    </div>

                    {formData.allowLateSubmission && (
                        <div className="form-group">
                            <label htmlFor="latePenaltyPercent">Geç Teslim Ceza Yüzdesi</label>
                            <input
                                type="number"
                                id="latePenaltyPercent"
                                name="latePenaltyPercent"
                                value={formData.latePenaltyPercent}
                                onChange={handleChange}
                                min={0}
                                max={100}
                            />
                            <span className="form-hint">Her geç gün için puandan düşülecek yüzde</span>
                        </div>
                    )}

                    <div className="form-actions">
                        <button type="button" onClick={() => navigate('/homework')} className="cancel-btn">
                            İptal
                        </button>
                        <button type="submit" className="submit-btn" disabled={loading}>
                            {loading ? 'Oluşturuluyor...' : 'Ödevi Oluştur'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
