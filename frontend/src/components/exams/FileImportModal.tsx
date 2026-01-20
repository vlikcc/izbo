import React, { useState, useRef, useCallback } from 'react';
import { Button } from '../ui';
import { parseQuestionFile, convertToCreateRequests, type ParsedQuestion } from '../../utils/questionImportUtils';
import type { CreateQuestionRequest } from '../../types';
import './FileImportModal.css';

interface FileImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (questions: CreateQuestionRequest[]) => void;
    startOrderIndex: number;
}

export const FileImportModal: React.FC<FileImportModalProps> = ({
    isOpen,
    onClose,
    onImport,
    startOrderIndex,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [step, setStep] = useState<'upload' | 'preview'>('upload');

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            handleFileSelect(droppedFile);
        }
    }, []);

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            handleFileSelect(selectedFile);
        }
    };

    const handleFileSelect = async (selectedFile: File) => {
        setFile(selectedFile);
        setIsLoading(true);
        setErrors([]);
        setWarnings([]);

        try {
            const result = await parseQuestionFile(selectedFile);

            if (result.success) {
                setParsedQuestions(result.questions);
                setWarnings(result.warnings);
                setStep('preview');
            } else {
                setErrors(result.errors);
                setWarnings(result.warnings);
            }
        } catch (error) {
            setErrors([`Dosya işlenirken hata: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = () => {
        const requests = convertToCreateRequests(parsedQuestions, startOrderIndex);
        onImport(requests);
        handleClose();
    };

    const handleClose = () => {
        setFile(null);
        setParsedQuestions([]);
        setErrors([]);
        setWarnings([]);
        setStep('upload');
        onClose();
    };

    const removeQuestion = (index: number) => {
        setParsedQuestions(prev => prev.filter((_, i) => i !== index));
    };

    if (!isOpen) return null;

    return (
        <div className="file-import-overlay" onClick={handleClose}>
            <div className="file-import-modal" onClick={e => e.stopPropagation()}>
                <div className="file-import-header">
                    <h2>📁 Dosyadan Soru İçe Aktar</h2>
                    <button className="file-import-close" onClick={handleClose}>×</button>
                </div>

                {step === 'upload' ? (
                    <div className="file-import-content">
                        <div
                            className={`file-drop-zone ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.docx"
                                onChange={handleFileInputChange}
                                style={{ display: 'none' }}
                            />

                            {isLoading ? (
                                <div className="file-drop-loading">
                                    <div className="file-drop-spinner" />
                                    <span>Dosya işleniyor...</span>
                                </div>
                            ) : file ? (
                                <div className="file-drop-selected">
                                    <span className="file-icon">📄</span>
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                                </div>
                            ) : (
                                <>
                                    <div className="file-drop-icon">
                                        {isDragging ? '📥' : '📂'}
                                    </div>
                                    <div className="file-drop-text">
                                        <strong>Dosyayı buraya sürükleyin</strong>
                                        <span>veya tıklayarak seçin</span>
                                    </div>
                                    <div className="file-drop-formats">
                                        Desteklenen formatlar: .xlsx, .xls, .docx
                                    </div>
                                </>
                            )}
                        </div>

                        {errors.length > 0 && (
                            <div className="file-import-errors">
                                {errors.map((error, i) => (
                                    <div key={i} className="file-import-error">
                                        ❌ {error}
                                    </div>
                                ))}
                            </div>
                        )}

                        {warnings.length > 0 && (
                            <div className="file-import-warnings">
                                {warnings.map((warning, i) => (
                                    <div key={i} className="file-import-warning">
                                        ⚠️ {warning}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="file-import-help">
                            <h4>📋 Excel Format Örneği</h4>
                            <table className="format-example-table">
                                <thead>
                                    <tr>
                                        <th>Soru</th>
                                        <th>Tip</th>
                                        <th>A</th>
                                        <th>B</th>
                                        <th>C</th>
                                        <th>D</th>
                                        <th>Doğru Cevap</th>
                                        <th>Puan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>2+2=?</td>
                                        <td>Çoktan Seçmeli</td>
                                        <td>3</td>
                                        <td>4</td>
                                        <td>5</td>
                                        <td>6</td>
                                        <td>B</td>
                                        <td>10</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="file-import-content">
                        <div className="file-import-preview-header">
                            <span className="preview-count">
                                ✅ {parsedQuestions.length} soru bulundu
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setStep('upload');
                                    setFile(null);
                                    setParsedQuestions([]);
                                }}
                            >
                                ← Farklı Dosya Seç
                            </Button>
                        </div>

                        {warnings.length > 0 && (
                            <div className="file-import-warnings">
                                {warnings.map((warning, i) => (
                                    <div key={i} className="file-import-warning">
                                        ⚠️ {warning}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="file-import-preview-list">
                            {parsedQuestions.map((q, index) => (
                                <div key={index} className="preview-question-card">
                                    <div className="preview-question-header">
                                        <span className="preview-question-number">{index + 1}</span>
                                        <span className="preview-question-type">
                                            {q.type === 'MultipleChoice' && '📝 Çoktan Seçmeli'}
                                            {q.type === 'TrueFalse' && '✓✗ Doğru/Yanlış'}
                                            {q.type === 'ShortAnswer' && '✏️ Kısa Cevap'}
                                        </span>
                                        <span className="preview-question-points">{q.points} puan</span>
                                        <button
                                            className="preview-remove-btn"
                                            onClick={() => removeQuestion(index)}
                                            title="Bu soruyu çıkar"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="preview-question-content">
                                        {q.content}
                                    </div>
                                    {q.options.length > 0 && (
                                        <div className="preview-question-options">
                                            {q.options.map((opt, optIndex) => (
                                                <span
                                                    key={optIndex}
                                                    className={`preview-option ${q.correctAnswer === String.fromCharCode(65 + optIndex) || q.correctAnswer === opt ? 'correct' : ''}`}
                                                >
                                                    {String.fromCharCode(65 + optIndex)}) {opt}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="file-import-footer">
                    <Button variant="ghost" onClick={handleClose}>
                        İptal
                    </Button>
                    {step === 'preview' && parsedQuestions.length > 0 && (
                        <Button variant="primary" onClick={handleImport}>
                            ✅ {parsedQuestions.length} Soruyu İçe Aktar
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileImportModal;
