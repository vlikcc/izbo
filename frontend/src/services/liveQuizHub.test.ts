import { describe, expect, it } from 'vitest';
import { applyLeaderboard, LIVE_QUIZ_EVENTS, removeParticipant, upsertParticipant } from './liveQuizHub';

describe('live quiz presenter list', () => {
    it('adds a participant once and refreshes a rejoining one', () => {
        const joined = upsertParticipant([], { userId: 'u1', userName: 'Ali', score: 0, participantCount: 1 });
        const rejoined = upsertParticipant(joined, { userId: 'u1', userName: 'Ali', score: 10, participantCount: 1 });

        expect(rejoined).toEqual([{ userId: 'u1', userName: 'Ali', score: 10 }]);
    });

    it('removes a participant who left', () => {
        const list = [
            { userId: 'u1', userName: 'Ali', score: 0 },
            { userId: 'u2', userName: 'Ayşe', score: 0 },
        ];

        expect(removeParticipant(list, { userId: 'u1', participantCount: 1 })).toEqual([list[1]]);
    });

    it('applies leaderboard scores and orders by score', () => {
        const list = [
            { userId: 'u1', userName: 'Ali', score: 0 },
            { userId: 'u2', userName: 'Ayşe', score: 0 },
        ];

        const next = applyLeaderboard(list, [
            { rank: 1, userId: 'u2', userName: 'Ayşe', score: 10 },
            { rank: 2, userId: 'u1', userName: 'Ali', score: 0 },
        ]);

        expect(next.map((p) => [p.userId, p.score])).toEqual([['u2', 10], ['u1', 0]]);
    });
});

describe('LIVE_QUIZ_EVENTS', () => {
    it('uses each key as its event name', () => {
        for (const [key, value] of Object.entries(LIVE_QUIZ_EVENTS)) {
            expect(value).toBe(key);
        }
    });
});
