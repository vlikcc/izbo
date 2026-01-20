import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/ui';
import { CreateExamModal } from '../../components/exams/CreateExamModal';
import { classroomService } from '../../services/classroom.service';
import { homeworkService } from '../../services/homework.service';
import { examService } from '../../services/exam.service';
import { userService } from '../../services/user.service';
import { useAuthStore } from '../../stores/authStore';
import type { Classroom, Homework, Exam, ClassSession, Enrollment, User } from '../../types';
import './Classrooms.css';

export const ClassroomDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const isInstructor = user?.role === 'Instructor' || user?.role === 'Admin' || user?.role === 'SuperAdmin';

    // Core data state
    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [homeworks, setHomeworks] = useState<Homework[]>([]);
    const [exams, setExams] = useState<Exam[]>([]);
    const [sessions, setSessions] = useState<ClassSession[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'homeworks' | 'exams' | 'people'>('overview');

    // Add Student Modal state
    const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
    const [isEnrolling, setIsEnrolling] = useState(false);

    // Create Exam Modal
    const [isCreateExamModalOpen, setIsCreateExamModalOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        fetchData(id);
    }, [id]);

    const fetchData = async (classroomId: string) => {
        setLoading(true);
        try {
            const [classroomData, homeworkData, examData, sessionData] = await Promise.all([
                classroomService.getClassroom(classroomId),
                homeworkService.getHomeworks(classroomId),
                examService.getExams(classroomId),
                classroomService.getSessions(classroomId)
            ]);

            setClassroom(classroomData);
            setHomeworks(homeworkData.items);
            setExams(examData.items);
            setSessions(sessionData);

            // Fetch Enrollments if Instructor
            if (isInstructor) {
                const enrollmentData = await classroomService.getEnrollments(classroomId);
                setEnrollments(enrollmentData);
            }
        } catch (err) {
            console.error("Failed to fetch classroom details:", err);
            setError("Sınıf detayları yüklenirken bir hata oluştu ve ana sayfaya yönlendiriliyorsunuz.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearchStudents = async (query: string) => {
        setStudentSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const users = await userService.searchUsers(query);
            // Filter out users already enrolled in this classroom
            const filteredUsers = users.filter(user => !enrollments.some(e => e.studentId === user.id));
            setSearchResults(filteredUsers);
        } catch (err) {
            console.error("Failed to search users:", err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleEnrollStudent = async () => {
        if (!selectedStudent || !classroom?.id) return;

        setIsEnrolling(true);
        try {
            await classroomService.enrollStudent(classroom.id, selectedStudent.id);
            // Refresh enrollments
            if (isInstructor) {
                const enrollmentData = await classroomService.getEnrollments(classroom.id);
                setEnrollments(enrollmentData);
            }
            setIsAddStudentModalOpen(false);
            setSelectedStudent(null);
            setStudentSearchQuery('');
            setSearchResults([]);
            alert(`${selectedStudent.firstName} ${selectedStudent.lastName} sınıfa eklendi.`);
        } catch (err) {
            console.error("Failed to enroll student:", err);
            alert('Öğrenci eklenirken bir hata oluştu.');
        } finally {
            setIsEnrolling(false);
        }
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="classrooms-loading">
                <div className="classrooms-loading-spinner" />
                <span>Sınıf detayları yükleniyor...</span>
            </div>
        );
    }

    if (error || !classroom) {
        return (
            <div className="page animate-fadeIn">
                <div className="page-header">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/app/classrooms')}>
                        ← Geri Dön
                    </Button>
                </div>
                <Card variant="default" padding="lg" className="error-card">
                    <h3>Bir hata oluştu</h3>
                    <p>{error || 'Sınıf bulunamadı.'}</p>
                    <Button variant="primary" onClick={() => navigate('/app/classrooms')}>
                        Sınıflara Dön
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="page animate-fadeIn">
            {/* Header / Cover */}
            <div className="classroom-header">
                <Button
                    variant="ghost"
                    size="sm"
                    className="classroom-back-btn"
                    onClick={() => navigate('/app/classrooms')}
                >
                    ← Sınıflarım
                </Button>

                <div className="classroom-cover" style={{
                    backgroundImage: classroom.coverImageUrl ? `url(${classroom.coverImageUrl})` : undefined
                }}>
                    {!classroom.coverImageUrl && <span className="classroom-cover-icon">📚</span>}
                    <div className="classroom-cover-overlay" />
                    <div className="classroom-info">
                        <h1 className="classroom-title">{classroom.name}</h1>
                        <p className="classroom-description">{classroom.description}</p>
                        <div className="classroom-meta">
                            {classroom.instructorName && (
                                <span className="classroom-instructor">
                                    👨‍🏫 {classroom.instructorName}
                                </span>
                            )}
                            <span className="classroom-student-count">
                                👥 {classroom.studentCount} Öğrenci
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="classroom-tabs">
                <button
                    className={`classroom-tab ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    Genel Bakış
                </button>
                <button
                    className={`classroom-tab ${activeTab === 'homeworks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('homeworks')}
                >
                    Ödevler
                </button>
                <button
                    className={`classroom-tab ${activeTab === 'exams' ? 'active' : ''}`}
                    onClick={() => setActiveTab('exams')}
                >
                    Sınavlar
                </button>
                {isInstructor && (
                    <button
                        className={`classroom-tab ${activeTab === 'people' ? 'active' : ''}`}
                        onClick={() => setActiveTab('people')}
                    >
                        Kişiler
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="classroom-content">

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="tab-content animate-slideUp">
                        <div className="content-grid two-column">
                            <div className="main-column">
                                <section className="section-block">
                                    <h3 className="section-title">📢 Duyurular</h3>
                                    <Card variant="default" padding="md" className="empty-state-card">
                                        <p>Henüz duyuru yok.</p>
                                    </Card>
                                </section>
                            </div>

                            <div className="side-column">
                                <section className="section-block">
                                    <h3 className="section-title">🎥 Yaklaşan Canlı Dersler</h3>
                                    {sessions.filter(s => new Date(s.scheduledEndTime) > new Date()).length > 0 ? (
                                        <div className="upcoming-sessions-list">
                                            {sessions
                                                .filter(s => new Date(s.scheduledEndTime) > new Date())
                                                .slice(0, 3)
                                                .map(session => (
                                                    <Card key={session.id} variant="default" padding="sm" className="mini-session-card">
                                                        <div className="mini-session-header">
                                                            <span className="mini-session-icon">📹</span>
                                                            <span className="mini-session-title">{session.title}</span>
                                                        </div>
                                                        <div className="mini-session-time">
                                                            {formatDate(session.scheduledStartTime)}
                                                        </div>
                                                        <Button size="sm" variant="outline" fullWidth onClick={() => navigate(`/live/${session.id}`)}>
                                                            Derse Git
                                                        </Button>
                                                    </Card>
                                                ))}
                                        </div>
                                    ) : (
                                        <Card variant="default" padding="md" className="empty-state-card">
                                            <p>Planlanmış ders yok.</p>
                                        </Card>
                                    )}
                                </section>

                                <section className="section-block">
                                    <h3 className="section-title">📌 Sınıf Kodu</h3>
                                    <Card variant="default" padding="md">
                                        <div className="class-code-box">
                                            <code>{classroom.id.split('-')[0].toUpperCase()}</code>
                                            <Button size="sm" variant="ghost" onClick={() => {
                                                navigator.clipboard.writeText(classroom.id.split('-')[0].toUpperCase());
                                            }}>kopyala</Button>
                                        </div>
                                    </Card>
                                </section>
                            </div>
                        </div>
                    </div>
                )}

                {/* Homeworks Tab */}
                {activeTab === 'homeworks' && (
                    <div className="tab-content animate-slideUp">
                        <div className="section-header">
                            <h3>Ödev Listesi</h3>
                            {isInstructor && <Button variant="primary" size="sm">+ Yeni Ödev</Button>}
                        </div>
                        {homeworks.length > 0 ? (
                            <div className="list-grid">
                                {homeworks.map(hw => (
                                    <Card key={hw.id} variant="default" padding="md" hoverable>
                                        <div className="list-item">
                                            <div className="list-item-icon">📖</div>
                                            <div className="list-item-info">
                                                <h4>{hw.title}</h4>
                                                <p>{hw.description}</p>
                                                <span className="due-date">Son Teslim: {formatDate(hw.dueDate)}</span>
                                            </div>
                                            <div className="list-item-action">
                                                <Button size="sm" variant="outline">Detay</Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card variant="default" padding="lg" className="empty-large">
                                <span>📖</span>
                                <p>Henüz ödev verilmemiş.</p>
                            </Card>
                        )}
                    </div>
                )}

                {/* Exams Tab */}
                {activeTab === 'exams' && (
                    <div className="tab-content animate-slideUp">
                        <div className="section-header">
                            <h3>Sınav Listesi</h3>
                            {isInstructor && <Button variant="primary" size="sm" onClick={() => setIsCreateExamModalOpen(true)}>+ Yeni Sınav</Button>}
                        </div>
                        {exams.length > 0 ? (
                            <div className="list-grid">
                                {exams.map(exam => (
                                    <Card key={exam.id} variant="default" padding="md" hoverable>
                                        <div className="list-item">
                                            <div className="list-item-icon">📝</div>
                                            <div className="list-item-info">
                                                <h4>{exam.title}</h4>
                                                <p>{exam.description}</p>
                                                <span className="exam-date">Tarih: {formatDate(exam.startTime)}</span>
                                            </div>
                                            <div className="list-item-action">
                                                <Button size="sm" variant="outline">Detay</Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card variant="default" padding="lg" className="empty-large">
                                <span>📝</span>
                                <p>Henüz sınav oluşturulmamış.</p>
                            </Card>
                        )}
                    </div>
                )}

                {/* People Tab */}
                {activeTab === 'people' && (
                    <div className="tab-content animate-slideUp">
                        <div className="section-header">
                            <h3>Katılımcılar ({enrollments.length})</h3>
                            {isInstructor && <Button variant="primary" size="sm" onClick={() => setIsAddStudentModalOpen(true)}>+ Öğrenci Ekle</Button>}
                        </div>
                        <Card variant="default" padding="none">
                            <table className="participants-table">
                                <thead>
                                    <tr>
                                        <th>Öğrenci</th>
                                        <th>Kayıt Tarihi</th>
                                        <th>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrollments.length > 0 ? enrollments.map(p => (
                                        <tr key={p.id}>
                                            <td className="user-cell">
                                                <div className="user-avatar-sm">
                                                    {(p.studentName || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <span>{p.studentName || 'İsimsiz Öğrenci'}</span>
                                            </td>
                                            <td>{formatDate(p.enrolledAt)}</td>
                                            <td>
                                                <span className={`status-badge ${p.isActive ? 'active' : 'passive'}`}>
                                                    {p.isActive ? 'Aktif' : 'Pasif'}
                                                </span>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                Henüz kayıtlı öğrenci yok.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </Card>
                    </div>
                )}
            </div>

            {/* Add Student Modal */}
            {isAddStudentModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h3>Öğrenci Ekle</h3>
                            <button className="modal-close" onClick={() => setIsAddStudentModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-content">
                            <div className="search-box">
                                <input
                                    type="text"
                                    placeholder="Öğrenci adı veya e-posta ara..."
                                    className="modal-input"
                                    value={studentSearchQuery}
                                    onChange={(e) => handleSearchStudents(e.target.value)}
                                />
                            </div>

                            <div className="search-results">
                                {isSearching ? (
                                    <div className="search-loading">Aranıyor...</div>
                                ) : searchResults.length > 0 ? (
                                    <ul className="search-list">
                                        {searchResults.map(user => (
                                            <li
                                                key={user.id}
                                                className={`search-item ${selectedStudent?.id === user.id ? 'selected' : ''}`}
                                                onClick={() => setSelectedStudent(user)}
                                            >
                                                <div className="user-avatar-xs">
                                                    {(user.firstName || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="user-info">
                                                    <span className="user-name">{user.firstName} {user.lastName}</span>
                                                    <span className="user-email">{user.email}</span>
                                                </div>
                                                {selectedStudent?.id === user.id && <span className="check-icon">✓</span>}
                                            </li>
                                        ))}
                                    </ul>
                                ) : studentSearchQuery.length >= 3 ? (
                                    <div className="no-results">Öğrenci bulunamadı.</div>
                                ) : (
                                    <div className="search-hint">Aramak için en az 3 karakter girin.</div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <Button variant="ghost" onClick={() => setIsAddStudentModalOpen(false)}>İptal</Button>
                            <Button
                                variant="primary"
                                disabled={!selectedStudent || isEnrolling}
                                onClick={handleEnrollStudent}
                            >
                                {isEnrolling ? 'Ekleniyor...' : 'Öğrenciyi Ekle'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <CreateExamModal
                isOpen={isCreateExamModalOpen}
                onClose={() => setIsCreateExamModalOpen(false)}
                onSuccess={() => {
                    if (id) fetchData(id);
                }}
                classroomId={id}
            />
        </div>
    );
};
