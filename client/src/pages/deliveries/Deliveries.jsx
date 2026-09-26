import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import deliveryService from '../../services/deliveryService';
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
import DeliveryModal from '../../components/deliveries/DeliveryModal';
import DeliveryDetailModal from '../../components/deliveries/DeliveryDetailModal';

export const Deliveries = () => {
  const navigate = useNavigate();

  const [deliveries, setDeliveries] = useState([]);
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
    delivery: null
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    deliveryId: null
  });

  const [validateDialogState, setValidateDialogState] = useState({
    isOpen: false,
    delivery: null,
    loading: false
  });

  const [cancelDialogState, setCancelDialogState] = useState({
    isOpen: false,
    delivery: null,
    loading: false
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [deliveryList, locationList, productList] = await Promise.all([
        deliveryService.getDeliveries(),
        locationService.getLocations(),
        productService.getProducts()
      ]);
      setDeliveries(deliveryList);
      setLocations(locationList);
      setProducts(productList);
    } catch (err) {
      setError(err.message || 'Failed to retrieve delivery orders from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Client-side filtering
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        d.delivery_number?.toLowerCase().includes(query) ||
        d.customer_name?.toLowerCase().includes(query) ||
        d.location_name?.toLowerCase().includes(query) ||
        d.warehouse_name?.toLowerCase().includes(query);

      const matchesStatus = !selectedStatus || d.status === selectedStatus;
      const matchesLocation = !selectedLocation || String(d.location_id) === String(selectedLocation);

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [deliveries, searchQuery, selectedStatus, selectedLocation]);

  const hasActiveFilters = Boolean(searchQuery || selectedStatus || selectedLocation);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedLocation('');
  };

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({ isOpen: true, delivery: null });
  };

  const handleOpenEdit = (delivery) => {
    setActionError(null);
    setModalState({ isOpen: true, delivery });
  };

  const handleOpenView = (deliveryId) => {
    setDetailModalState({ isOpen: true, deliveryId });
  };

  const handleOpenValidate = (delivery) => {
    setActionError(null);
    setValidateDialogState({ isOpen: true, delivery, loading: false });
  };

  const handleConfirmValidate = async () => {
    const { delivery } = validateDialogState;
    if (!delivery) return;

    setValidateDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await deliveryService.validateDelivery(delivery.id);
      setSuccessMessage(
        `Delivery "${delivery.delivery_number}" validated successfully! Physical stock was deducted from ${delivery.location_name}.`
      );
      setValidateDialogState({ isOpen: false, delivery: null, loading: false });
      fetchData();
    } catch (err) {
      setValidateDialogState((prev) => ({ ...prev, loading: false }));
      // Check for 409 Conflict: Insufficient stock
      if (err.status === 409) {
        if (err.message?.toLowerCase().includes('insufficient stock')) {
          setActionError(
            `Delivery validation failed: ${err.message}. Please check source location stock or adjust quantities.`
          );
        } else {
          setActionError(err.message || 'Delivery has already been validated or canceled.');
        }
      } else {
        setActionError(err.message || 'Failed to validate delivery order.');
      }
      setValidateDialogState({ isOpen: false, delivery: null, loading: false });
    }
  };

  const handleOpenCancel = (delivery) => {
    setActionError(null);
    setCancelDialogState({ isOpen: true, delivery, loading: false });
  };

  const handleConfirmCancel = async () => {
    const { delivery } = cancelDialogState;
    if (!delivery) return;

    setCancelDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await deliveryService.cancelDelivery(delivery.id);
      setSuccessMessage(`Delivery "${delivery.delivery_number}" was canceled successfully.`);
      setCancelDialogState({ isOpen: false, delivery: null, loading: false });
      fetchData();
    } catch (err) {
      setCancelDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 400 || err.status === 409) {
        setActionError(err.message || 'Delivery cannot be canceled in its current state.');
      } else {
        setActionError(err.message || 'Failed to cancel delivery order.');
      }
      setCancelDialogState({ isOpen: false, delivery: null, loading: false });
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
    <div className="deliveries-page">
      {/* Header */}
      <PageHeader
        title="Delivery Orders"
        subtitle="Manage customer shipments, dispatch pick orders, and validate outgoing stock movements"
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
                  : 'Create a new outgoing delivery order'
              }
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Create Delivery
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
                  create a departure location
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
            before creating outgoing delivery orders.
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
              placeholder="Search deliveries by #, customer, or location..."
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
              <option value="waiting">Waiting</option>
              <option value="ready">Ready</option>
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
                <option value="">All Departure Locations</option>
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
            Showing <strong>{filteredDeliveries.length}</strong> of <strong>{deliveries.length}</strong> delivery orders
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading delivery orders...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Deliveries"
            message={error}
            onRetry={fetchData}
          />
        ) : filteredDeliveries.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching deliveries' : 'No delivery orders recorded'}
            description={
              hasActiveFilters
                ? 'No deliveries matched your search and filter criteria. Try resetting filters.'
                : 'Create an outgoing delivery order to dispatch inventory to customers or transfer hubs.'
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
                  + Create First Delivery
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Delivery Number</th>
                  <th>Customer / Recipient</th>
                  <th>Source Location</th>
                  <th>Line Items</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((d) => {
                  const isDoneOrCanceled = d.status === 'done' || d.status === 'canceled';

                  return (
                    <tr key={d.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenView(d.id)}
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
                            {d.delivery_number}
                          </code>
                        </button>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {d.customer_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {d.location_name || `Location #${d.location_id}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {d.warehouse_name || 'Warehouse'}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {d.item_count} {Number(d.item_count) === 1 ? 'item' : 'items'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({Number(d.total_quantity).toLocaleString()} units)
                          </span>
                        </div>
                      </td>

                      <td>
                        <Badge status={d.status} />
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {d.created_by_name || 'System'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {formatDate(d.created_at)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenView(d.id)}
                            title="View Delivery Details"
                          >
                            View
                          </Button>

                          {!isDoneOrCanceled && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(d)}
                                title="Edit Delivery Order"
                              >
                                Edit
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenValidate(d)}
                                title="Validate & Dispatch Stock"
                              >
                                Validate
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenCancel(d)}
                                style={{ color: 'var(--danger)' }}
                                title="Cancel Delivery Order"
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

      {/* Create / Edit Delivery Modal */}
      <DeliveryModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, delivery: null })}
        delivery={modalState.delivery}
        locations={locations}
        products={products}
        onSuccess={handleModalSuccess}
      />

      {/* Delivery Detail Modal */}
      <DeliveryDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, deliveryId: null })}
        deliveryId={detailModalState.deliveryId}
        onEdit={handleOpenEdit}
        onValidate={handleOpenValidate}
        onCancel={handleOpenCancel}
      />

      {/* Confirm Validate Dialog */}
      <ConfirmDialog
        isOpen={validateDialogState.isOpen}
        onClose={() => setValidateDialogState({ isOpen: false, delivery: null, loading: false })}
        onConfirm={handleConfirmValidate}
        title="Validate Outgoing Delivery Order"
        message={`Validate delivery "${validateDialogState.delivery?.delivery_number}"? This will atomically verify stock availability and deduct the requested quantities from source "${validateDialogState.delivery?.location_name}", creating permanent stock ledger records.`}
        confirmText="Validate & Dispatch Stock"
        variant="primary"
        loading={validateDialogState.loading}
      />

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogState.isOpen}
        onClose={() => setCancelDialogState({ isOpen: false, delivery: null, loading: false })}
        onConfirm={handleConfirmCancel}
        title="Cancel Delivery Order"
        message={`Are you sure you want to cancel delivery "${cancelDialogState.delivery?.delivery_number}"? Once canceled, this delivery cannot be validated and no inventory stock will be deducted.`}
        confirmText="Cancel Order"
        variant="danger"
        loading={cancelDialogState.loading}
      />
    </div>
  );
};

export default Deliveries;
