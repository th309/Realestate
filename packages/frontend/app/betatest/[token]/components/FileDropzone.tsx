/**
 * File Dropzone Component
 * 
 * Drag-and-drop file upload area with preview support.
 * Uploads files to Supabase Storage via API route.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import type { Attachment } from '../../types';

interface FileDropzoneProps {
  token: string;
  onFilesAdded: (attachments: Attachment[]) => void;
  attachments: Attachment[];
  onRemove: (index: number) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
];

export function FileDropzone({ token, onFilesAdded, attachments, onRemove }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File ${file.name} is too large (max 10MB)`;
    }
    return null;
  };

  const uploadFile = async (file: File): Promise<Attachment | null> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/betatest/upload', {
      method: 'POST',
      headers: {
        'X-Tester-Token': token,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    const result = await response.json();
    return result.attachment;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploadError(null);
    const fileArray = Array.from(files);
    
    // Validate all files first
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        return;
      }
    }

    setIsUploading(true);
    const uploaded: Attachment[] = [];

    try {
      for (const file of fileArray) {
        const attachment = await uploadFile(file);
        if (attachment) {
          uploaded.push(attachment);
        }
      }
      onFilesAdded(uploaded);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [token, onFilesAdded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string): string => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type === 'application/pdf') return '📄';
    return '📎';
  };

  return (
    <div className="space-y-3">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-outline-variant hover:border-outline hover:bg-surface-container'
          }
          ${isUploading ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileInput}
          className="sr-only"
        />
        
        <div className="space-y-2">
          <div className="text-3xl">
            {isUploading ? '⏳' : '📎'}
          </div>
          <p className="text-sm font-medium text-on-surface">
            {isUploading ? 'Uploading...' : 'Drop files here or click to upload'}
          </p>
          <p className="text-xs text-on-surface-variant">
            PNG, JPG, GIF, WebP, MP4, WebM, PDF up to 10MB
          </p>
        </div>
      </div>

      {/* Error Display */}
      {uploadError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{uploadError}</p>
        </div>
      )}

      {/* Attachment List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div
              key={`${attachment.filename}-${index}`}
              className="flex items-center justify-between p-3 rounded-lg bg-surface-container border border-outline-variant"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl flex-shrink-0">
                  {getFileIcon(attachment.type)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-1 rounded-full hover:bg-red-100 text-on-surface-variant hover:text-red-600 transition-colors"
                aria-label={`Remove ${attachment.filename}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
