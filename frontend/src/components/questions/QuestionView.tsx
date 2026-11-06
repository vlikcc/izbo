import React from 'react';
import { MathText } from '../math/MathText';
import assessmentService from '../../services/assessment.service';
import type { QuestionOption } from '../../types/assessment';
import './Questions.css';

interface QuestionViewProps {
    stem: string;
    stemAssetId: string | null;
    options: QuestionOption[];
    /** Shown before the stem, e.g. the question's number in a test. */
    number?: number;
    selectedKey?: string | null;
    /** When set, the right option is marked and a wrong choice is shown as wrong. */
    correctKey?: string | null;
    /** Choosing the selected option again clears it, so a question can be left blank. */
    onSelect?: (key: string | null) => void;
    disabled?: boolean;
}

/** A question with its options, for the test player, the result review and the editor preview. */
export const QuestionView: React.FC<QuestionViewProps> = ({
    stem, stemAssetId, options, number, selectedKey = null, correctKey = null, onSelect, disabled = false,
}) => {
    const interactive = Boolean(onSelect) && !disabled;

    const stateOf = (key: string) => {
        if (correctKey) {
            if (key === correctKey) return 'correct';
            if (key === selectedKey) return 'wrong';
            return '';
        }
        return key === selectedKey ? 'selected' : '';
    };

    return (
        <div className="question-view">
            <div className="question-stem">
                {number !== undefined && <span className="question-number">{number}.</span>}
                <div>
                    {stem && <MathText text={stem} />}
                    {stemAssetId && <img className="question-image" src={assessmentService.assetUrl(stemAssetId)} alt="Soru görseli" loading="lazy" />}
                </div>
            </div>

            <div className="question-options" role="radiogroup" aria-label="Seçenekler">
                {options.map(option => {
                    const state = stateOf(option.key);
                    return (
                        <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={option.key === selectedKey}
                            className={`question-option ${state ? `question-option-${state}` : ''}`}
                            disabled={!interactive}
                            onClick={() => onSelect?.(option.key === selectedKey ? null : option.key)}
                        >
                            <span className="question-option-key">{option.key}</span>
                            <span className="question-option-body">
                                {option.text && <MathText text={option.text} />}
                                {option.assetId && <img className="question-option-image" src={assessmentService.assetUrl(option.assetId)} alt={`${option.key} seçeneği görseli`} loading="lazy" />}
                            </span>
                            {state === 'correct' && <span className="question-option-mark" aria-label="Doğru cevap">✓</span>}
                            {state === 'wrong' && <span className="question-option-mark" aria-label="Senin cevabın">✗</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default QuestionView;
