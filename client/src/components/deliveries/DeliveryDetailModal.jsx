import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import deliveryService from '../../services/deliveryService';

export const DeliveryDetailModal = ({
  isOpen,
  onClose,
  deliveryId,
  onEdit,
  onValidate,
  onCancel
}) => {
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && deliveryId) {
      const fetchDetail = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await deliveryService.getDelivery(deliveryId);
          setDelivery(data);
        } catch (err) {
          setError(err.message || 'Failed to load delivery order details');
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setDelivery(null);
    }
  }, [isOpen, deliveryId]);

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

  const totalQuantity = (delivery?.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );

  const canMutate = delivery && delivery.status !== 'done' && delivery.status !== 'canceled';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={delivery ? `Delivery Details: ${delivery.delivery_number}` : 'Delivery Details'}
      maxWidth="680px"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {canMutate && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onClose();
                  onCancel(delivery);
                }}
                style={{ color: 'var(--danger)' }}
              >
                Cancel Order
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
                  onEdit(delivery);
                }}
              >
                Edit Order
              </Button>
            )}

            {canMutate && onValidate && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onValidate(delivery);
                }}
              >
                Validate & Dispatch Stock
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
            Retrieving delivery order details...
          </p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : delivery ? (
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
                DELIVERY ORDER REFERENCE
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                <code>{delivery.delivery_number}</code>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                CURRENT STATUS
              </div>
              <Badge status={delivery.status} />
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>DESTINATION CUSTOMER</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {delivery.customer_name || 'Walk-in / Unspecified Customer'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SOURCE DEPARTURE LOCATION</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {delivery.location_name || `Location #${delivery.location_id}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                Facility: {delivery.warehouse_name || 'Warehouse'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>DISPATCHED BY USER</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {delivery.created_by_name || (delivery.created_by ? `User #${delivery.created_by}` : 'System')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>CREATION TIMESTAMP</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDate(delivery.created_at)}
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
              Dispatched Line Items ({delivery.items?.length || 0})
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
                  {(delivery.items || []).map((item) => (
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
                      Total Units:
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
          {delivery.status === 'done' ? (
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
              <strong>Delivery Completed & Validated:</strong>
              <p style={{ marginTop: 2 }}>
                Physical stock balances at <strong>{delivery.location_name}</strong> have been deducted by the dispatched quantities. Negative movement entries are permanently recorded in the stock ledger.
              </p>
            </div>
          ) : delivery.status === 'canceled' ? (
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
              <strong>Delivery Canceled:</strong>
              <p style={{ marginTop: 2 }}>
                This delivery order was canceled. No inventory stock was deducted from the warehouse.
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
              <strong>Pending Dispatch Validation:</strong>
              <p style={{ marginTop: 2 }}>
                This order is in <strong>{delivery.status.toUpperCase()}</strong> status. Inventory stock will only be deducted when you click "Validate & Dispatch Stock". The backend verifies real-time stock availability during validation.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default DeliveryDetailModal;
