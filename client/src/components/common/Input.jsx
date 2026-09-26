import React from 'react';

export const Input = ({
  label,
  id,
  name,
  type = 'text',
  value,
  onChange,
  error,
  helperText,
  required = false,
  placeholder = '',
  disabled = false,
  className = '',
  prefixIcon = null,
  suffixIcon = null,
  ...props
}) => {
  const inputId = id || name;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={inputId} className="form-label">
          <span>
            {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </span>
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {prefixIcon && (
          <span style={{ position: 'absolute', left: 12, color: 'var(--text-muted)', display: 'flex' }}>
            {prefixIcon}
          </span>
        )}

        <input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          className={`form-input ${error ? 'is-error' : ''}`}
          style={{
            paddingLeft: prefixIcon ? '36px' : '12px',
            paddingRight: suffixIcon ? '36px' : '12px'
          }}
          {...props}
        />

        {suffixIcon && (
          <span style={{ position: 'absolute', right: 12, color: 'var(--text-muted)', display: 'flex' }}>
            {suffixIcon}
          </span>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}
      {!error && helperText && <div className="form-help">{helperText}</div>}
    </div>
  );
};

export default Input;
