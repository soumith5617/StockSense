import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import adjustmentService from '../../services/adjustmentService';

export const AdjustmentDetailModal = ({
  isOpen,
  onClose,
  adjustmentId,
  onEdit,
  onValidate,
  onCancel
}) => {
  const [adjustment, setAdjustment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && adjustmentId) {
      const fetchDetail = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await adjustmentService.getAdjustment(adjustmentId);
          setAdjustment(data);
        } catch (err) {
          setError(err.message || 'Failed to load adjustment details');
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setAdjustment(null);
    }
  }, [isOpen, adjustmentId]);

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const canMutate = adjustment && adjustment.status === 'draft';

  const hasZeroDiffItem = (adjustment?.items || []).some(
    (item) => Number(item.difference) === 0
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={adjustment ? `Adjustment Details: ${adjustment.adjustment_number}` : 'Adjustment Details'}
      maxWidth="720px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {canMutate && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  onCancel(adjustment);
                }}
                style={{ color: 'var(--danger)' }}
              >
                Cancel Adjustment
              </Button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>

            {canMutate && onEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  onEdit(adjustment);
                }}
              >
                Edit Adjustment
              </Button>
            )}

            {canMutate && onValidate && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onValidate(adjustment);
                }}
              >
                Validate & Update Stock
              </Button>
            )}
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Spinner size="md" color="var(--primary)" />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Retrieving inventory adjustment details...
          </p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : adjustment ? (
        <div>
          {/* Header Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                ADJUSTMENT REFERENCE NUMBER
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                <code>{adjustment.adjustment_number}</code>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                CURRENT STATUS
              </div>
              <Badge status={adjustment.status} />
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              backgroundColor: '#fafbfc',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>LOCATION</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {adjustment.location_name || `Location #${adjustment.location_id}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                Facility: {adjustment.warehouse_name || 'Warehouse'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>REASON</div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, fontWeight: 500 }}>
                {adjustment.reason || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No reason recorded</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CREATED BY</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {adjustment.created_by_name || (adjustment.created_by ? `User #${adjustment.created_by}` : 'System')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CREATED DATE</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDate(adjustment.created_at)}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: 16 }}>
            <h4
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8
              }}
            >
              Adjusted Products ({adjustment.items?.length || 0})
            </h4>

            <div
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden'
              }}
            >
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign: 'right' }}>System Qty</th>
                    <th style={{ textAlign: 'right' }}>Counted Qty</th>
                    <th style={{ textAlign: 'right' }}>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {(adjustment.items || []).map((item) => {
                    const diffNum = Number(item.difference);
                    const isPositive = diffNum > 0;
                    const isNegative = diffNum < 0;
                    const isZero = diffNum === 0;

                    return (
                      <tr key={item.id || item.product_id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.product_name || `Product #${item.product_id}`}
                          </div>
                        </td>
                        <td>
                          <code
                            style={{
                              backgroundColor: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600
                            }}
                          >
                            {item.product_sku || '—'}
                          </code>
                        </td>
                        <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {Number(item.system_quantity).toLocaleString()} {item.unit_of_measure || ''}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {Number(item.counted_quantity).toLocaleString()} {item.unit_of_measure || ''}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: isPositive ? '#dcfce7' : isNegative ? '#fee2e2' : '#f1f5f9',
                              color: isPositive ? '#166534' : isNegative ? '#991b1b' : 'var(--text-secondary)'
                            }}
                          >
                            {isPositive ? `+${diffNum}` : diffNum}
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                            {isPositive ? 'Stock Increase' : isNegative ? 'Stock Decrease' : 'No Movement'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Informational Status Banner */}
          {adjustment.status === 'done' ? (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#f0fdf4',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #bbf7d0',
                fontSize: '12px',
                color: '#166534',
                lineHeight: 1.4
              }}
            >
              <strong>Adjustment Completed & Validated:</strong>
              <p style={{ marginTop: 2 }}>
                Physical stock at <strong>{adjustment.location_name}</strong> has been updated to the exact counted quantities.
                Stock ledger audit records have been generated for all items with non-zero quantity changes.
              </p>
            </div>
          ) : adjustment.status === 'canceled' ? (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#fef2f2',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #fecaca',
                fontSize: '12px',
                color: '#991b1b',
                lineHeight: 1.4
              }}
            >
              <strong>Adjustment Canceled:</strong>
              <p style={{ marginTop: 2 }}>
                This adjustment was canceled. No physical stock or ledger entries were modified.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#eff6ff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid #bfdbfe',
                fontSize: '12px',
                color: '#1e40af',
                lineHeight: 1.4
              }}
            >
              <strong>Pending Stock Reconciliation:</strong>
              <p style={{ marginTop: 2 }}>
                This adjustment is currently in <strong>DRAFT</strong> status. Stock balances will only be updated when
                you click &quot;Validate &amp; Update Stock&quot;. The backend re-reads current stock during validation.
              </p>
              {hasZeroDiffItem && (
                <p style={{ marginTop: 4, fontWeight: 600 }}>
                  Note: Items where counted quantity equals system quantity produce zero inventory ledger movements.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default AdjustmentDetailModal;
