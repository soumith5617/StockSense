import React from 'react';

export const SearchBox = ({
  value,
  onChange,
  placeholder = 'Search...',
  onClear = null,
  className = '',
  width = '260px'
}) => {
  return (
    <div
      className={`search-box ${className}`}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width }}
    >
      <span
        style={{
          position: 'absolute',
          left: 12,
          color: 'var(--text-muted)',
          display: 'flex',
          pointerEvents: 'none'
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>

      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="form-input"
        style={{
          paddingLeft: '34px',
          paddingRight: value ? '32px' : '12px',
          fontSize: '13px',
          height: '38px'
        }}
      />

      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          style={{
            position: 'absolute',
            right: 8,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex'
          }}
          aria-label="Clear search"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchBox;
