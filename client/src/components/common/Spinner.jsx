import React from 'react';

export const Spinner = ({ size = 'md', color = 'currentColor', className = '' }) => {
  const pixelSize = size === 'sm' ? 16 : size === 'lg' ? 32 : 22;

  return (
    <svg
      className={`spinner ${className}`}
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        animation: 'spin 0.8s linear infinite',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        style={{ opacity: 0.25 }}
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="16 48"
        style={{ opacity: 0.9 }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
};

export default Spinner;
