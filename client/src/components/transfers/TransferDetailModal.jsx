import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import transferService from '../../services/transferService';

export const TransferDetailModal = ({
  isOpen,
  onClose,
  transferId,
  onEdit,
  onValidate,
  onCancel
}) => {
  const [transfer, setTransfer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && transferId) {
      const fetchDetail = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await transferService.getTransfer(transferId);
          setTransfer(data);
        } catch (err) {
          setError(err.message || 'Failed to load transfer details');
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setTransfer(null);
    }
  }, [isOpen, transferId]);

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

  const totalQuantity = (transfer?.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const canMutate = transfer && transfer.status !== 'done' && transfer.status !== 'canceled';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={transfer ? `Transfer Details: ${transfer.transfer_number}` : 'Transfer Details'}
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
                  onCancel(transfer);
                }}
                style={{ color: 'var(--danger)' }}
              >
                Cancel Transfer
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
                  onEdit(transfer);
                }}
              >
                Edit Transfer
              </Button>
            )}

            {canMutate && onValidate && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onValidate(transfer);
                }}
              >
                Validate & Transfer Stock
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
            Retrieving transfer order details...
          </p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : transfer ? (
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
                INTERNAL TRANSFER REFERENCE
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                <code>{transfer.transfer_number}</code>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                CURRENT STATUS
              </div>
              <Badge status={transfer.status} />
            </div>
          </div>

          {/* Movement Route Card */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 10
              }}
            >
              Transfer Route (Source → Destination)
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: '16px',
                alignItems: 'center'
              }}
            >
              {/* FROM Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>
                  FROM (Source)
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {transfer.source_location_name || `Location #${transfer.source_location_id}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Facility: {transfer.source_warehouse_name || 'Warehouse'}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                  fontWeight: 800
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>

              {/* TO Card */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  TO (Destination)
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {transfer.destination_location_name || `Location #${transfer.destination_location_id}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  Facility: {transfer.destination_warehouse_name || 'Warehouse'}
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '14px',
              backgroundColor: '#fafbfc',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CREATED BY</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {transfer.created_by_name || (transfer.created_by ? `User #${transfer.created_by}` : 'System')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CREATED DATE</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDate(transfer.created_at)}
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
              Transferred Products ({transfer.items?.length || 0})
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
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {(transfer.items || []).map((item) => (
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
                      <td>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {item.unit_of_measure || 'units'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 14 }}>
                        {Number(item.quantity).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan="3" style={{ textAlign: 'right', padding: '10px 12px' }}>
                      Total Transfer Units:
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 12px', color: 'var(--primary)' }}>
                      {totalQuantity.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Informational Status Banner */}
          {transfer.status === 'done' ? (
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
              <strong>Transfer Completed & Validated:</strong>
              <p style={{ marginTop: 2 }}>
                Physical stock has been moved from <strong>{transfer.source_location_name}</strong> to{' '}
                <strong>{transfer.destination_location_name}</strong>. Both <code>transfer_out</code> and{' '}
                <code>transfer_in</code> ledger entries were recorded in the audit trail.
              </p>
            </div>
          ) : transfer.status === 'canceled' ? (
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
              <strong>Transfer Canceled:</strong>
              <p style={{ marginTop: 2 }}>
                This transfer order was canceled. No inventory stock was moved between locations.
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
              <strong>Pending Stock Movement:</strong>
              <p style={{ marginTop: 2 }}>
                This order is in <strong>{transfer.status.toUpperCase()}</strong> status. Inventory stock will only move
                when you click &quot;Validate &amp; Transfer Stock&quot;. The backend verifies source stock availability
                in real time.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default TransferDetailModal;
