import * as signalR from '@microsoft/signalr';
import { API_URL } from '../config';

/**
 * ExamHub'ın canlı quiz için gönderdiği mesajlar. Sunucudaki karşılığı
 * `src/Services/ExamService/ExamService/Hubs/LiveQuizEvents.cs`; bir test iki listeyi eşit tutar.
 * Bir taraftaki ad değişirse mesaj sessizce kaybolur, bu yüzden adlar yalnızca buradan kullanılmalı.
 */
export const LIVE_QUIZ_EVENTS = {
    ParticipantJoined: 'ParticipantJoined',
    ParticipantLeft: 'ParticipantLeft',
    JoinedQuiz: 'JoinedQuiz',
    QuestionStarted: 'QuestionStarted',
    AnswerReceived: 'AnswerReceived',
    QuestionResults: 'QuestionResults',
    QuestionEnded: 'QuestionEnded',
    ScoreUpdated: 'ScoreUpdated',
    Leaderboard: 'Leaderboard',
    QuizEnded: 'QuizEnded',
} as const;

export type LiveQuizEvent = typeof LIVE_QUIZ_EVENTS[keyof typeof LIVE_QUIZ_EVENTS];

/** Sunucu ekranına: biri katıldı (geri dönen katılımcı puanını korur). */
export interface ParticipantJoinedPayload {
    userId: string;
    userName: string;
    score: number;
    participantCount: number;
}

export interface ParticipantLeftPayload {
    userId: string;
    participantCount: number;
}

export interface JoinedQuizPayload {
    examId: string;
    totalQuestions: number;
    score: number;
}

/** Katılımcının gördüğü açık soru; cevap anahtarı içermez. */
export interface QuestionStartedPayload {
    examId: string;
    id: string;
    content: string;
    type: string;
    imageUrl?: string | null;
    options: string[];
    /** 1'den başlayan sıra. */
    orderIndex: number;
    totalQuestions: number;
    hasAnswered: boolean;
    revealed: boolean;
}

export interface AnswerReceivedPayload {
    userId: string;
    /** Şık harfi (A–F) ya da kısa cevap metni. */
    answer: string;
    responseCount: number;
}

export interface QuestionResultsPayload {
    answers: Record<string, number>;
    totalResponses: number;
}

export interface QuestionEndedPayload {
    questionId: string;
    questionIndex: number;
    /** Doğru şıkkın harfi; şıksız sorularda cevap metni. */
    correctAnswer: string | null;
}

export interface ScoreUpdatedPayload {
    score: number;
    rank: number;
    answered: boolean;
    correct: boolean;
    pointsAwarded: number;
}

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    userName: string;
    score: number;
}

export interface QuizEndedPayload {
    leaderboard: LeaderboardEntry[];
    totalQuestions: number;
    /** Yalnızca katılımcılara gider. */
    rank?: number;
    totalScore?: number;
}

/** Sunucu yayınının sunucu ekranındaki katılımcı listesine uygulanması. */
export interface PresenterParticipant {
    userId: string;
    userName: string;
    score: number;
}

export function upsertParticipant(list: PresenterParticipant[], joined: ParticipantJoinedPayload): PresenterParticipant[] {
    const next = { userId: joined.userId, userName: joined.userName, score: joined.score };
    return list.some((p) => p.userId === joined.userId)
        ? list.map((p) => (p.userId === joined.userId ? next : p))
        : [...list, next];
}

export function removeParticipant(list: PresenterParticipant[], left: ParticipantLeftPayload): PresenterParticipant[] {
    return list.filter((p) => p.userId !== left.userId);
}

/** Lider tablosundaki puanları bağlı katılımcılara yansıtır ve puana göre sıralar. */
export function applyLeaderboard(list: PresenterParticipant[], leaderboard: LeaderboardEntry[]): PresenterParticipant[] {
    const scores = new Map(leaderboard.map((entry) => [entry.userId, entry.score]));
    return list
        .map((p) => ({ ...p, score: scores.get(p.userId) ?? p.score }))
        .sort((a, b) => b.score - a.score);
}

type EventHandler<T> = (data: T) => void;

class LiveQuizHubService {
    private connection: signalR.HubConnection | null = null;
    private eventHandlers: Map<string, Set<EventHandler<unknown>>> = new Map();
    private connectPromise: Promise<void> | null = null;

    async connect(token: string): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            return;
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        const baseUrl = API_URL;

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(`${baseUrl}/hubs/exam`, {
                accessTokenFactory: () => token,
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this.setupEventListeners();

        this.connectPromise = (async () => {
            try {
                await this.connection!.start();
                console.log('LiveQuizHub connected');
            } catch (error) {
                console.error('Failed to connect to LiveQuizHub:', error);
                throw error;
            } finally {
                this.connectPromise = null;
            }
        })();

        return this.connectPromise;
    }

    private setupEventListeners(): void {
        if (!this.connection) return;

        for (const event of Object.values(LIVE_QUIZ_EVENTS)) {
            this.connection.on(event, (data) => this.emit(event, data));
        }
    }

    private emit(event: string, data: unknown): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    on<T>(event: LiveQuizEvent, handler: EventHandler<T>): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(handler as EventHandler<unknown>);

        // Return unsubscribe function
        return () => {
            this.eventHandlers.get(event)?.delete(handler as EventHandler<unknown>);
        };
    }

    off(event: string, handler?: EventHandler<unknown>): void {
        if (handler) {
            this.eventHandlers.get(event)?.delete(handler);
        } else {
            this.eventHandlers.delete(event);
        }
    }

    // Presenter methods
    async startLiveQuiz(examId: string): Promise<string> {
        if (!this.connection) throw new Error('Not connected');
        return await this.connection.invoke<string>('StartLiveQuiz', examId);
    }

    async endLiveQuiz(examId: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('EndLiveQuiz', examId);
    }

    async nextQuestion(examId: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('NextQuestion', examId);
    }

    async previousQuestion(examId: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('PreviousQuestion', examId);
    }

    async showResults(examId: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('ShowResults', examId);
    }

    async revealAnswer(examId: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('RevealAnswer', examId);
    }

    // Voter methods
    async joinQuiz(quizCode: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('JoinQuiz', quizCode);
    }

    async leaveQuiz(examId: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('LeaveQuiz', examId);
    }

    /** Sunucu cevabı kabul etmezse (geç, tekrar ya da kapanmış soru) false döner. */
    async submitAnswer(examId: string, questionId: string, answer: string): Promise<boolean> {
        if (!this.connection) throw new Error('Not connected');
        return await this.connection.invoke<boolean>('SubmitAnswer', examId, questionId, answer);
    }

    async disconnect(): Promise<void> {
        if (this.connectPromise) {
            try {
                await this.connectPromise;
            } catch {
                // Ignore connection errors if disconnecting
            }
        }
        if (this.connection) {
            await this.connection.stop();
            this.connection = null;
            this.eventHandlers.clear();
            console.log('LiveQuizHub disconnected');
        }
    }

    get isConnected(): boolean {
        return this.connection?.state === signalR.HubConnectionState.Connected;
    }
}

export const liveQuizHub = new LiveQuizHubService();
export default liveQuizHub;
