import React from 'react';

export const Badge = ({ status, variant, children, className = '' }) => {
  const normalizedStatus = (status || '').toLowerCase();
  
  let computedVariant = variant;
  if (!computedVariant) {
    if (['done', 'success', 'active', 'completed'].includes(normalizedStatus)) {
      computedVariant = 'done';
    } else if (['canceled', 'cancelled', 'failed', 'danger', 'error'].includes(normalizedStatus)) {
      computedVariant = 'canceled';
    } else if (['ready', 'warning', 'low_stock'].includes(normalizedStatus)) {
      computedVariant = 'ready';
    } else if (['waiting', 'pending', 'in_progress', 'info'].includes(normalizedStatus)) {
      computedVariant = 'waiting';
    } else {
      computedVariant = 'draft';
    }
  }

  const badgeClass = `badge badge-${computedVariant} ${className}`;

  return (
    <span className={badgeClass}>
      {children || status}
    </span>
  );
};

export default Badge;
