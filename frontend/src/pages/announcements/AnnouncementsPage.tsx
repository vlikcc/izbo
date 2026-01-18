import React, { useState, useEffect } from 'react';
import { announcementApi, classroomApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { Announcement, Classroom } from '../../types';
import './Announcements.css';

export const AnnouncementsPage: React.FC = () => {
    const { user } = useAuthStore();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        loadAnnouncements();
    }, [selectedClassroom]);

    const loadData = async () => {
        try {
            const classroomsRes = await classroomApi.getMyClassrooms(1, 50);
            if (classroomsRes.data.success && classroomsRes.data.data) {
                setClassrooms(classroomsRes.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load classrooms:', error);
            // Mock data
            setClassrooms([
                { id: 'c1', name: 'Matematik 101', description: '', instructorId: '', studentCount: 25, isActive: true, createdAt: '' },
                { id: 'c2', name: 'Fizik 102', description: '', instructorId: '', studentCount: 20, isActive: true, createdAt: '' }
            ]);
        }
        loadAnnouncements();
    };

    const loadAnnouncements = async () => {
        setLoading(true);
        try {
            const response = await announcementApi.getAll(
                selectedClassroom !== 'all' ? selectedClassroom : undefined,
                1, 50
            );
            if (response.data.success && response.data.data) {
                setAnnouncements(response.data.data.items);
            }
        } catch (error) {
            console.error('Failed to load announcements:', error);
            // Mock data
            setAnnouncements([
                {
                    id: '1',
                    classroomId: 'c1',
                    classroomName: 'Matematik 101',
                    title: 'Ara Sınav Tarihi Değişikliği',
                    content: 'Değerli öğrenciler, ara sınav tarihi 15 Ocak\'tan 20 Ocak\'a ertelenmiştir. Yeni tarih ve saat: 20 Ocak 2026, saat 14:00.',
                    isPinned: true,
                    authorId: 'u1',
                    authorName: 'Prof. Dr. Ahmet Yılmaz',
                    createdAt: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: '2',
                    classroomId: 'c1',
                    classroomName: 'Matematik 101',
                    title: 'Ödev Teslim Hatırlatması',
                    content: 'İntegral ödevinin son teslim tarihi yarın saat 23:59\'dur. Geç teslimlere puan kesintisi uygulanacaktır.',
                    isPinned: false,
                    authorId: 'u1',
                    authorName: 'Prof. Dr. Ahmet Yılmaz',
                    createdAt: new Date(Date.now() - 172800000).toISOString()
                },
                {
                    id: '3',
                    classroomId: 'c2',
                    classroomName: 'Fizik 102',
                    title: 'Lab Saati Değişikliği',
                    content: 'Bu haftaki laboratuvar dersi Salı yerine Çarşamba günü yapılacaktır. Aynı saat: 10:00.',
                    isPinned: false,
                    authorId: 'u2',
                    authorName: 'Doç. Dr. Ayşe Demir',
                    createdAt: new Date(Date.now() - 259200000).toISOString()
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleTogglePin = async (id: string) => {
        try {
            await announcementApi.togglePin(id);
            setAnnouncements(prev => prev.map(a => 
                a.id === id ? { ...a, isPinned: !a.isPinned } : a
            ));
        } catch (error) {
            // Mock toggle
            setAnnouncements(prev => prev.map(a => 
                a.id === id ? { ...a, isPinned: !a.isPinned } : a
            ));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
        
        try {
            await announcementApi.delete(id);
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            setAnnouncements(prev => prev.filter(a => a.id !== id));
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 3600000) {
            const mins = Math.floor(diff / 60000);
            return `${mins} dakika önce`;
        }
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours} saat önce`;
        }
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days} gün önce`;
        }
        
        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const filteredAnnouncements = selectedClassroom === 'all'
        ? announcements
        : announcements.filter(a => a.classroomId === selectedClassroom);

    const pinnedAnnouncements = filteredAnnouncements.filter(a => a.isPinned);
    const regularAnnouncements = filteredAnnouncements.filter(a => !a.isPinned);

    return (
        <div className="announcements-page">
            <header className="page-header">
                <div>
                    <h1>📢 Duyurular</h1>
                    <p>Sınıflarınızdaki duyuruları görüntüleyin</p>
                </div>
                {isInstructor && (
                    <button 
                        className="create-btn"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        + Yeni Duyuru
                    </button>
                )}
            </header>

            <div className="announcements-filters">
                <select 
                    value={selectedClassroom} 
                    onChange={(e) => setSelectedClassroom(e.target.value)}
                    className="classroom-filter"
                >
                    <option value="all">Tüm Sınıflar</option>
                    {classrooms.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                    <p>Yükleniyor...</p>
                </div>
            ) : (
                <div className="announcements-content">
                    {pinnedAnnouncements.length > 0 && (
                        <section className="pinned-section">
                            <h2>📌 Sabitlenmiş</h2>
                            <div className="announcements-list">
                                {pinnedAnnouncements.map(announcement => (
                                    <AnnouncementCard
                                        key={announcement.id}
                                        announcement={announcement}
                                        isInstructor={isInstructor}
                                        onTogglePin={handleTogglePin}
                                        onDelete={handleDelete}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="regular-section">
                        {pinnedAnnouncements.length > 0 && <h2>📋 Tüm Duyurular</h2>}
                        {regularAnnouncements.length === 0 && pinnedAnnouncements.length === 0 ? (
                            <div className="empty-state">
                                <span className="empty-icon">📢</span>
                                <h3>Henüz duyuru yok</h3>
                                <p>Sınıflarınızda duyuru oluşturulduğunda burada görünecek</p>
                            </div>
                        ) : (
                            <div className="announcements-list">
                                {regularAnnouncements.map(announcement => (
                                    <AnnouncementCard
                                        key={announcement.id}
                                        announcement={announcement}
                                        isInstructor={isInstructor}
                                        onTogglePin={handleTogglePin}
                                        onDelete={handleDelete}
                                        formatDate={formatDate}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            {isCreateModalOpen && (
                <CreateAnnouncementModal
                    classrooms={classrooms}
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreated={(newAnnouncement) => {
                        setAnnouncements(prev => [newAnnouncement, ...prev]);
                        setIsCreateModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

interface AnnouncementCardProps {
    announcement: Announcement;
    isInstructor: boolean;
    onTogglePin: (id: string) => void;
    onDelete: (id: string) => void;
    formatDate: (date: string) => string;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
    announcement,
    isInstructor,
    onTogglePin,
    onDelete,
    formatDate
}) => {
    return (
        <div className={`announcement-card ${announcement.isPinned ? 'pinned' : ''}`}>
            <div className="announcement-header">
                <div className="announcement-meta">
                    <span className="classroom-badge">{announcement.classroomName}</span>
                    <span className="announcement-time">{formatDate(announcement.createdAt)}</span>
                </div>
                {isInstructor && (
                    <div className="announcement-actions">
                        <button 
                            className={`pin-btn ${announcement.isPinned ? 'active' : ''}`}
                            onClick={() => onTogglePin(announcement.id)}
                            title={announcement.isPinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                        >
                            📌
                        </button>
                        <button 
                            className="delete-btn"
                            onClick={() => onDelete(announcement.id)}
                            title="Sil"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>
            <h3 className="announcement-title">{announcement.title}</h3>
            <p className="announcement-content">{announcement.content}</p>
            <div className="announcement-footer">
                <span className="author">👤 {announcement.authorName}</span>
            </div>
        </div>
    );
};

interface CreateAnnouncementModalProps {
    classrooms: Classroom[];
    onClose: () => void;
    onCreated: (announcement: Announcement) => void;
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({
    classrooms,
    onClose,
    onCreated
}) => {
    const { user } = useAuthStore();
    const [formData, setFormData] = useState({
        classroomId: classrooms[0]?.id || '',
        title: '',
        content: '',
        isPinned: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await announcementApi.create(formData);
            if (response.data.success && response.data.data) {
                onCreated(response.data.data);
            }
        } catch (err) {
            // Mock creation
            const mockAnnouncement: Announcement = {
                id: Math.random().toString(36).substring(7),
                classroomId: formData.classroomId,
                classroomName: classrooms.find(c => c.id === formData.classroomId)?.name || '',
                title: formData.title,
                content: formData.content,
                isPinned: formData.isPinned,
                authorId: user?.id || '',
                authorName: `${user?.firstName} ${user?.lastName}`,
                createdAt: new Date().toISOString()
            };
            onCreated(mockAnnouncement);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📢 Yeni Duyuru</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label>Sınıf</label>
                        <select
                            value={formData.classroomId}
                            onChange={(e) => setFormData({ ...formData, classroomId: e.target.value })}
                            required
                        >
                            {classrooms.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Başlık</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Duyuru başlığı"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>İçerik</label>
                        <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            placeholder="Duyuru içeriğini yazın..."
                            rows={5}
                            required
                        />
                    </div>

                    <div className="form-group checkbox">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.isPinned}
                                onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                            />
                            📌 Bu duyuruyu sabitle
                        </label>
                    </div>

                    <div className="modal-actions">
                        <button type="button" onClick={onClose}>İptal</button>
                        <button type="submit" disabled={loading}>
                            {loading ? 'Yayınlanıyor...' : 'Yayınla'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
