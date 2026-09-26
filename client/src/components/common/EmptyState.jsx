import React from 'react';

export const EmptyState = ({
  icon = null,
  title = 'No items found',
  description = 'There are no records to display at this time.',
  action = null,
  className = ''
}) => {
  return (
    <div
      className={`empty-state ${className}`}
      style={{
        padding: '36px 20px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          backgroundColor: '#f1f5f9',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {icon || (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>

      <div>
        <h4 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {title}
        </h4>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto' }}>
          {description}
        </p>
      </div>

      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
};

export default EmptyState;
