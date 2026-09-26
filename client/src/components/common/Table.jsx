import React from 'react';
import Spinner from './Spinner';
import EmptyState from './EmptyState';

export const Table = ({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  emptyTitle = 'No data available',
  children,
  className = ''
}) => {
  if (children) {
    return (
      <div className={`table-container ${className}`}>
        <table className="data-table">{children}</table>
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th
                key={col.key || index}
                style={{ textAlign: col.align || 'left', width: col.width || 'auto' }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px' }}>
                <Spinner size="lg" color="var(--primary)" />
                <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 13 }}>
                  Loading records...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '30px' }}>
                <EmptyState title={emptyTitle} description={emptyMessage} />
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={row.id || rowIndex}>
                {columns.map((col, colIndex) => (
                  <td key={col.key || colIndex} style={{ textAlign: col.align || 'left' }}>
                    {col.render ? col.render(row[col.key], row, rowIndex) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
