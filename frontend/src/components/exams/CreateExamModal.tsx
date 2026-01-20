import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from '../ui';
import { examService } from '../../services/exam.service';
import { classroomService } from '../../services/classroom.service';
import type { CreateExamRequest, Classroom } from '../../types';
import './CreateExamModal.css';

interface CreateExamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    classroomId?: string;
}

export const CreateExamModal: React.FC<CreateExamModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    classroomId
}) => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);

    const [formData, setFormData] = useState<Partial<CreateExamRequest>>({
        title: '',
        description: '',
        durationMinutes: 60,
        startTime: '',
        endTime: '',
        shuffleQuestions: false,
        shuffleOptions: false,
        showResults: true,
        passingScore: 50,
        classroomId: classroomId || ''
    });

    useEffect(() => {
        if (isOpen && !classroomId) {
            fetchClassrooms();
        }
        if (classroomId) {
            setFormData(prev => ({ ...prev, classroomId }));
        }
    }, [isOpen, classroomId]);

    const fetchClassrooms = async () => {
        try {
            const response = await classroomService.getMyClassrooms();
            if (response && response.items) {
                setClassrooms(response.items);
            } else {
                setClassrooms([]);
            }
        } catch (error) {
            console.error('Failed to fetch classrooms', error);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: Number(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const start = new Date(formData.startTime!);
            const end = new Date(formData.endTime!);

            if (start >= end) {
                alert('Bitiş zamanı başlangıç zamanından sonra olmalıdır.');
                setIsLoading(false);
                return;
            }

            if (!formData.classroomId) {
                alert('Lütfen bir sınıf seçin.');
                setIsLoading(false);
                return;
            }

            const createdExam = await examService.createExam(formData as CreateExamRequest);
            onSuccess();
            onClose();
            setFormData({
                title: '',
                description: '',
                durationMinutes: 60,
                startTime: '',
                endTime: '',
                shuffleQuestions: false,
                shuffleOptions: false,
                showResults: true,
                passingScore: 50,
                classroomId: classroomId || ''
            });
            // Redirect to exam builder to add questions
            navigate(`/app/exams/${createdExam.id}/builder`);
        } catch (error) {
            console.error('Create exam failed:', error);
            alert('Sınav oluşturulurken bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📝 Yeni Sınav Oluştur" size="lg">
            <form onSubmit={handleSubmit} className="create-exam-form">
                {/* Classroom Selection */}
                {!classroomId && (
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">📚</span>
                            Sınıf <span className="form-required">*</span>
                        </label>
                        <select
                            name="classroomId"
                            className="form-select"
                            value={formData.classroomId}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Sınıf seçiniz...</option>
                            <option value="all">🌐 Tüm Sınıflar (Herkes katılabilir)</option>
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        {formData.classroomId === 'all' && (
                            <span className="form-helper" style={{ color: 'var(--color-info)' }}>
                                ℹ️ Bu sınav tüm sınıflardaki öğrencilere açık olacaktır
                            </span>
                        )}
                    </div>
                )}

                {/* Title */}
                <div className="form-group">
                    <label className="form-label">
                        <span className="form-label-icon">✏️</span>
                        Sınav Başlığı <span className="form-required">*</span>
                    </label>
                    <input
                        type="text"
                        name="title"
                        className="form-input"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Örn: Vize Sınavı, Final Sınavı..."
                        required
                    />
                </div>

                {/* Description */}
                <div className="form-group">
                    <label className="form-label">
                        <span className="form-label-icon">📄</span>
                        Açıklama
                    </label>
                    <textarea
                        name="description"
                        className="form-textarea"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Sınav hakkında öğrencilere bilgilendirme yazın..."
                    />
                </div>

                {/* Date Time Row */}
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">🗓️</span>
                            Başlangıç Zamanı <span className="form-required">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            name="startTime"
                            className="form-input"
                            value={formData.startTime}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">🏁</span>
                            Bitiş Zamanı <span className="form-required">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            name="endTime"
                            className="form-input"
                            value={formData.endTime}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>

                {/* Duration and Passing Score Row */}
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">⏱️</span>
                            Süre (Dakika) <span className="form-required">*</span>
                        </label>
                        <input
                            type="number"
                            name="durationMinutes"
                            className="form-input"
                            value={formData.durationMinutes}
                            onChange={handleChange}
                            min="1"
                            max="480"
                            required
                        />
                        <span className="form-helper">Öğrencinin sınavı bitirmesi için verilen süre</span>
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">🎯</span>
                            Geçme Notu
                        </label>
                        <input
                            type="number"
                            name="passingScore"
                            className="form-input"
                            value={formData.passingScore}
                            onChange={handleChange}
                            min="0"
                            max="100"
                        />
                        <span className="form-helper">0-100 arası bir değer girin</span>
                    </div>
                </div>

                {/* Options Checkbox Group */}
                <div className="form-checkbox-group">
                    <span className="form-checkbox-group-title">
                        ⚙️ Sınav Ayarları
                    </span>

                    <label className="form-checkbox-label">
                        <input
                            type="checkbox"
                            name="shuffleQuestions"
                            className="form-checkbox"
                            checked={formData.shuffleQuestions}
                            onChange={handleChange}
                        />
                        <span className="form-checkbox-text">Soruları karıştır</span>
                    </label>

                    <label className="form-checkbox-label">
                        <input
                            type="checkbox"
                            name="shuffleOptions"
                            className="form-checkbox"
                            checked={formData.shuffleOptions}
                            onChange={handleChange}
                        />
                        <span className="form-checkbox-text">Şıkları karıştır</span>
                    </label>

                    <label className="form-checkbox-label">
                        <input
                            type="checkbox"
                            name="showResults"
                            className="form-checkbox"
                            checked={formData.showResults}
                            onChange={handleChange}
                        />
                        <span className="form-checkbox-text">Sınav bitiminde sonuçları göster</span>
                    </label>
                </div>

                {/* Actions */}
                <div className="form-actions">
                    <Button type="button" variant="ghost" size="md" onClick={onClose}>
                        İptal
                    </Button>
                    <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
                        ✨ Sınav Oluştur
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
