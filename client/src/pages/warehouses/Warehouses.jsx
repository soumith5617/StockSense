import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import warehouseService from '../../services/warehouseService';
import locationService from '../../services/locationService';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBox from '../../components/common/SearchBox';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import WarehouseModal from '../../components/warehouses/WarehouseModal';
import WarehouseDetailModal from '../../components/warehouses/WarehouseDetailModal';

export const Warehouses = () => {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals state
  const [modalState, setModalState] = useState({
    isOpen: false,
    warehouse: null
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    warehouseId: null
  });

  const [deleteDialogState, setDeleteDialogState] = useState({
    isOpen: false,
    warehouse: null,
    loading: false
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [whList, locList] = await Promise.all([
        warehouseService.getWarehouses(),
        locationService.getLocations()
      ]);
      setWarehouses(whList);
      setLocations(locList);
    } catch (err) {
      setError(err.message || 'Failed to retrieve warehouses from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute location count map per warehouse from actual location records
  const locationCountMap = useMemo(() => {
    const map = new Map();
    locations.forEach((loc) => {
      const whId = Number(loc.warehouse_id);
      map.set(whId, (map.get(whId) || 0) + 1);
    });
    return map;
  }, [locations]);

  // Client-side search across Name, Code, and Address
  const filteredWarehouses = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return warehouses;

    return warehouses.filter((w) => {
      return (
        w.name?.toLowerCase().includes(query) ||
        w.code?.toLowerCase().includes(query) ||
        w.address?.toLowerCase().includes(query)
      );
    });
  }, [warehouses, searchQuery]);

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({ isOpen: true, warehouse: null });
  };

  const handleOpenEdit = (warehouse) => {
    setActionError(null);
    setModalState({ isOpen: true, warehouse });
  };

  const handleOpenView = (warehouseId) => {
    setDetailModalState({ isOpen: true, warehouseId });
  };

  const handleOpenDelete = (warehouse) => {
    setActionError(null);
    setDeleteDialogState({ isOpen: true, warehouse, loading: false });
  };

  const handleConfirmDelete = async () => {
    const { warehouse } = deleteDialogState;
    if (!warehouse) return;

    setDeleteDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await warehouseService.deleteWarehouse(warehouse.id);
      setSuccessMessage(`Warehouse "${warehouse.name}" (${warehouse.code}) deleted successfully`);
      setDeleteDialogState({ isOpen: false, warehouse: null, loading: false });
      fetchData();
    } catch (err) {
      setDeleteDialogState((prev) => ({ ...prev, loading: false }));
      // 409 Conflict when warehouse still has locations or is referenced
      if (err.status === 409 || err.message?.includes('location') || err.message?.includes('referenced')) {
        setActionError(
          err.message ||
            `This warehouse cannot be deleted because it still contains locations or is referenced by inventory transactions. Remove or reassign locations first.`
        );
      } else {
        setActionError(err.message || 'Failed to delete warehouse.');
      }
      setDeleteDialogState({ isOpen: false, warehouse: null, loading: false });
    }
  };

  const handleModalSuccess = (msg) => {
    setSuccessMessage(msg);
    fetchData();
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="warehouses-page">
      {/* Header with Title and Add Warehouse Button */}
      <PageHeader
        title="Warehouse Facilities"
        subtitle="Configure physical buildings, fulfillment hubs, and distribution centers"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Add Warehouse
            </Button>
          </>
        }
      />

      {/* Action / Success / Error Banners */}
      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div style={{ flex: 1 }}>{successMessage}</div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>{actionError}</div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Card with Toolbar and Data Table */}
      <Card>
        {/* Filters Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <SearchBox
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search warehouses by name, code, or address..."
              width="340px"
            />
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredWarehouses.length}</strong> of <strong>{warehouses.length}</strong> facilities
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading warehouse facilities...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Warehouses"
            message={error}
            onRetry={fetchData}
          />
        ) : filteredWarehouses.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No matching facilities' : 'No warehouses registered'}
            description={
              searchQuery
                ? `No warehouses matched your search term "${searchQuery}". Try clearing filters.`
                : 'Get started by creating your primary warehouse or fulfillment facility.'
            }
            action={
              searchQuery ? (
                <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                  + Add First Warehouse
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Warehouse Facility</th>
                  <th>Facility Code</th>
                  <th>Physical Address</th>
                  <th>Locations</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.map((w) => {
                  const locCount = locationCountMap.get(Number(w.id)) || 0;
                  return (
                    <tr key={w.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {w.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          ID #{w.id}
                        </div>
                      </td>

                      <td>
                        <code
                          style={{
                            backgroundColor: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#334155'
                          }}
                        >
                          {w.code}
                        </code>
                      </td>

                      <td>
                        <span
                          style={{
                            color: w.address ? 'var(--text-secondary)' : 'var(--text-muted)',
                            fontSize: '13px'
                          }}
                        >
                          {w.address || '—'}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/locations?warehouseId=${w.id}`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer'
                          }}
                          title={`Click to filter locations in ${w.name}`}
                        >
                          <Badge variant={locCount > 0 ? 'success' : 'draft'}>
                            {locCount} {locCount === 1 ? 'Location' : 'Locations'}
                          </Badge>
                        </button>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {formatDate(w.created_at)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenView(w.id)}
                            title="View Facility Details"
                          >
                            View
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(w)}
                            title="Edit Warehouse"
                          >
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(w)}
                            style={{ color: 'var(--danger)' }}
                            title="Delete Warehouse"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Warehouse Modal */}
      <WarehouseModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, warehouse: null })}
        warehouse={modalState.warehouse}
        onSuccess={handleModalSuccess}
      />

      {/* Warehouse Detail Modal */}
      <WarehouseDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, warehouseId: null })}
        warehouseId={detailModalState.warehouseId}
        onEdit={handleOpenEdit}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogState.isOpen}
        onClose={() => setDeleteDialogState({ isOpen: false, warehouse: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Warehouse Facility"
        message={`Are you sure you want to delete "${deleteDialogState.warehouse?.name}" (${deleteDialogState.warehouse?.code})? Warehouses containing active locations or referenced by inventory transactions cannot be removed.`}
        confirmText="Delete Warehouse"
        variant="danger"
        loading={deleteDialogState.loading}
      />
    </div>
  );
};

export default Warehouses;
