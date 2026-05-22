import React, { useEffect, useState } from 'react';
import { Modal, Button } from '../ui';
import { homeworkService } from '../../services/homework.service';
import { classroomService } from '../../services/classroom.service';
import type { CreateHomeworkRequest, Classroom } from '../../types';
import '../exams/CreateExamModal.css';

interface CreateHomeworkModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    classroomId?: string;
}

export const CreateHomeworkModal: React.FC<CreateHomeworkModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    classroomId,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        attachmentUrl: '',
        maxScore: 100,
        dueDate: '',
        allowLateSubmission: false,
        latePenaltyPercent: 0,
        classroomId: classroomId || '',
    });

    useEffect(() => {
        if (isOpen && !classroomId) {
            classroomService.getMyClassrooms()
                .then(response => setClassrooms(response.items ?? []))
                .catch(error => console.error('Failed to fetch classrooms', error));
        }
        if (classroomId) {
            setFormData(prev => ({ ...prev, classroomId }));
        }
    }, [isOpen, classroomId]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
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

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            attachmentUrl: '',
            maxScore: 100,
            dueDate: '',
            allowLateSubmission: false,
            latePenaltyPercent: 0,
            classroomId: classroomId || '',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.classroomId) {
            alert('Lütfen bir sınıf seçin.');
            return;
        }

        if (!formData.title.trim()) {
            alert('Ödev başlığı zorunludur.');
            return;
        }

        const due = new Date(formData.dueDate);
        if (Number.isNaN(due.getTime())) {
            alert('Geçerli bir teslim tarihi seçin.');
            return;
        }

        setIsLoading(true);
        try {
            const payload: CreateHomeworkRequest = {
                classroomId: formData.classroomId,
                title: formData.title.trim(),
                description: formData.description.trim(),
                attachmentUrl: formData.attachmentUrl.trim() || undefined,
                maxScore: formData.maxScore,
                dueDate: due.toISOString(),
                allowLateSubmission: formData.allowLateSubmission,
                latePenaltyPercent: formData.allowLateSubmission ? formData.latePenaltyPercent : 0,
            };

            await homeworkService.createHomework(payload);
            onSuccess();
            onClose();
            resetForm();
        } catch (error) {
            console.error('Create homework failed:', error);
            alert(error instanceof Error ? error.message : 'Ödev oluşturulurken bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="📖 Yeni Ödev Oluştur" size="lg">
            <form onSubmit={handleSubmit} className="create-exam-form">
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
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">
                        <span className="form-label-icon">✏️</span>
                        Ödev Başlığı <span className="form-required">*</span>
                    </label>
                    <input
                        type="text"
                        name="title"
                        className="form-input"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Örn: Hafta 3 Matematik Ödevi"
                        required
                    />
                </div>

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
                        placeholder="Ödev talimatlarını yazın..."
                    />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">📅</span>
                            Son Teslim <span className="form-required">*</span>
                        </label>
                        <input
                            type="datetime-local"
                            name="dueDate"
                            className="form-input"
                            value={formData.dueDate}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">🏆</span>
                            Maksimum Puan <span className="form-required">*</span>
                        </label>
                        <input
                            type="number"
                            name="maxScore"
                            className="form-input"
                            value={formData.maxScore}
                            onChange={handleChange}
                            min={1}
                            max={1000}
                            required
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">
                        <span className="form-label-icon">📎</span>
                        Ek Dosya URL (isteğe bağlı)
                    </label>
                    <input
                        type="url"
                        name="attachmentUrl"
                        className="form-input"
                        value={formData.attachmentUrl}
                        onChange={handleChange}
                        placeholder="https://..."
                    />
                </div>

                <div className="form-checkbox-group">
                    <span className="form-checkbox-group-title">⚙️ Teslim Ayarları</span>
                    <label className="form-checkbox-label">
                        <input
                            type="checkbox"
                            name="allowLateSubmission"
                            className="form-checkbox"
                            checked={formData.allowLateSubmission}
                            onChange={handleChange}
                        />
                        <span className="form-checkbox-text">Geç teslime izin ver</span>
                    </label>
                </div>

                {formData.allowLateSubmission && (
                    <div className="form-group">
                        <label className="form-label">
                            <span className="form-label-icon">⚠️</span>
                            Geç Teslim Cezası (%)
                        </label>
                        <input
                            type="number"
                            name="latePenaltyPercent"
                            className="form-input"
                            value={formData.latePenaltyPercent}
                            onChange={handleChange}
                            min={0}
                            max={100}
                        />
                    </div>
                )}

                <div className="form-actions">
                    <Button type="button" variant="ghost" size="md" onClick={onClose}>
                        İptal
                    </Button>
                    <Button type="submit" variant="primary" size="md" isLoading={isLoading}>
                        ✨ Ödev Oluştur
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
