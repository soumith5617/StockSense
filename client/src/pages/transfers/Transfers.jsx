import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import transferService from '../../services/transferService';
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
import TransferModal from '../../components/transfers/TransferModal';
import TransferDetailModal from '../../components/transfers/TransferDetailModal';

export const Transfers = () => {
  const navigate = useNavigate();

  const [transfers, setTransfers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSourceLocation, setSelectedSourceLocation] = useState('');
  const [selectedDestinationLocation, setSelectedDestinationLocation] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals state
  const [modalState, setModalState] = useState({
    isOpen: false,
    transfer: null
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    transferId: null
  });

  const [validateDialogState, setValidateDialogState] = useState({
    isOpen: false,
    transfer: null,
    loading: false
  });

  const [cancelDialogState, setCancelDialogState] = useState({
    isOpen: false,
    transfer: null,
    loading: false
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transferList, locationList, productList] = await Promise.all([
        transferService.getTransfers(),
        locationService.getLocations(),
        productService.getProducts()
      ]);
      setTransfers(transferList);
      setLocations(locationList);
      setProducts(productList);
    } catch (err) {
      setError(err.message || 'Failed to retrieve transfer orders from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Client-side filtering
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        t.transfer_number?.toLowerCase().includes(query) ||
        t.source_location_name?.toLowerCase().includes(query) ||
        t.source_warehouse_name?.toLowerCase().includes(query) ||
        t.destination_location_name?.toLowerCase().includes(query) ||
        t.destination_warehouse_name?.toLowerCase().includes(query);

      const matchesStatus = !selectedStatus || t.status === selectedStatus;
      const matchesSource =
        !selectedSourceLocation || String(t.source_location_id) === String(selectedSourceLocation);
      const matchesDest =
        !selectedDestinationLocation ||
        String(t.destination_location_id) === String(selectedDestinationLocation);

      return matchesSearch && matchesStatus && matchesSource && matchesDest;
    });
  }, [transfers, searchQuery, selectedStatus, selectedSourceLocation, selectedDestinationLocation]);

  const hasActiveFilters = Boolean(
    searchQuery || selectedStatus || selectedSourceLocation || selectedDestinationLocation
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedSourceLocation('');
    setSelectedDestinationLocation('');
  };

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({ isOpen: true, transfer: null });
  };

  const handleOpenEdit = (transfer) => {
    setActionError(null);
    setModalState({ isOpen: true, transfer });
  };

  const handleOpenView = (transferId) => {
    setDetailModalState({ isOpen: true, transferId });
  };

  const handleOpenValidate = (transfer) => {
    setActionError(null);
    setValidateDialogState({ isOpen: true, transfer, loading: false });
  };

  const handleConfirmValidate = async () => {
    const { transfer } = validateDialogState;
    if (!transfer) return;

    setValidateDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await transferService.validateTransfer(transfer.id);
      setSuccessMessage(
        `Transfer "${transfer.transfer_number}" validated successfully! Physical stock was moved from ${transfer.source_location_name} to ${transfer.destination_location_name}.`
      );
      setValidateDialogState({ isOpen: false, transfer: null, loading: false });
      fetchData();
    } catch (err) {
      setValidateDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 409) {
        if (err.message?.toLowerCase().includes('insufficient stock')) {
          setActionError(
            `Transfer cannot be validated because there is insufficient stock at the source location (${transfer.source_location_name}): ${err.message}`
          );
        } else {
          setActionError(err.message || 'Transfer has already been validated or canceled.');
        }
      } else {
        setActionError(err.message || 'Failed to validate transfer order.');
      }
      setValidateDialogState({ isOpen: false, transfer: null, loading: false });
    }
  };

  const handleOpenCancel = (transfer) => {
    setActionError(null);
    setCancelDialogState({ isOpen: true, transfer, loading: false });
  };

  const handleConfirmCancel = async () => {
    const { transfer } = cancelDialogState;
    if (!transfer) return;

    setCancelDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await transferService.cancelTransfer(transfer.id);
      setSuccessMessage(`Transfer "${transfer.transfer_number}" was canceled successfully.`);
      setCancelDialogState({ isOpen: false, transfer: null, loading: false });
      fetchData();
    } catch (err) {
      setCancelDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 400 || err.status === 409) {
        setActionError(err.message || 'Transfer cannot be canceled in its current state.');
      } else {
        setActionError(err.message || 'Failed to cancel transfer order.');
      }
      setCancelDialogState({ isOpen: false, transfer: null, loading: false });
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
    <div className="transfers-page">
      {/* Header */}
      <PageHeader
        title="Internal Transfers"
        subtitle="Move inventory atomically between internal warehouse locations and bins"
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
              disabled={locations.length < 2 || products.length === 0}
              title={
                locations.length < 2
                  ? 'Please configure at least two warehouse locations first'
                  : products.length === 0
                  ? 'Please register products in the catalog first'
                  : 'Create a new internal stock transfer'
              }
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Create Transfer
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
      {!loading && (locations.length < 2 || products.length === 0) && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>
            Notice:{' '}
            {locations.length < 2 && (
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
                  create at least two warehouse locations
                </button>{' '}
              </>
            )}
            {locations.length < 2 && products.length === 0 && 'and '}
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
            before creating internal stock transfers.
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
              placeholder="Search transfers by # or location..."
              width="270px"
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
              <option value="waiting">Waiting</option>
              <option value="ready">Ready</option>
              <option value="done">Done</option>
              <option value="canceled">Canceled</option>
            </select>

            {/* Source Location Filter */}
            {locations.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '13px' }}
                value={selectedSourceLocation}
                onChange={(e) => setSelectedSourceLocation(e.target.value)}
              >
                <option value="">All Source Locations</option>
                {locations.map((loc) => (
                  <option key={`src-${loc.id}`} value={loc.id}>
                    FROM: {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            )}

            {/* Destination Location Filter */}
            {locations.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '13px' }}
                value={selectedDestinationLocation}
                onChange={(e) => setSelectedDestinationLocation(e.target.value)}
              >
                <option value="">All Destination Locations</option>
                {locations.map((loc) => (
                  <option key={`dest-${loc.id}`} value={loc.id}>
                    TO: {loc.name} ({loc.code})
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
            Showing <strong>{filteredTransfers.length}</strong> of <strong>{transfers.length}</strong> transfers
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading internal transfers...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Transfers"
            message={error}
            onRetry={fetchData}
          />
        ) : filteredTransfers.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching transfers' : 'No internal transfers recorded'}
            description={
              hasActiveFilters
                ? 'No transfers matched your search and filter criteria. Try resetting filters.'
                : 'Create an internal transfer to move stock between warehouses or storage bins.'
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
                  disabled={locations.length < 2 || products.length === 0}
                >
                  + Create First Transfer
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transfer Number</th>
                  <th>Source Location</th>
                  <th>Destination Location</th>
                  <th>Line Items</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransfers.map((t) => {
                  const isDoneOrCanceled = t.status === 'done' || t.status === 'canceled';

                  return (
                    <tr key={t.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenView(t.id)}
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
                            {t.transfer_number}
                          </code>
                        </button>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {t.source_location_name || `Location #${t.source_location_id}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.source_warehouse_name || 'Warehouse'}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {t.destination_location_name || `Location #${t.destination_location_id}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.destination_warehouse_name || 'Warehouse'}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {t.item_count} {Number(t.item_count) === 1 ? 'item' : 'items'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({Number(t.total_quantity).toLocaleString()} units)
                          </span>
                        </div>
                      </td>

                      <td>
                        <Badge status={t.status} />
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {t.created_by_name || 'System'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {formatDate(t.created_at)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenView(t.id)}
                            title="View Transfer Details"
                          >
                            View
                          </Button>

                          {!isDoneOrCanceled && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(t)}
                                title="Edit Transfer Order"
                              >
                                Edit
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenValidate(t)}
                                title="Validate & Transfer Stock"
                              >
                                Validate
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenCancel(t)}
                                style={{ color: 'var(--danger)' }}
                                title="Cancel Transfer Order"
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

      {/* Create / Edit Transfer Modal */}
      <TransferModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, transfer: null })}
        transfer={modalState.transfer}
        locations={locations}
        products={products}
        onSuccess={handleModalSuccess}
      />

      {/* Transfer Detail Modal */}
      <TransferDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, transferId: null })}
        transferId={detailModalState.transferId}
        onEdit={handleOpenEdit}
        onValidate={handleOpenValidate}
        onCancel={handleOpenCancel}
      />

      {/* Confirm Validate Dialog */}
      <ConfirmDialog
        isOpen={validateDialogState.isOpen}
        onClose={() => setValidateDialogState({ isOpen: false, transfer: null, loading: false })}
        onConfirm={handleConfirmValidate}
        title="Validate Internal Transfer"
        message={`Validate transfer "${validateDialogState.transfer?.transfer_number}"? Validating this transfer will move the requested quantities from the source location (${validateDialogState.transfer?.source_location_name}) to the destination location (${validateDialogState.transfer?.destination_location_name}) and create stock ledger entries.`}
        confirmText="Validate & Transfer Stock"
        variant="primary"
        loading={validateDialogState.loading}
      />

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogState.isOpen}
        onClose={() => setCancelDialogState({ isOpen: false, transfer: null, loading: false })}
        onConfirm={handleConfirmCancel}
        title="Cancel Internal Transfer"
        message={`Are you sure you want to cancel internal transfer "${cancelDialogState.transfer?.transfer_number}"? Canceled transfers cannot be validated and no inventory stock will be moved.`}
        confirmText="Cancel Transfer"
        variant="danger"
        loading={cancelDialogState.loading}
      />
    </div>
  );
};

export default Transfers;
