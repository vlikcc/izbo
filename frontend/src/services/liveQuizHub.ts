import * as signalR from '@microsoft/signalr';

export interface LiveQuizParticipant {
    odaId: string;
    odaCode: string;
    participants: ParticipantInfo[];
}

export interface ParticipantInfo {
    odaId: string;
    odaName: string;
    connectionId: string;
    score: number;
    hasAnswered: boolean;
}

export interface QuestionResult {
    questionId: string;
    answers: { [answer: string]: number }; // answer -> count
    correctAnswer: string;
    totalResponses: number;
}

export interface LiveQuizState {
    examId: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    isActive: boolean;
    showingResults: boolean;
    timeRemaining?: number;
}

type EventHandler<T> = (data: T) => void;

class LiveQuizHubService {
    private connection: signalR.HubConnection | null = null;
    private eventHandlers: Map<string, Set<EventHandler<unknown>>> = new Map();

    async connect(token: string): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) {
            return;
        }

        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(`${baseUrl}/hubs/exam`, {
                accessTokenFactory: () => token,
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this.setupEventListeners();

        try {
            await this.connection.start();
            console.log('LiveQuizHub connected');
        } catch (error) {
            console.error('Failed to connect to LiveQuizHub:', error);
            throw error;
        }
    }

    private setupEventListeners(): void {
        if (!this.connection) return;

        // Presenter events
        this.connection.on('ParticipantJoined', (data) => {
            this.emit('ParticipantJoined', data);
        });

        this.connection.on('ParticipantLeft', (data) => {
            this.emit('ParticipantLeft', data);
        });

        this.connection.on('AnswerReceived', (data) => {
            this.emit('AnswerReceived', data);
        });

        this.connection.on('QuestionResults', (data) => {
            this.emit('QuestionResults', data);
        });

        // Voter events
        this.connection.on('QuestionStarted', (data) => {
            this.emit('QuestionStarted', data);
        });

        this.connection.on('QuestionEnded', (data) => {
            this.emit('QuestionEnded', data);
        });

        this.connection.on('QuizEnded', (data) => {
            this.emit('QuizEnded', data);
        });

        this.connection.on('ScoreUpdated', (data) => {
            this.emit('ScoreUpdated', data);
        });

        this.connection.on('TimerTick', (data) => {
            this.emit('TimerTick', data);
        });

        this.connection.on('Leaderboard', (data) => {
            this.emit('Leaderboard', data);
        });
    }

    private emit(event: string, data: unknown): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    on<T>(event: string, handler: EventHandler<T>): () => void {
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

    async submitAnswer(examId: string, questionId: string, answer: string): Promise<void> {
        if (!this.connection) throw new Error('Not connected');
        await this.connection.invoke('SubmitAnswer', examId, questionId, answer);
    }

    async disconnect(): Promise<void> {
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
