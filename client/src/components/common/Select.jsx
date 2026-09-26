import React from 'react';

export const Select = ({
  label,
  id,
  name,
  value,
  onChange,
  options = [],
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  placeholder = 'Select an option',
  ...props
}) => {
  const selectId = id || name;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          <span>
            {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
          </span>
        </label>
      )}

      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`form-select ${error ? 'is-error' : ''}`}
        {...props}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => {
          const optValue = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          return (
            <option key={optValue} value={optValue}>
              {optLabel}
            </option>
          );
        })}
      </select>

      {error && <div className="form-error">{error}</div>}
      {!error && helperText && <div className="form-help">{helperText}</div>}
    </div>
  );
};

export default Select;
