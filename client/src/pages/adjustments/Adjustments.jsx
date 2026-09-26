import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import adjustmentService from '../../services/adjustmentService';
import locationService from '../../services/locationService';
import productService from '../../services/productService';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBox from '../../components/common/SearchBox';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AdjustmentModal from '../../components/adjustments/AdjustmentModal';
import AdjustmentDetailModal from '../../components/adjustments/AdjustmentDetailModal';

export const Adjustments = () => {
  const navigate = useNavigate();

  const [adjustments, setAdjustments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals state
  const [modalState, setModalState] = useState({
    isOpen: false,
    adjustment: null
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    adjustmentId: null
  });

  const [validateDialogState, setValidateDialogState] = useState({
    isOpen: false,
    adjustment: null,
    loading: false
  });

  const [cancelDialogState, setCancelDialogState] = useState({
    isOpen: false,
    adjustment: null,
    loading: false
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [adjustmentList, locationList, productList] = await Promise.all([
        adjustmentService.getAdjustments(),
        locationService.getLocations(),
        productService.getProducts()
      ]);
      setAdjustments(adjustmentList);
      setLocations(locationList);
      setProducts(productList);
    } catch (err) {
      setError(err.message || 'Failed to retrieve adjustments from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Client-side filtering
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((a) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        a.adjustment_number?.toLowerCase().includes(query) ||
        a.reason?.toLowerCase().includes(query) ||
        a.location_name?.toLowerCase().includes(query) ||
        a.warehouse_name?.toLowerCase().includes(query);

      const matchesStatus = !selectedStatus || a.status === selectedStatus;
      const matchesLocation =
        !selectedLocation || String(a.location_id) === String(selectedLocation);

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [adjustments, searchQuery, selectedStatus, selectedLocation]);

  const hasActiveFilters = Boolean(searchQuery || selectedStatus || selectedLocation);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedLocation('');
  };

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({ isOpen: true, adjustment: null });
  };

  const handleOpenEdit = (adjustment) => {
    setActionError(null);
    setModalState({ isOpen: true, adjustment });
  };

  const handleOpenView = (adjustmentId) => {
    setDetailModalState({ isOpen: true, adjustmentId });
  };

  const handleOpenValidate = (adjustment) => {
    setActionError(null);
    setValidateDialogState({ isOpen: true, adjustment, loading: false });
  };

  const handleConfirmValidate = async () => {
    const { adjustment } = validateDialogState;
    if (!adjustment) return;

    setValidateDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await adjustmentService.validateAdjustment(adjustment.id);
      setSuccessMessage(
        `Adjustment "${adjustment.adjustment_number}" validated successfully! Physical stock at ${adjustment.location_name} was reconciled.`
      );
      setValidateDialogState({ isOpen: false, adjustment: null, loading: false });
      fetchData();
    } catch (err) {
      setValidateDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 409) {
        setActionError(err.message || 'Adjustment has already been validated or canceled.');
      } else {
        setActionError(err.message || 'Failed to validate inventory adjustment.');
      }
      setValidateDialogState({ isOpen: false, adjustment: null, loading: false });
    }
  };

  const handleOpenCancel = (adjustment) => {
    setActionError(null);
    setCancelDialogState({ isOpen: true, adjustment, loading: false });
  };

  const handleConfirmCancel = async () => {
    const { adjustment } = cancelDialogState;
    if (!adjustment) return;

    setCancelDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await adjustmentService.cancelAdjustment(adjustment.id);
      setSuccessMessage(`Adjustment "${adjustment.adjustment_number}" was canceled successfully.`);
      setCancelDialogState({ isOpen: false, adjustment: null, loading: false });
      fetchData();
    } catch (err) {
      setCancelDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 400 || err.status === 409) {
        setActionError(err.message || 'Adjustment cannot be canceled in its current state.');
      } else {
        setActionError(err.message || 'Failed to cancel inventory adjustment.');
      }
      setCancelDialogState({ isOpen: false, adjustment: null, loading: false });
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
    <div className="adjustments-page">
      {/* Header */}
      <PageHeader
        title="Inventory Adjustments"
        subtitle="Reconcile physical stock counts with recorded system balances"
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
              disabled={locations.length === 0 || products.length === 0}
              title={
                locations.length === 0
                  ? 'Please configure at least one warehouse location first'
                  : products.length === 0
                  ? 'Please register products in the catalog first'
                  : 'Create a new inventory adjustment'
              }
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Create Adjustment
            </Button>
          </>
        }
      />

      {/* Notifications */}
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

      {/* Warning when prerequisite data is missing */}
      {!loading && (locations.length === 0 || products.length === 0) && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>
            Notice:{' '}
            {locations.length === 0 && (
              <>
                You must{' '}
                <button
                  type="button"
                  onClick={() => navigate('/locations')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    textDecoration: 'underline',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  create a warehouse storage location
                </button>{' '}
              </>
            )}
            {locations.length === 0 && products.length === 0 && 'and '}
            {products.length === 0 && (
              <>
                You must{' '}
                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    textDecoration: 'underline',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  add products to the catalog
                </button>{' '}
              </>
            )}
            before performing inventory stock adjustments.
          </span>
        </div>
      )}

      {/* Main Table Card */}
      <Card>
        {/* Toolbar & Filters */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <SearchBox
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search adjustments by #, reason, or location..."
              width="280px"
            />

            {/* Status Filter */}
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: '130px', height: '38px', fontSize: '13px' }}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>

            {/* Location Filter */}
            {locations.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '170px', height: '38px', fontSize: '13px' }}
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="">All Locations</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                Reset Filters
              </Button>
            )}
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredAdjustments.length}</strong> of <strong>{adjustments.length}</strong> adjustments
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading inventory adjustments...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Adjustments"
            message={error}
            onRetry={fetchData}
          />
        ) : filteredAdjustments.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching adjustments' : 'No inventory adjustments recorded'}
            description={
              hasActiveFilters
                ? 'No adjustments matched your search and filter criteria. Try resetting filters.'
                : 'Create an inventory adjustment to reconcile physical stock counts with system records.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear Filters
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenCreate}
                  disabled={locations.length === 0 || products.length === 0}
                >
                  + Create First Adjustment
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Adjustment Number</th>
                  <th>Location</th>
                  <th>Reason</th>
                  <th>Items / Net Difference</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdjustments.map((a) => {
                  const isDoneOrCanceled = a.status === 'done' || a.status === 'canceled';
                  const totalDiff = Number(a.total_difference || 0);

                  return (
                    <tr key={a.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenView(a.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <code
                            style={{
                              backgroundColor: '#f1f5f9',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: 'var(--primary)'
                            }}
                          >
                            {a.adjustment_number}
                          </code>
                        </button>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {a.location_name || `Location #${a.location_id}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {a.warehouse_name || 'Warehouse'}
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {a.reason || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {a.item_count} {Number(a.item_count) === 1 ? 'item' : 'items'}
                          </span>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: totalDiff > 0 ? '#166534' : totalDiff < 0 ? '#991b1b' : 'var(--text-muted)'
                            }}
                          >
                            ({totalDiff > 0 ? `+${totalDiff}` : totalDiff} net)
                          </span>
                        </div>
                      </td>

                      <td>
                        <Badge status={a.status} />
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {a.created_by_name || 'System'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {formatDate(a.created_at)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenView(a.id)}
                            title="View Adjustment Details"
                          >
                            View
                          </Button>

                          {!isDoneOrCanceled && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(a)}
                                title="Edit Adjustment Draft"
                              >
                                Edit
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenValidate(a)}
                                title="Validate & Reconcile Stock"
                              >
                                Validate
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenCancel(a)}
                                style={{ color: 'var(--danger)' }}
                                title="Cancel Adjustment"
                              >
                                Cancel
                              </Button>
                            </>
                          )}
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

      {/* Create / Edit Adjustment Modal */}
      <AdjustmentModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, adjustment: null })}
        adjustment={modalState.adjustment}
        locations={locations}
        products={products}
        onSuccess={handleModalSuccess}
      />

      {/* Adjustment Detail Modal */}
      <AdjustmentDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, adjustmentId: null })}
        adjustmentId={detailModalState.adjustmentId}
        onEdit={handleOpenEdit}
        onValidate={handleOpenValidate}
        onCancel={handleOpenCancel}
      />

      {/* Confirm Validate Dialog */}
      <ConfirmDialog
        isOpen={validateDialogState.isOpen}
        onClose={() => setValidateDialogState({ isOpen: false, adjustment: null, loading: false })}
        onConfirm={handleConfirmValidate}
        title="Validate Inventory Adjustment"
        message={`Validate adjustment "${validateDialogState.adjustment?.adjustment_number}"? Validation will update stock at location "${validateDialogState.adjustment?.location_name}" to the counted quantities and create stock ledger entries for non-zero differences.`}
        confirmText="Validate & Update Stock"
        variant="primary"
        loading={validateDialogState.loading}
      />

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogState.isOpen}
        onClose={() => setCancelDialogState({ isOpen: false, adjustment: null, loading: false })}
        onConfirm={handleConfirmCancel}
        title="Cancel Inventory Adjustment"
        message={`Are you sure you want to cancel adjustment "${cancelDialogState.adjustment?.adjustment_number}"? Canceled adjustments cannot be validated or edited.`}
        confirmText="Cancel Adjustment"
        variant="danger"
        loading={cancelDialogState.loading}
      />
    </div>
  );
};

export default Adjustments;
