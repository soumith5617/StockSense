import React from 'react';

export const Card = ({
  title,
  subtitle,
  headerActions = null,
  children,
  footer = null,
  className = '',
  bodyClassName = '',
  ...props
}) => {
  return (
    <div className={`card ${className}`} {...props}>
      {(title || subtitle || headerActions) && (
        <div className="card-header">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {headerActions && <div className="card-actions">{headerActions}</div>}
        </div>
      )}

      <div className={`card-body ${bodyClassName}`}>{children}</div>

      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};

export default Card;
