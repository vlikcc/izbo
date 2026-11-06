import type { ExamTarget, User, UserRole } from '../types';

type MaybeUser = Pick<User, 'role'> | null | undefined;

export const isStudent = (user: MaybeUser) => user?.role === 'Student';
export const isParent = (user: MaybeUser) => user?.role === 'Parent';
export const isAdmin = (user: MaybeUser) => user?.role === 'Admin' || user?.role === 'SuperAdmin';
/** Teachers and administrators: everyone who authors classroom content. */
export const isStaff = (user: MaybeUser) => user?.role === 'Instructor' || isAdmin(user);

export const ROLE_LABELS: Record<UserRole, string> = {
    Student: 'Öğrenci',
    Parent: 'Veli',
    Instructor: 'Öğretmen',
    Admin: 'Yönetici',
    SuperAdmin: 'Süper Yönetici',
};

export const roleLabel = (role: UserRole | string | undefined) =>
    (role && ROLE_LABELS[role as UserRole]) || role || '';

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export const gradeLabel = (grade: number | null | undefined) => (grade ? `${grade}. sınıf` : '');

export const EXAM_LABELS: Record<ExamTarget, string> = {
    None: 'Yok',
    Lgs: 'LGS',
    Yks: 'YKS',
};

/** LGS is taken at the end of 8th grade, YKS at the end of high school; earlier grades may start preparing. */
export function examTargetsForGrade(grade: number | null | undefined): ExamTarget[] {
    if (!grade) return [];
    if (grade >= 5 && grade <= 8) return ['Lgs'];
    if (grade >= 9) return ['Yks'];
    return [];
}

/** How the person signs in, for display: the address, or the user name of a child account. */
export const loginName = (user: Pick<User, 'email' | 'username'> | null | undefined) =>
    user?.email ?? user?.username ?? '';
