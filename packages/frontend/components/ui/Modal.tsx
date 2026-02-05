'use client';

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  description,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  className = '',
  footer,
}) => {
  // Handle escape key
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        className={`
          relative w-full ${sizeStyles[size]}
          bg-surface-container-high rounded-[28px] elevation-3
          animate-in fade-in zoom-in-95 duration-200
          flex flex-col max-h-[90vh]
          ${className}
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            {title && (
              <div>
                <h2
                  id="modal-title"
                  className="text-xl font-medium text-on-surface tracking-tight"
                >
                  {title}
                </h2>
                {description && (
                  <p
                    id="modal-description"
                    className="text-sm text-on-surface-variant mt-1"
                  >
                    {description}
                  </p>
                )}
              </div>
            )}
            {showCloseButton && (
              <IconButton
                icon={<X className="w-5 h-5" />}
                onClick={onClose}
                variant="standard"
                size="md"
                aria-label="Close modal"
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 pt-0 border-t border-outline-variant/50 mt-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// Confirmation Dialog variant
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`
              px-4 py-2 text-sm font-medium rounded-full transition-colors
              ${
                variant === 'danger'
                  ? 'bg-error text-on-error hover:bg-error/90'
                  : 'bg-primary text-on-primary hover:bg-primary/90'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {loading ? 'Loading...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-on-surface-variant">{message}</p>
    </Modal>
  );
};

// Alert Dialog variant
interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
}

const alertIcons = {
  info: (
    <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  success: (
    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  error: (
    <svg className="w-6 h-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      footer={
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium bg-primary text-on-primary rounded-full hover:bg-primary/90 transition-colors"
        >
          OK
        </button>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4">{alertIcons[type]}</div>
        <h3 className="text-lg font-medium text-on-surface mb-2">{title}</h3>
        <p className="text-sm text-on-surface-variant">{message}</p>
      </div>
    </Modal>
  );
};

// Drawer variant (slide from side)
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

const drawerSizeStyles = {
  sm: 'max-w-xs',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  title,
  position = 'right',
  size = 'md',
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`
          absolute top-0 bottom-0 w-full ${drawerSizeStyles[size]}
          bg-surface-container-high
          ${position === 'right' ? 'right-0 animate-in slide-in-from-right' : 'left-0 animate-in slide-in-from-left'}
          duration-300 flex flex-col
        `}
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-outline-variant">
            <h2 className="text-lg font-medium text-on-surface">{title}</h2>
            <IconButton
              icon={<X className="w-5 h-5" />}
              onClick={onClose}
              variant="standard"
            />
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
};
