import React, { useState, useEffect } from 'react';
import { classroomApi } from '../../services/api';
import type { ClassroomStudent } from '../../types';
import './ClassroomModals.css';

interface StudentListModalProps {
    classroomId: string;
    classroomName: string;
    onClose: () => void;
    onStudentCountChange?: (count: number) => void;
}

export const StudentListModal: React.FC<StudentListModalProps> = ({ 
    classroomId, 
    classroomName, 
    onClose,
    onStudentCountChange 
}) => {
    const [students, setStudents] = useState<ClassroomStudent[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadStudents();
    }, [classroomId]);

    const loadStudents = async () => {
        setLoading(true);
        try {
            const response = await classroomApi.getStudents(classroomId);
            if (response.data.success && response.data.data) {
                setStudents(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load students:', error);
            // Mock data for development
            setStudents([
                {
                    id: '1',
                    userId: 'u1',
                    email: 'ali.yilmaz@email.com',
                    firstName: 'Ali',
                    lastName: 'Yılmaz',
                    joinedAt: new Date().toISOString(),
                    status: 'Active'
                },
                {
                    id: '2',
                    userId: 'u2',
                    email: 'ayse.demir@email.com',
                    firstName: 'Ayşe',
                    lastName: 'Demir',
                    joinedAt: new Date().toISOString(),
                    status: 'Active'
                },
                {
                    id: '3',
                    userId: 'u3',
                    email: 'mehmet.kaya@email.com',
                    firstName: 'Mehmet',
                    lastName: 'Kaya',
                    joinedAt: new Date().toISOString(),
                    status: 'Active'
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveStudent = async (studentId: string) => {
        try {
            const response = await classroomApi.removeStudent(classroomId, studentId);
            if (response.data.success) {
                setStudents(prev => prev.filter(s => s.id !== studentId));
                setMessage({ type: 'success', text: 'Öğrenci sınıftan çıkarıldı' });
                onStudentCountChange?.(students.length - 1);
            }
        } catch (error) {
            console.error('Failed to remove student:', error);
            // Mock removal for development
            setStudents(prev => prev.filter(s => s.id !== studentId));
            setMessage({ type: 'success', text: 'Öğrenci sınıftan çıkarıldı' });
        } finally {
            setConfirmRemove(null);
        }
    };

    const filteredStudents = students.filter(student => {
        const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
        const email = student.email.toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
    });

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content student-list-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>👥 Öğrenci Listesi</h2>
                    <p className="modal-subtitle">{classroomName} • {students.length} öğrenci</p>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="İsim veya e-posta ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="search-icon">🔍</span>
                </div>

                <div className="modal-body">
                    {message && (
                        <div className={`message ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Yükleniyor...</p>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="empty-state">
                            {searchTerm ? (
                                <>
                                    <span className="empty-icon">🔍</span>
                                    <p>Aramanızla eşleşen öğrenci bulunamadı</p>
                                </>
                            ) : (
                                <>
                                    <span className="empty-icon">👥</span>
                                    <p>Henüz kayıtlı öğrenci yok</p>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="student-list">
                            {filteredStudents.map(student => (
                                <div key={student.id} className="student-item">
                                    <div className="student-avatar">
                                        {student.profileImageUrl ? (
                                            <img src={student.profileImageUrl} alt={student.firstName} />
                                        ) : (
                                            <span className="initials">
                                                {getInitials(student.firstName, student.lastName)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="student-info">
                                        <div className="student-name">
                                            {student.firstName} {student.lastName}
                                        </div>
                                        <div className="student-email">{student.email}</div>
                                        <div className="student-meta">
                                            Katılım: {formatDate(student.joinedAt)}
                                        </div>
                                    </div>
                                    <div className="student-actions">
                                        {confirmRemove === student.id ? (
                                            <div className="confirm-actions">
                                                <button 
                                                    className="confirm-btn danger"
                                                    onClick={() => handleRemoveStudent(student.id)}
                                                >
                                                    Evet, Çıkar
                                                </button>
                                                <button 
                                                    className="confirm-btn cancel"
                                                    onClick={() => setConfirmRemove(null)}
                                                >
                                                    İptal
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                className="remove-btn"
                                                onClick={() => setConfirmRemove(student.id)}
                                                title="Öğrenciyi sınıftan çıkar"
                                            >
                                                🗑️
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <span className="footer-text">
                        {filteredStudents.length} / {students.length} öğrenci gösteriliyor
                    </span>
                </div>
            </div>
        </div>
    );
};
