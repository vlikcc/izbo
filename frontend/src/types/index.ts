// Auth Types
export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'Student' | 'Instructor' | 'Admin' | 'SuperAdmin';
    phoneNumber?: string;
    profileImageUrl?: string;
    isActive: boolean;
    createdAt: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
    expiresAt: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    role?: string;
}

// Classroom Types
export interface Classroom {
    id: string;
    name: string;
    description: string;
    instructorId: string;
    instructorName?: string;
    coverImageUrl?: string;
    studentCount: number;
    isActive: boolean;
    createdAt: string;
}

export interface ClassSession {
    id: string;
    classroomId: string;
    title: string;
    description?: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    meetingUrl?: string;
    recordingUrl?: string;
    status: string;
}

export interface Enrollment {
    id: string;
    classroomId: string;
    studentId: string;
    studentName: string;
    enrolledAt: string;
    isActive: boolean;
}

// API Response Types
export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    message?: string;
    errors?: string[];
}

export interface PagedResponse<T> {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

// Re-export models
export * from './models';
