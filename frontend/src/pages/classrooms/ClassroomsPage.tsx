import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Input } from '../../components/ui';
import { classroomService } from '../../services/classroom.service';
import { useAuthStore } from '../../stores/authStore';
import type { Classroom } from '../../types';
import { isStaff, isStudent } from '../../utils/roles';
import { JoinClassroomModal } from '../../components/classroom/JoinClassroomModal';
import './Classrooms.css';

export const ClassroomsPage: React.FC = () => {
    const { user } = useAuthStore();
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
    });
    const [error, setError] = useState('');

    const isInstructor = isStaff(user);
    const canJoin = isStudent(user);
    const [isJoinOpen, setIsJoinOpen] = useState(false);

    const fetchClassrooms = async () => {
        try {
            const response = await classroomService.getMyClassrooms(1, 20);
            setClassrooms(response.items);
        } catch (error) {
            console.error('Failed to fetch classrooms:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClassrooms();
    }, []);

    const handleOpenModal = () => {
        setFormData({ name: '', description: '' });
        setError('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setError('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim()) {
            setError('Sınıf adı zorunludur');
            return;
        }

        setIsSubmitting(true);
        try {
            await classroomService.createClassroom({
                name: formData.name,
                description: formData.description,
            });
            handleCloseModal();
            fetchClassrooms();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Sınıf oluşturulamadı');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="page animate-fadeIn">
            <div className="page-header">
                <div className="page-header-content">
                    <h1 className="page-title">📚 Sınıflarım</h1>
                    <p className="page-subtitle">
                        {isInstructor
                            ? 'Oluşturduğunuz ve yönettiğiniz sınıflar'
                            : 'Kayıtlı olduğunuz sınıflar'
                        }
                    </p>
                </div>
                {isInstructor && (
                    <Button variant="primary" size="md" onClick={handleOpenModal}>
                        + Yeni Sınıf Oluştur
                    </Button>
                )}
                {canJoin && (
                    <Button variant="primary" size="md" onClick={() => setIsJoinOpen(true)}>
                        🔑 Kodla katıl
                    </Button>
                )}
            </div>

            {isLoading ? (
                <div className="classrooms-loading">
                    <div className="classrooms-loading-spinner" />
                    <span>Sınıflar yükleniyor...</span>
                </div>
            ) : classrooms.length > 0 ? (
                <div className="classrooms-grid">
                    {classrooms.map(classroom => (
                        <Link key={classroom.id} to={`/app/classrooms/${classroom.id}`} className="classroom-card-link">
                            <Card variant="default" padding="none" hoverable className="classroom-card">
                                <div
                                    className="classroom-card-cover"
                                    style={{
                                        backgroundImage: classroom.coverImageUrl
                                            ? `url(${classroom.coverImageUrl})`
                                            : undefined
                                    }}
                                >
                                    {!classroom.coverImageUrl && (
                                        <span className="classroom-card-cover-icon">📚</span>
                                    )}
                                </div>
                                <div className="classroom-card-content">
                                    <h3 className="classroom-card-title">{classroom.name}</h3>
                                    <p className="classroom-card-desc">{classroom.description}</p>
                                    <div className="classroom-card-meta">
                                        <span className="classroom-card-students">
                                            👥 {classroom.studentCount} öğrenci
                                        </span>
                                        {classroom.instructorName && (
                                            <span className="classroom-card-instructor">
                                                👨‍🏫 {classroom.instructorName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="classroom-card-footer">
                                    <span className={`classroom-card-status ${classroom.isActive ? 'active' : ''}`}>
                                        {classroom.isActive ? '● Aktif' : '○ Pasif'}
                                    </span>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            ) : (
                <Card variant="default" padding="lg" className="classrooms-empty animate-slideUp">
                    <div className="classrooms-empty-content">
                        <span className="classrooms-empty-icon">📭</span>
                        <h3 className="classrooms-empty-title">Henüz sınıf yok</h3>
                        <p className="classrooms-empty-text">
                            {isInstructor
                                ? 'İlk sınıfınızı oluşturarak başlayın!'
                                : 'Öğretmeninin verdiği kodla bir sınıfa katıl.'
                            }
                        </p>
                        {canJoin && (
                            <Button variant="primary" size="lg" style={{ marginTop: '16px' }} onClick={() => setIsJoinOpen(true)}>
                                🔑 Kodla katıl
                            </Button>
                        )}
                        {isInstructor && (
                            <Button variant="primary" size="lg" style={{ marginTop: '16px' }} onClick={handleOpenModal}>
                                + Sınıf Oluştur
                            </Button>
                        )}
                    </div>
                </Card>
            )}

            <JoinClassroomModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />

            {/* Create Classroom Modal */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Yeni Sınıf Oluştur" size="md">
                <form onSubmit={handleSubmit} className="modal-form">
                    {error && (
                        <div className="auth-error">{error}</div>
                    )}
                    <Input
                        label="Sınıf Adı"
                        name="name"
                        placeholder="Örn: Matematik 101"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                    <div className="input-wrapper">
                        <label className="input-label">Açıklama</label>
                        <textarea
                            name="description"
                            placeholder="Sınıf hakkında kısa bir açıklama..."
                            value={formData.description}
                            onChange={handleChange}
                            className="modal-textarea"
                        />
                    </div>
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={handleCloseModal}>
                            İptal
                        </Button>
                        <Button type="submit" variant="primary" isLoading={isSubmitting}>
                            Oluştur
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default ClassroomsPage;
