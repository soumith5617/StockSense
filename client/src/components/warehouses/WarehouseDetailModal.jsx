import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Spinner from '../common/Spinner';
import warehouseService from '../../services/warehouseService';
import locationService from '../../services/locationService';

export const WarehouseDetailModal = ({
  isOpen,
  onClose,
  warehouseId,
  onEdit
}) => {
  const navigate = useNavigate();
  const [warehouse, setWarehouse] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && warehouseId) {
      const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
          const [whData, allLocs] = await Promise.all([
            warehouseService.getWarehouse(warehouseId),
            locationService.getLocations()
          ]);
          setWarehouse(whData);
          setLocations(allLocs.filter((l) => Number(l.warehouse_id) === Number(warehouseId)));
        } catch (err) {
          setError(err.message || 'Failed to load warehouse details');
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else {
      setWarehouse(null);
      setLocations([]);
    }
  }, [isOpen, warehouseId]);

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

  const handleNavigateToLocations = () => {
    onClose();
    navigate(`/locations?warehouseId=${warehouseId}`);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={warehouse ? `Warehouse Facility: ${warehouse.code}` : 'Warehouse Details'}
      maxWidth="560px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {warehouse && (
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(warehouse);
              }}
            >
              Edit Warehouse
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <Spinner size="md" color="var(--primary)" />
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            Retrieving facility records...
          </p>
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : warehouse ? (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {warehouse.name}
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
                {warehouse.code}
              </code>
              <Badge variant={locations.length > 0 ? 'success' : 'draft'}>
                {locations.length} {locations.length === 1 ? 'Location' : 'Locations'} Configured
              </Badge>
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>SYSTEM RECORD ID</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>
                #{warehouse.id}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>FACILITY CREATED</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                {formatDate(warehouse.created_at)}
              </div>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>PHYSICAL ADDRESS</div>
              <div style={{ fontSize: 13, color: warehouse.address ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: 2 }}>
                {warehouse.address || 'No address specified for this facility'}
              </div>
            </div>
          </div>

          {/* Locations Hierarchy */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8
              }}
            >
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Associated Locations ({locations.length})
              </h4>
              {locations.length > 0 && (
                <button
                  type="button"
                  onClick={handleNavigateToLocations}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  View in Locations Table →
                </button>
              )}
            </div>

            {locations.length === 0 ? (
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px dashed var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  textAlign: 'center'
                }}
              >
                No internal storage locations currently mapped to this facility.
              </div>
            ) : (
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 12px', fontSize: 12 }}>Location Name</th>
                      <th style={{ padding: '6px 12px', fontSize: 12 }}>Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map((loc) => (
                      <tr key={loc.id}>
                        <td style={{ padding: '6px 12px', fontSize: 13 }}>{loc.name}</td>
                        <td style={{ padding: '6px 12px', fontSize: 12 }}>
                          <code>{loc.code}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
              Physical inventory stock balances are maintained at the location and bin level via operational transaction modules.
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};

export default WarehouseDetailModal;
