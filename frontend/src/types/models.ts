// Exam Types
export interface Exam {
    id: string;
    classroomId: string;
    classroomName: string;
    title: string;
    description?: string;
    durationMinutes: number;
    startTime: string;
    endTime: string;
    totalPoints: number;
    questionCount: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showResults: boolean;
    passingScore?: number;
    status: string;
    createdAt: string;
}

export interface ExamSession {
    id: string;
    examId: string;
    examTitle: string;
    studentId: string;
    studentName: string;
    startedAt?: string;
    submittedAt?: string;
    totalScore?: number;
    percentage?: number;
    isPassed: boolean;
    status: string;
}

// Homework Types
export interface Homework {
    id: string;
    classroomId: string;
    classroomName: string;
    title: string;
    description: string;
    attachmentUrl?: string;
    maxScore: number;
    dueDate: string;
    allowLateSubmission: boolean;
    latePenaltyPercent: number;
    submissionCount: number;
    isActive: boolean;
    createdAt: string;
}

export interface Submission {
    id: string;
    homeworkId: string;
    studentId: string;
    studentName: string;
    content?: string;
    fileUrl?: string;
    score?: number;
    feedback?: string;
    status: string;
    submittedAt?: string;
    gradedAt?: string;
}

// Live Session Types
export interface LiveSession {
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
