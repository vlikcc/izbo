// User types
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

// Classroom types
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
  inviteCode?: string;
}

export interface ClassroomStudent {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  joinedAt: string;
  status: 'Active' | 'Removed' | 'Pending';
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
  status: 'Scheduled' | 'Live' | 'Ended' | 'Cancelled';
}

// Homework types
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
  status: 'Pending' | 'Submitted' | 'Late' | 'Graded';
  submittedAt?: string;
  gradedAt?: string;
}

// Exam types
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
  status: 'Draft' | 'Published' | 'InProgress' | 'Ended' | 'Cancelled';
  createdAt: string;
}

export interface Question {
  id: string;
  examId: string;
  orderIndex: number;
  type: 'MultipleChoice' | 'TrueFalse' | 'FillInBlank' | 'Matching' | 'Essay';
  content: string;
  imageUrl?: string;
  options?: string[];
  points: number;
  explanation?: string;
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
  status: 'NotStarted' | 'InProgress' | 'Submitted' | 'TimedOut' | 'Graded';
}

export interface StartExamResponse {
  sessionId: string;
  questions: Question[];
  expiresAt: string;
  remainingSeconds: number;
}

export interface ExamResult {
  sessionId: string;
  examId: string;
  examTitle: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  submittedAt: string;
  questionResults?: QuestionResult[];
}

export interface QuestionResult {
  questionId: string;
  content: string;
  yourAnswer?: string;
  correctAnswer?: string;
  isCorrect: boolean;
  pointsAwarded: number;
  maxPoints: number;
  explanation?: string;
}

// Announcement types
export interface Announcement {
  id: string;
  classroomId: string;
  classroomName: string;
  title: string;
  content: string;
  isPinned: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
}

// Message types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'Direct' | 'Group';
  name?: string;
  participants: { userId: string; userName: string; profileImageUrl?: string }[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
}

// Quiz types
export interface Quiz {
  id: string;
  classroomId: string;
  title: string;
  type: 'Poll' | 'Attendance' | 'Quiz';
  isActive: boolean;
  options?: string[];
  responses: { optionIndex: number; count: number }[];
  totalResponses: number;
  createdAt: string;
  expiresAt?: string;
}

// API types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
