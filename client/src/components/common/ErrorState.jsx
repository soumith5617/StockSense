import React from 'react';
import Button from './Button';

export const ErrorState = ({
  title = 'Failed to load data',
  message = 'An error occurred while connecting to the server. Please verify your connection and try again.',
  onRetry = null,
  inline = false,
  className = ''
}) => {
  if (inline) {
    return (
      <div className={`alert alert-danger ${className}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div style={{ flex: 1 }}>{message}</div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`error-state ${className}`}
      style={{
        padding: '36px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        backgroundColor: '#fff',
        border: '1px solid var(--danger-border)',
        borderRadius: 'var(--radius-lg)'
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          backgroundColor: 'var(--danger-light)',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div>
        <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {title}
        </h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
          {message}
        </p>
      </div>

      {onRetry && (
        <div style={{ marginTop: 8 }}>
          <Button variant="primary" size="sm" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
};

export default ErrorState;
