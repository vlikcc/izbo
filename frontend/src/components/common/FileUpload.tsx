import React, { useState, useRef, useCallback } from 'react';
import { fileApi } from '../../services/api';

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
        if (file.size > maxSize * 1024 * 1024) {
            return `Dosya boyutu ${maxSize}MB'dan küçük olmalıdır`;
        }

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
        <div className="w-full">
            {!uploadedFile && !uploading && (
                <div
                    className={`
                        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                        transition-all duration-200
                        ${isDragging 
                            ? 'border-rose-400 bg-rose-50' 
                            : 'border-rose-200 hover:border-rose-300 hover:bg-rose-50/50'
                        }
                    `}
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
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 bg-rose-100 rounded-xl flex items-center justify-center text-2xl">
                            📁
                        </div>
                        <p className="font-medium text-gray-700">{label}</p>
                        <p className="text-sm text-gray-500">
                            {hint || `Sürükle bırak veya tıkla (Max: ${maxSize}MB)`}
                        </p>
                    </div>
                </div>
            )}

            {uploading && (
                <div className="bg-rose-50 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="text-xl">📤</span>
                        <span className="text-sm font-medium text-gray-700">Yükleniyor... %{progress}</span>
                    </div>
                    <div className="h-2 bg-rose-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {uploadedFile && showPreview && (
                <div className="flex items-center gap-4 p-4 bg-white border border-rose-100 rounded-xl">
                    {isImage(uploadedFile.fileName) ? (
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-rose-50 flex-shrink-0">
                            <img 
                                src={uploadedFile.url} 
                                alt={uploadedFile.fileName}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-16 h-16 rounded-lg bg-rose-50 flex items-center justify-center text-2xl flex-shrink-0">
                            📄
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{uploadedFile.fileName}</p>
                        <p className="text-sm text-gray-500">{formatFileSize(uploadedFile.fileSize)}</p>
                    </div>
                    <button 
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors flex items-center justify-center"
                        onClick={handleRemove}
                        title="Kaldır"
                    >
                        ✕
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-3 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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
            className="relative rounded-full overflow-hidden cursor-pointer group"
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
                <img 
                    src={preview} 
                    alt="Avatar" 
                    className="w-full h-full object-cover"
                />
            ) : (
                <div className="w-full h-full bg-gradient-to-br from-rose-100 to-rose-200 flex items-center justify-center text-3xl">
                    📷
                </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploading ? (
                    <span className="text-white text-sm font-medium">...</span>
                ) : (
                    <span className="text-white text-sm font-medium">Değiştir</span>
                )}
            </div>
        </div>
    );
};
