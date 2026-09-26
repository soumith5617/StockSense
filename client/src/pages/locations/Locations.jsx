import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import locationService from '../../services/locationService';
import warehouseService from '../../services/warehouseService';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBox from '../../components/common/SearchBox';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import LocationModal from '../../components/locations/LocationModal';
import LocationDetailModal from '../../components/locations/LocationDetailModal';

export const Locations = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [locations, setLocations] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const warehouseParam = searchParams.get('warehouseId') || '';
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState(warehouseParam);

  // Sync if URL query param changes
  useEffect(() => {
    setSelectedWarehouseFilter(searchParams.get('warehouseId') || '');
  }, [searchParams]);

  // Notifications
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals state
  const [modalState, setModalState] = useState({
    isOpen: false,
    location: null,
    defaultWarehouseId: ''
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    locationId: null
  });

  const [deleteDialogState, setDeleteDialogState] = useState({
    isOpen: false,
    location: null,
    loading: false
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [locList, whList] = await Promise.all([
        locationService.getLocations(),
        warehouseService.getWarehouses()
      ]);
      setLocations(locList);
      setWarehouses(whList);
    } catch (err) {
      setError(err.message || 'Failed to retrieve locations from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Client-side filtering across Name, Code, and Warehouse
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        loc.name?.toLowerCase().includes(query) ||
        loc.code?.toLowerCase().includes(query);

      const matchesWarehouse =
        !selectedWarehouseFilter ||
        String(loc.warehouse_id) === String(selectedWarehouseFilter);

      return matchesSearch && matchesWarehouse;
    });
  }, [locations, searchQuery, selectedWarehouseFilter]);

  const handleWarehouseFilterChange = (e) => {
    const val = e.target.value;
    setSelectedWarehouseFilter(val);
    if (val) {
      setSearchParams({ warehouseId: val });
    } else {
      setSearchParams({});
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedWarehouseFilter('');
    setSearchParams({});
  };

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({
      isOpen: true,
      location: null,
      defaultWarehouseId: selectedWarehouseFilter || (warehouses[0]?.id ? String(warehouses[0].id) : '')
    });
  };

  const handleOpenEdit = (location) => {
    setActionError(null);
    setModalState({
      isOpen: true,
      location,
      defaultWarehouseId: String(location.warehouse_id)
    });
  };

  const handleOpenView = (locationId) => {
    setDetailModalState({ isOpen: true, locationId });
  };

  const handleOpenDelete = (location) => {
    setActionError(null);
    setDeleteDialogState({ isOpen: true, location, loading: false });
  };

  const handleConfirmDelete = async () => {
    const { location } = deleteDialogState;
    if (!location) return;

    setDeleteDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await locationService.deleteLocation(location.id);
      setSuccessMessage(`Location "${location.name}" (${location.code}) deleted successfully`);
      setDeleteDialogState({ isOpen: false, location: null, loading: false });
      fetchData();
    } catch (err) {
      setDeleteDialogState((prev) => ({ ...prev, loading: false }));
      // 409 Conflict when location is referenced by inventory transactions
      if (err.status === 409 || err.message?.includes('referenced') || err.message?.includes('Cannot delete')) {
        setActionError(
          err.message ||
            `This location cannot be deleted because it is referenced by existing inventory or transaction records.`
        );
      } else {
        setActionError(err.message || 'Failed to delete location.');
      }
      setDeleteDialogState({ isOpen: false, location: null, loading: false });
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

  const activeWarehouseName = useMemo(() => {
    if (!selectedWarehouseFilter) return null;
    const wh = warehouses.find((w) => String(w.id) === String(selectedWarehouseFilter));
    return wh ? `${wh.name} (${wh.code})` : null;
  }, [warehouses, selectedWarehouseFilter]);

  return (
    <div className="locations-page">
      {/* Header with Title and Add Location Button */}
      <PageHeader
        title="Warehouse Locations"
        subtitle="Manage storage zones, aisles, racks, and operational bin locations"
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
              disabled={warehouses.length === 0}
              title={warehouses.length === 0 ? 'Create a warehouse before adding locations' : 'Add new location'}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Add Location
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

      {warehouses.length === 0 && !loading && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>
            No warehouse facilities exist yet. Please{' '}
            <button
              type="button"
              onClick={() => navigate('/warehouses')}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              create a warehouse
            </button>{' '}
            before registering internal storage locations.
          </span>
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
              placeholder="Search locations by name or code..."
              width="280px"
            />

            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '180px', height: '38px', fontSize: '13px' }}
              value={selectedWarehouseFilter}
              onChange={handleWarehouseFilterChange}
            >
              <option value="">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>

            {(searchQuery || selectedWarehouseFilter) && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            )}
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredLocations.length}</strong> of <strong>{locations.length}</strong> locations
            {activeWarehouseName && (
              <span style={{ marginLeft: 6 }}>
                (filtered by <em>{activeWarehouseName}</em>)
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading warehouse locations...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Locations"
            message={error}
            onRetry={fetchData}
          />
        ) : filteredLocations.length === 0 ? (
          <EmptyState
            title={
              searchQuery || selectedWarehouseFilter
                ? 'No matching locations'
                : 'No locations configured'
            }
            description={
              searchQuery || selectedWarehouseFilter
                ? 'No locations matched the selected filter criteria. Try clearing or changing filters.'
                : 'Get started by creating your first storage zone, rack, or bin location.'
            }
            action={
              searchQuery || selectedWarehouseFilter ? (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreate}
                  disabled={warehouses.length === 0}
                >
                  + Add First Location
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Location Name</th>
                  <th>Location Code</th>
                  <th>Parent Warehouse</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLocations.map((loc) => (
                  <tr key={loc.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {loc.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ID #{loc.id}
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
                        {loc.code}
                      </code>
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWarehouseFilter(String(loc.warehouse_id));
                          setSearchParams({ warehouseId: String(loc.warehouse_id) });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                        title={`Filter locations by ${loc.warehouse_name}`}
                      >
                        <div style={{ fontWeight: 500, color: 'var(--primary)' }}>
                          {loc.warehouse_name || '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {loc.warehouse_code}
                        </div>
                      </button>
                    </td>

                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {formatDate(loc.created_at)}
                      </span>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenView(loc.id)}
                          title="View Location Details"
                        >
                          View
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(loc)}
                          title="Edit Location"
                        >
                          Edit
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(loc)}
                          style={{ color: 'var(--danger)' }}
                          title="Delete Location"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Location Modal */}
      <LocationModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, location: null, defaultWarehouseId: '' })}
        location={modalState.location}
        warehouses={warehouses}
        defaultWarehouseId={modalState.defaultWarehouseId}
        onSuccess={handleModalSuccess}
      />

      {/* Location Detail Modal */}
      <LocationDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, locationId: null })}
        locationId={detailModalState.locationId}
        onEdit={handleOpenEdit}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogState.isOpen}
        onClose={() => setDeleteDialogState({ isOpen: false, location: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Warehouse Location"
        message={`Are you sure you want to delete "${deleteDialogState.location?.name}" (${deleteDialogState.location?.code})? Locations referenced by inventory stock or operational transactions cannot be removed.`}
        confirmText="Delete Location"
        variant="danger"
        loading={deleteDialogState.loading}
      />
    </div>
  );
};

export default Locations;
