import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import productService from '../../services/productService';

export const ProductDetailModal = ({
  isOpen,
  onClose,
  productId,
  onEdit
}) => {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && productId) {
      const fetchDetail = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await productService.getProduct(productId);
          setProduct(data);
        } catch (err) {
          setError(err.message || 'Failed to load product details');
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setProduct(null);
    }
  }, [isOpen, productId]);

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Product Details: ${product.sku}` : 'Product Details'}
      maxWidth="500px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {product && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
            >
              Edit Product
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Spinner size="md" color="var(--primary)" />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Retrieving product records...
          </p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : product ? (
        <div>
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {product.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <code style={{ fontSize: 13, backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                {product.sku}
              </code>
              <Badge variant={product.category_name ? 'primary' : 'draft'}>
                {product.category_name || 'Uncategorized'}
              </Badge>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              backgroundColor: '#fafbfc',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>UNIT OF MEASURE</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {product.unit_of_measure}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>REORDER SAFETY LEVEL</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {product.reorder_level} {product.unit_of_measure}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>SYSTEM RECORD ID</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                #{product.id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>REGISTERED DATE</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDate(product.created_at)}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #bfdbfe',
              fontSize: '12px',
              color: '#1e40af',
              lineHeight: 1.5
            }}
          >
            <strong>Inventory Stock Tracking Note:</strong>
            <p style={{ marginTop: 2 }}>
              Physical stock quantities and bin assignments are tracked per location via the Operations modules (Receipts, Deliveries, Transfers, Adjustments).
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default ProductDetailModal;
