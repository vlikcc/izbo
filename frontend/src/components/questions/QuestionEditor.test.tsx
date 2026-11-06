import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuestionEditor } from './QuestionEditor';
import type { BankQuestion } from '../../types/assessment';

const { updateQuestion, toastError } = vi.hoisted(() => ({
    updateQuestion: vi.fn(),
    toastError: vi.fn(),
}));

vi.mock('../../services/assessment.service', () => ({
    default: {
        updateQuestion,
        createQuestion: vi.fn(),
        uploadQuestionImage: vi.fn(),
        assetUrl: (id: string) => `/assets/${id}`,
    },
}));

vi.mock('../../services/content.service', () => ({
    default: {
        getTopic: vi.fn().mockResolvedValue({ id: 't1', outcomes: [], items: [] }),
        getLevels: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('../../lib/toast', () => ({ toast: { error: toastError, success: vi.fn() } }));

const question: BankQuestion = {
    id: 'q1', topicId: 't1', topicName: 'Bölme', unitId: 'u1', unitName: 'Sayılar', subjectId: 's1', subjectName: 'Matematik',
    levelId: 'l1', levelName: '5. Sınıf', outcome: null, type: 'MultipleChoice', stem: '12 ÷ 3 = ?', stemAssetId: null,
    options: [
        { key: 'A', text: '2', assetId: null },
        { key: 'B', text: '4', assetId: null },
        { key: 'C', text: '6', assetId: null },
    ],
    correctKey: 'B', difficulty: 'Easy', explanation: '', solutionVideoItemId: null, solutionVideoTitle: null,
    ownerId: 'me', ownerKind: 'Teacher', status: 'Draft', reviewNote: null,
    createdAt: '', updatedAt: '', submittedAt: null, publishedAt: null,
};

describe('QuestionEditor', () => {
    beforeEach(() => {
        updateQuestion.mockReset();
        toastError.mockReset();
    });

    it('moves the answer key with the options when an earlier option is removed', () => {
        render(<QuestionEditor question={question} onSaved={vi.fn()} onCancel={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'A seçeneğini sil' }));

        // "4" was B and is now A; it must still be the marked answer.
        expect(screen.getByRole('button', { name: 'A doğru cevap' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByLabelText('A seçeneği')).toHaveValue('4');
    });

    it('refuses to save once the correct option is gone', () => {
        render(<QuestionEditor question={question} onSaved={vi.fn()} onCancel={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'B seçeneğini sil' }));
        fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

        expect(toastError).toHaveBeenCalledWith('Doğru cevabı işaretleyin');
        expect(updateQuestion).not.toHaveBeenCalled();
    });

    it('sends options keyed by position with the chosen answer', async () => {
        updateQuestion.mockResolvedValue(question);
        render(<QuestionEditor question={question} onSaved={vi.fn()} onCancel={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'C doğru cevap' }));
        fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }));

        expect(updateQuestion).toHaveBeenCalledWith('q1', expect.objectContaining({
            type: 'MultipleChoice',
            correctKey: 'C',
            options: [{ text: '2', assetId: null }, { text: '4', assetId: null }, { text: '6', assetId: null }],
        }));
    });
});
