import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import receiptService from '../../services/receiptService';
import supplierService from '../../services/supplierService';
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
import ReceiptModal from '../../components/receipts/ReceiptModal';
import ReceiptDetailModal from '../../components/receipts/ReceiptDetailModal';

export const Receipts = () => {
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals state
  const [modalState, setModalState] = useState({
    isOpen: false,
    receipt: null
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    receiptId: null
  });

  const [validateDialogState, setValidateDialogState] = useState({
    isOpen: false,
    receipt: null,
    loading: false
  });

  const [cancelDialogState, setCancelDialogState] = useState({
    isOpen: false,
    receipt: null,
    loading: false
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [receiptList, supplierList, locationList, productList] = await Promise.all([
        receiptService.getReceipts(),
        supplierService.getSuppliers(),
        locationService.getLocations(),
        productService.getProducts()
      ]);
      setReceipts(receiptList);
      setSuppliers(supplierList);
      setLocations(locationList);
      setProducts(productList);
    } catch (err) {
      setError(err.message || 'Failed to retrieve receipts from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refreshSuppliers = async () => {
    try {
      const supplierList = await supplierService.getSuppliers();
      setSuppliers(supplierList);
    } catch {
      // Ignore background refresh errors
    }
  };

  // Client-side filtering
  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        r.receipt_number?.toLowerCase().includes(query) ||
        r.supplier_name?.toLowerCase().includes(query) ||
        r.location_name?.toLowerCase().includes(query) ||
        r.warehouse_name?.toLowerCase().includes(query);

      const matchesStatus = !selectedStatus || r.status === selectedStatus;
      const matchesSupplier = !selectedSupplier || String(r.supplier_id) === String(selectedSupplier);
      const matchesLocation = !selectedLocation || String(r.location_id) === String(selectedLocation);

      return matchesSearch && matchesStatus && matchesSupplier && matchesLocation;
    });
  }, [receipts, searchQuery, selectedStatus, selectedSupplier, selectedLocation]);

  const hasActiveFilters = Boolean(
    searchQuery || selectedStatus || selectedSupplier || selectedLocation
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedSupplier('');
    setSelectedLocation('');
  };

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({ isOpen: true, receipt: null });
  };

  const handleOpenEdit = (receipt) => {
    setActionError(null);
    setModalState({ isOpen: true, receipt });
  };

  const handleOpenView = (receiptId) => {
    setDetailModalState({ isOpen: true, receiptId });
  };

  const handleOpenValidate = (receipt) => {
    setActionError(null);
    setValidateDialogState({ isOpen: true, receipt, loading: false });
  };

  const handleConfirmValidate = async () => {
    const { receipt } = validateDialogState;
    if (!receipt) return;

    setValidateDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await receiptService.validateReceipt(receipt.id);
      setSuccessMessage(
        `Receipt "${receipt.receipt_number}" validated successfully! Physical stock was incremented at ${receipt.location_name}.`
      );
      setValidateDialogState({ isOpen: false, receipt: null, loading: false });
      fetchData();
    } catch (err) {
      setValidateDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 409) {
        setActionError(err.message || 'Receipt has already been validated or canceled.');
      } else {
        setActionError(err.message || 'Failed to validate receipt.');
      }
      setValidateDialogState({ isOpen: false, receipt: null, loading: false });
    }
  };

  const handleOpenCancel = (receipt) => {
    setActionError(null);
    setCancelDialogState({ isOpen: true, receipt, loading: false });
  };

  const handleConfirmCancel = async () => {
    const { receipt } = cancelDialogState;
    if (!receipt) return;

    setCancelDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await receiptService.cancelReceipt(receipt.id);
      setSuccessMessage(`Receipt "${receipt.receipt_number}" was canceled successfully.`);
      setCancelDialogState({ isOpen: false, receipt: null, loading: false });
      fetchData();
    } catch (err) {
      setCancelDialogState((prev) => ({ ...prev, loading: false }));
      if (err.status === 400 || err.status === 409) {
        setActionError(err.message || 'Receipt cannot be canceled in its current state.');
      } else {
        setActionError(err.message || 'Failed to cancel receipt.');
      }
      setCancelDialogState({ isOpen: false, receipt: null, loading: false });
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
    <div className="receipts-page">
      {/* Header */}
      <PageHeader
        title="Incoming Stock Receipts"
        subtitle="Receive incoming vendor deliveries and validate inventory arrivals into warehouse locations"
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
                  : 'Create a new incoming receipt'
              }
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Create Receipt
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
                  create a destination location
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
            before creating incoming stock receipts.
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
              placeholder="Search receipts by #, supplier, or location..."
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

            {/* Supplier Filter */}
            {suppliers.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '150px', height: '38px', fontSize: '13px' }}
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            {/* Location Filter */}
            {locations.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '13px' }}
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
            Showing <strong>{filteredReceipts.length}</strong> of <strong>{receipts.length}</strong> receipts
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading incoming stock receipts...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Receipts"
            message={error}
            onRetry={fetchData}
          />
        ) : filteredReceipts.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching receipts' : 'No receipts recorded'}
            description={
              hasActiveFilters
                ? 'No receipts matched your search and filter criteria. Try resetting filters.'
                : 'Create an incoming stock receipt to document arriving supplier shipments.'
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
                  + Create First Receipt
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt Number</th>
                  <th>Supplier</th>
                  <th>Destination Location</th>
                  <th>Line Items</th>
                  <th>Status</th>
                  <th>Created By</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((r) => {
                  const isDoneOrCanceled = r.status === 'done' || r.status === 'canceled';

                  return (
                    <tr key={r.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleOpenView(r.id)}
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
                            {r.receipt_number}
                          </code>
                        </button>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                          {r.supplier_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {r.location_name || `Location #${r.location_id}`}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {r.warehouse_name || 'Warehouse'}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {r.item_count} {Number(r.item_count) === 1 ? 'item' : 'items'}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            ({Number(r.total_quantity).toLocaleString()} units)
                          </span>
                        </div>
                      </td>

                      <td>
                        <Badge status={r.status} />
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {r.created_by_name || 'System'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {formatDate(r.created_at)}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenView(r.id)}
                            title="View Receipt Details"
                          >
                            View
                          </Button>

                          {!isDoneOrCanceled && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(r)}
                                title="Edit Receipt"
                              >
                                Edit
                              </Button>

                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenValidate(r)}
                                title="Validate & Stock Items"
                              >
                                Validate
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenCancel(r)}
                                style={{ color: 'var(--danger)' }}
                                title="Cancel Receipt"
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

      {/* Create / Edit Receipt Modal */}
      <ReceiptModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, receipt: null })}
        receipt={modalState.receipt}
        suppliers={suppliers}
        locations={locations}
        products={products}
        onSuccess={handleModalSuccess}
        onRefreshSuppliers={refreshSuppliers}
      />

      {/* Receipt Detail Modal */}
      <ReceiptDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, receiptId: null })}
        receiptId={detailModalState.receiptId}
        onEdit={handleOpenEdit}
        onValidate={handleOpenValidate}
        onCancel={handleOpenCancel}
      />

      {/* Confirm Validate Dialog */}
      <ConfirmDialog
        isOpen={validateDialogState.isOpen}
        onClose={() => setValidateDialogState({ isOpen: false, receipt: null, loading: false })}
        onConfirm={handleConfirmValidate}
        title="Validate Incoming Stock Receipt"
        message={`Validate receipt "${validateDialogState.receipt?.receipt_number}"? This will atomically increase stock quantities at destination "${validateDialogState.receipt?.location_name}" and create permanent stock ledger movement records.`}
        confirmText="Validate & Receive Stock"
        variant="primary"
        loading={validateDialogState.loading}
      />

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={cancelDialogState.isOpen}
        onClose={() => setCancelDialogState({ isOpen: false, receipt: null, loading: false })}
        onConfirm={handleConfirmCancel}
        title="Cancel Incoming Stock Receipt"
        message={`Are you sure you want to cancel receipt "${cancelDialogState.receipt?.receipt_number}"? Once canceled, this receipt cannot be validated and no inventory stock will be adjusted.`}
        confirmText="Cancel Receipt"
        variant="danger"
        loading={cancelDialogState.loading}
      />
    </div>
  );
};

export default Receipts;
