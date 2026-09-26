import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import locationService from '../../services/locationService';

export const LocationDetailModal = ({
  isOpen,
  onClose,
  locationId,
  onEdit
}) => {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && locationId) {
      const fetchDetail = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await locationService.getLocation(locationId);
          setLocation(data);
        } catch (err) {
          setError(err.message || 'Failed to load location details');
        } finally {
          setLoading(false);
        }
      };
      fetchDetail();
    } else {
      setLocation(null);
    }
  }, [isOpen, locationId]);

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

  const handleNavigateToWarehouse = () => {
    onClose();
    navigate('/warehouses');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={location ? `Location Details: ${location.code}` : 'Location Details'}
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {location && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(location);
              }}
            >
              Edit Location
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Spinner size="md" color="var(--primary)" />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Retrieving location records...
          </p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : location ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {location.name}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <code
                style={{
                  fontSize: 13,
                  backgroundColor: '#f1f5f9',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                {location.code}
              </code>
              <Badge variant="primary">Internal Location</Badge>
            </div>
          </div>

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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PARENT WAREHOUSE</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                {location.warehouse_name || '—'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                Code: {location.warehouse_code || '—'} (ID #{location.warehouse_id})
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>LOCATION RECORD ID</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                #{location.id}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>REGISTERED DATE</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDate(location.created_at)}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 16
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Facility: <strong>{location.warehouse_name}</strong> ({location.warehouse_code})
            </div>
            <button
              type="button"
              onClick={handleNavigateToWarehouse}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              View Warehouse Catalog →
            </button>
          </div>

          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #bfdbfe',
              fontSize: '12px',
              color: '#1e40af',
              lineHeight: 1.4
            }}
          >
            <strong>Inventory Stock Tracking Note:</strong>
            <p style={{ marginTop: 2 }}>
              Physical stock quantities and bin movements for this location are managed via the dedicated operational modules (Receipts, Deliveries, Transfers, Adjustments).
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default LocationDetailModal;
