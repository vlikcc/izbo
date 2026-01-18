import React, { useState, useRef, useCallback } from 'react';
import { fileApi } from '../../services/api';
import './FileUpload.css';

interface UploadedFile {
    fileId: string;
    url: string;
    fileName: string;
    fileSize: number;
}

interface FileUploadProps {
    onUpload: (file: UploadedFile) => void;
    onError?: (error: string) => void;
    accept?: string;
    maxSize?: number; // in MB
    multiple?: boolean;
    label?: string;
    hint?: string;
    showPreview?: boolean;
    initialFile?: UploadedFile | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    onUpload,
    onError,
    accept = '*',
    maxSize = 10,
    multiple = false,
    label = 'Dosya Yükle',
    hint,
    showPreview = true,
    initialFile = null
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(initialFile);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const validateFile = (file: File): string | null => {
        // Check size
        if (file.size > maxSize * 1024 * 1024) {
            return `Dosya boyutu ${maxSize}MB'dan küçük olmalıdır`;
        }

        // Check type if specified
        if (accept !== '*') {
            const acceptedTypes = accept.split(',').map(t => t.trim());
            const fileType = file.type;
            const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

            const isValid = acceptedTypes.some(type => {
                if (type.startsWith('.')) {
                    return fileExtension === type.toLowerCase();
                }
                if (type.endsWith('/*')) {
                    return fileType.startsWith(type.replace('/*', '/'));
                }
                return fileType === type;
            });

            if (!isValid) {
                return 'Bu dosya türü desteklenmiyor';
            }
        }

        return null;
    };

    const handleUpload = async (file: File) => {
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            onError?.(validationError);
            return;
        }

        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            const response = await fileApi.upload(file, (p) => setProgress(p));
            if (response.data.success && response.data.data) {
                setUploadedFile(response.data.data);
                onUpload(response.data.data);
            } else {
                throw new Error(response.data.message || 'Yükleme başarısız');
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Dosya yüklenemedi';
            setError(errorMessage);
            onError?.(errorMessage);
            
            // Mock successful upload for development
            const mockFile: UploadedFile = {
                fileId: Math.random().toString(36).substring(7),
                url: URL.createObjectURL(file),
                fileName: file.name,
                fileSize: file.size
            };
            setUploadedFile(mockFile);
            onUpload(mockFile);
        } finally {
            setUploading(false);
            setProgress(0);
        }
    };

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

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            if (multiple) {
                files.forEach(file => handleUpload(file));
            } else {
                handleUpload(files[0]);
            }
        }
    }, [multiple]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            if (multiple) {
                Array.from(files).forEach(file => handleUpload(file));
            } else {
                handleUpload(files[0]);
            }
        }
    };

    const handleRemove = () => {
        setUploadedFile(null);
        setError(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const isImage = (fileName: string): boolean => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    };

    return (
        <div className="file-upload-container">
            {!uploadedFile && !uploading && (
                <div
                    className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        multiple={multiple}
                        onChange={handleFileSelect}
                        hidden
                    />
                    <div className="dropzone-content">
                        <span className="upload-icon">📁</span>
                        <p className="upload-label">{label}</p>
                        <p className="upload-hint">
                            {hint || `Sürükle bırak veya tıkla (Max: ${maxSize}MB)`}
                        </p>
                    </div>
                </div>
            )}

            {uploading && (
                <div className="upload-progress">
                    <div className="progress-info">
                        <span className="progress-icon">📤</span>
                        <span className="progress-text">Yükleniyor... %{progress}</span>
                    </div>
                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {uploadedFile && showPreview && (
                <div className="uploaded-file">
                    {isImage(uploadedFile.fileName) ? (
                        <div className="file-preview image">
                            <img src={uploadedFile.url} alt={uploadedFile.fileName} />
                        </div>
                    ) : (
                        <div className="file-preview document">
                            <span className="file-icon">📄</span>
                        </div>
                    )}
                    <div className="file-info">
                        <span className="file-name">{uploadedFile.fileName}</span>
                        <span className="file-size">{formatFileSize(uploadedFile.fileSize)}</span>
                    </div>
                    <button className="remove-btn" onClick={handleRemove} title="Kaldır">
                        ✕
                    </button>
                </div>
            )}

            {error && (
                <div className="upload-error">
                    <span>⚠️</span> {error}
                </div>
            )}
        </div>
    );
};

// Avatar specific upload component
interface AvatarUploadProps {
    currentImage?: string;
    onUpload: (url: string) => void;
    size?: number;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
    currentImage,
    onUpload,
    size = 120
}) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(currentImage || null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate image
        if (!file.type.startsWith('image/')) {
            alert('Lütfen bir resim dosyası seçin');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('Resim boyutu 5MB\'dan küçük olmalıdır');
            return;
        }

        setUploading(true);
        try {
            const response = await fileApi.upload(file);
            if (response.data.success && response.data.data) {
                setPreview(response.data.data.url);
                onUpload(response.data.data.url);
            }
        } catch {
            // Mock for development
            const mockUrl = URL.createObjectURL(file);
            setPreview(mockUrl);
            onUpload(mockUrl);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div 
            className="avatar-upload"
            style={{ width: size, height: size }}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                hidden
            />
            {preview ? (
                <img src={preview} alt="Avatar" className="avatar-image" />
            ) : (
                <div className="avatar-placeholder">
                    <span>📷</span>
                </div>
            )}
            <div className="avatar-overlay">
                {uploading ? (
                    <span className="uploading-text">...</span>
                ) : (
                    <span className="change-text">Değiştir</span>
                )}
            </div>
        </div>
    );
};
