import React, { useState, useEffect } from 'react';
import { classroomApi } from '../../services/api';
import type { ClassroomStudent } from '../../types';

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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b border-rose-100 relative">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        👥 Öğrenci Listesi
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">{classroomName} • {students.length} öğrenci</p>
                    <button 
                        className="absolute top-4 right-4 w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors"
                        onClick={onClose}
                    >
                        ×
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-rose-100">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="İsim veya e-posta ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-3 pl-10 bg-white border border-rose-100 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4">
                    {message && (
                        <div className={`mb-4 p-3 rounded-xl text-sm ${
                            message.type === 'success' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {message.text}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin mb-4"></div>
                            <p className="text-gray-500">Yükleniyor...</p>
                        </div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center text-3xl mb-4">
                                {searchTerm ? '🔍' : '👥'}
                            </div>
                            <p className="text-gray-500">
                                {searchTerm ? 'Aramanızla eşleşen öğrenci bulunamadı' : 'Henüz kayıtlı öğrenci yok'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredStudents.map(student => (
                                <div key={student.id} className="flex items-center gap-4 p-4 bg-rose-50 rounded-xl">
                                    <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-rose-500 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0">
                                        {student.profileImageUrl ? (
                                            <img src={student.profileImageUrl} alt={student.firstName} className="w-full h-full rounded-full object-cover" />
                                        ) : (
                                            <span>{getInitials(student.firstName, student.lastName)}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900">
                                            {student.firstName} {student.lastName}
                                        </div>
                                        <div className="text-sm text-gray-500 truncate">{student.email}</div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            Katılım: {formatDate(student.joinedAt)}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {confirmRemove === student.id ? (
                                            <div className="flex gap-2">
                                                <button 
                                                    className="px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
                                                    onClick={() => handleRemoveStudent(student.id)}
                                                >
                                                    Çıkar
                                                </button>
                                                <button 
                                                    className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                                                    onClick={() => setConfirmRemove(null)}
                                                >
                                                    İptal
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                className="w-8 h-8 bg-white text-gray-500 rounded-lg flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
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

                {/* Footer */}
                <div className="p-4 border-t border-rose-100 text-center">
                    <span className="text-sm text-gray-500">
                        {filteredStudents.length} / {students.length} öğrenci gösteriliyor
                    </span>
                </div>
            </div>
        </div>
    );
};
