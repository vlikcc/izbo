import React, { useState, useEffect } from 'react';
import { Button } from '../ui';
import type { Question, QuestionType, CreateQuestionRequest } from '../../types';
import './QuestionEditor.css';

interface QuestionEditorProps {
    question?: Question;
    orderIndex: number;
    onSave: (data: CreateQuestionRequest) => void;
    onCancel?: () => void;
    onDelete?: () => void;
    isNew?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuestionEditor: React.FC<QuestionEditorProps> = ({
    question,
    orderIndex,
    onSave,
    onCancel,
    onDelete,
    isNew = false,
}) => {
    const [type, setType] = useState<QuestionType>(question?.type || 'MultipleChoice');
    const [content, setContent] = useState(question?.content || '');
    const [options, setOptions] = useState<string[]>(question?.options || ['', '', '', '']);
    const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer || '');
    const [points, setPoints] = useState(question?.points || 10);
    const [explanation, setExplanation] = useState(question?.explanation || '');
    const [isEditing, setIsEditing] = useState(isNew);

    useEffect(() => {
        if (question) {
            setType(question.type);
            setContent(question.content);
            setOptions(question.options || ['', '', '', '']);
            setCorrectAnswer(question.correctAnswer || '');
            setPoints(question.points);
            setExplanation(question.explanation || '');
        }
    }, [question]);

    const handleTypeChange = (newType: QuestionType) => {
        setType(newType);
        if (newType === 'TrueFalse') {
            setOptions(['Doğru', 'Yanlış']);
            setCorrectAnswer('');
        } else if (newType === 'MultipleChoice') {
            setOptions(['', '', '', '']);
            setCorrectAnswer('');
        } else {
            setOptions([]);
            setCorrectAnswer('');
        }
    };

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        if (options.length < 6) {
            setOptions([...options, '']);
        }
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = options.filter((_, i) => i !== index);
            setOptions(newOptions);
            // Clear correct answer if it was pointing to removed option
            if (correctAnswer === OPTION_LETTERS[index]) {
                setCorrectAnswer('');
            } else if (correctAnswer && OPTION_LETTERS.indexOf(correctAnswer) > index) {
                // Adjust correct answer index if needed
                const currentIndex = OPTION_LETTERS.indexOf(correctAnswer);
                setCorrectAnswer(OPTION_LETTERS[currentIndex - 1]);
            }
        }
    };

    const handleSubmit = () => {
        if (!content.trim()) {
            alert('Lütfen soru içeriğini girin.');
            return;
        }

        if (type === 'MultipleChoice' && !correctAnswer) {
            alert('Lütfen doğru cevabı seçin.');
            return;
        }

        if (type === 'TrueFalse' && !correctAnswer) {
            alert('Lütfen doğru cevabı seçin.');
            return;
        }

        const questionData: CreateQuestionRequest = {
            orderIndex,
            type,
            content: content.trim(),
            options: type !== 'ShortAnswer' ? options.filter(o => o.trim()) : undefined,
            correctAnswer: correctAnswer || undefined,
            points,
            explanation: explanation.trim() || undefined,
        };

        onSave(questionData);
        if (isNew) {
            // Reset for new question
            setContent('');
            setOptions(['', '', '', '']);
            setCorrectAnswer('');
            setExplanation('');
        }
        setIsEditing(false);
    };

    const renderOptions = () => {
        if (type === 'ShortAnswer') {
            return (
                <div className="question-options">
                    <div className="question-options-title">
                        ✏️ Kısa cevap bekleniyor
                    </div>
                    <input
                        type="text"
                        className="option-input"
                        placeholder="Beklenen doğru cevap (isteğe bağlı)"
                        value={correctAnswer}
                        onChange={(e) => setCorrectAnswer(e.target.value)}
                    />
                </div>
            );
        }

        if (type === 'TrueFalse') {
            return (
                <div className="question-options">
                    <div className="question-options-title">Doğru Cevap</div>
                    <div className="tf-options">
                        <button
                            type="button"
                            className={`tf-option ${correctAnswer === 'Doğru' ? 'selected' : ''}`}
                            onClick={() => setCorrectAnswer('Doğru')}
                        >
                            ✓ Doğru
                        </button>
                        <button
                            type="button"
                            className={`tf-option ${correctAnswer === 'Yanlış' ? 'selected' : ''}`}
                            onClick={() => setCorrectAnswer('Yanlış')}
                        >
                            ✗ Yanlış
                        </button>
                    </div>
                </div>
            );
        }

        // Multiple Choice
        return (
            <div className="question-options">
                <div className="question-options-header">
                    <span className="question-options-title">Seçenekler</span>
                    {options.length < 6 && (
                        <button type="button" className="add-option-btn" onClick={addOption}>
                            + Seçenek Ekle
                        </button>
                    )}
                </div>
                {options.map((option, index) => (
                    <div key={index} className="option-item">
                        <span className={`option-letter ${correctAnswer === OPTION_LETTERS[index] ? 'correct' : ''}`}>
                            {OPTION_LETTERS[index]}
                        </span>
                        <input
                            type="text"
                            className={`option-input ${correctAnswer === OPTION_LETTERS[index] ? 'correct' : ''}`}
                            placeholder={`Seçenek ${OPTION_LETTERS[index]}`}
                            value={option}
                            onChange={(e) => handleOptionChange(index, e.target.value)}
                        />
                        <button
                            type="button"
                            className={`option-correct-btn ${correctAnswer === OPTION_LETTERS[index] ? 'active' : ''}`}
                            onClick={() => setCorrectAnswer(OPTION_LETTERS[index])}
                            title="Doğru cevap olarak işaretle"
                        >
                            ✓
                        </button>
                        {options.length > 2 && (
                            <button
                                type="button"
                                className="option-delete-btn"
                                onClick={() => removeOption(index)}
                                title="Seçeneği sil"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    if (!isEditing && !isNew) {
        // Compact view for existing questions
        return (
            <div className="question-editor" onClick={() => setIsEditing(true)}>
                <div className="question-editor-header">
                    <span className="question-number">{orderIndex}</span>
                    <span style={{ flex: 1, color: 'var(--color-gray-800)' }}>
                        {content || 'Soru içeriği...'}
                    </span>
                    <span style={{
                        padding: '4px 12px',
                        background: 'var(--color-gray-100)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-gray-600)'
                    }}>
                        {type === 'MultipleChoice' && 'Çoktan Seçmeli'}
                        {type === 'TrueFalse' && 'Doğru/Yanlış'}
                        {type === 'ShortAnswer' && 'Kısa Cevap'}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary-600)' }}>
                        {points} puan
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className={`question-editor ${isEditing ? 'editing' : ''}`}>
            {/* Header Row */}
            <div className="question-editor-header">
                <span className="question-number">{orderIndex}</span>
                <select
                    className="question-type-select"
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                >
                    <option value="MultipleChoice">Çoktan Seçmeli</option>
                    <option value="TrueFalse">Doğru / Yanlış</option>
                    <option value="ShortAnswer">Kısa Cevap</option>
                </select>
                <div className="question-points">
                    <span className="question-points-label">Puan:</span>
                    <input
                        type="number"
                        className="question-points-input"
                        value={points}
                        onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        max="100"
                    />
                </div>
            </div>

            {/* Question Content */}
            <div className="question-content-area">
                <label className="question-content-label">
                    📝 Soru Metni
                </label>
                <textarea
                    className="question-content-textarea"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Soru metnini buraya yazın... 

💡 KaTeX ile matematiksel formül kullanabilirsiniz:
   Satır içi: $x^2 + y^2 = r^2$
   Blok: $$\int_0^1 x^2 dx$$"
                />
                <span className="katex-hint">
                    💡 Matematiksel ifadeler için: satır içi $formül$, blok $$formül$$
                </span>
            </div>

            {/* Options */}
            {renderOptions()}

            {/* Explanation */}
            <div className="question-explanation">
                <label className="question-explanation-label">
                    💡 Açıklama (İsteğe bağlı)
                </label>
                <textarea
                    className="question-explanation-input"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Doğru cevabın açıklaması..."
                    rows={2}
                />
            </div>

            {/* Actions */}
            <div className="question-actions">
                {onDelete && !isNew && (
                    <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                        🗑️ Sil
                    </Button>
                )}
                {onCancel && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                        setIsEditing(false);
                        onCancel();
                    }}>
                        İptal
                    </Button>
                )}
                <Button type="button" variant="primary" size="sm" onClick={handleSubmit}>
                    {isNew ? '➕ Soru Ekle' : '💾 Kaydet'}
                </Button>
            </div>
        </div>
    );
};

export default QuestionEditor;
