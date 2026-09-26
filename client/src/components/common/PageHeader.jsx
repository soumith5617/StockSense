import React from 'react';

export const PageHeader = ({
  title,
  subtitle = null,
  actions = null,
  className = ''
}) => {
  return (
    <div
      className={`page-header ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '24px'
      }}
    >
      <div>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px'
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
