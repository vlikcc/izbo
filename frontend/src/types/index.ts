// Auth Types
export type UserRole = 'Student' | 'Instructor' | 'Admin' | 'SuperAdmin' | 'Parent';

export type ExamTarget = 'None' | 'Lgs' | 'Yks';

export interface User {
    id: string;
    /** Null for child accounts a parent opened; those sign in with `username`. */
    email: string | null;
    username?: string | null;
    firstName: string;
    lastName: string;
    role: UserRole;
    phoneNumber?: string;
    profileImageUrl?: string;
    /** School grade 1–12, students only. */
    gradeLevel?: number | null;
    examTarget?: ExamTarget | null;
    isActive: boolean;
    createdAt: string;
}

export interface AuthResponse {
    accessToken: string;
    refreshToken: string;
    user: User;
    expiresAt: string;
}

/** Exactly one of `email` or `username` is sent. */
export interface LoginRequest {
    email?: string;
    username?: string;
    password: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    role?: 'Student' | 'Parent' | 'Instructor';
    gradeLevel?: number;
    examTarget?: ExamTarget;
}

// Guardian (veli) types
export interface Child {
    id: string;
    firstName: string;
    lastName: string;
    username?: string | null;
    email?: string | null;
    gradeLevel?: number | null;
    examTarget?: ExamTarget | null;
    profileImageUrl?: string | null;
    linkedAt: string;
}

export interface CreateChildRequest {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    gradeLevel: number;
    examTarget?: ExamTarget;
}

export interface GuardianCode {
    code: string;
    expiresAt: string;
}

export interface PublicUser {
    id: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    profileImageUrl?: string | null;
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
    /** Only present for the owning teacher and admins. */
    inviteCode?: string | null;
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
