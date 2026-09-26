import React, { useState, useEffect, useCallback } from 'react';
import ledgerService from '../../services/ledgerService';
import locationService from '../../services/locationService';
import productService from '../../services/productService';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBox from '../../components/common/SearchBox';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';

const MOVEMENT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'adjustment', label: 'Adjustment' }
];

const PAGE_SIZE = 25;

const movementBadgeVariant = (type) => {
  switch (type) {
    case 'receipt': return 'success';
    case 'delivery': return 'primary';
    case 'transfer_in': return 'info';
    case 'transfer_out': return 'warning';
    case 'adjustment': return 'secondary';
    default: return 'draft';
  }
};

const movementLabel = (type) => {
  switch (type) {
    case 'receipt': return 'Receipt';
    case 'delivery': return 'Delivery';
    case 'transfer_in': return 'Transfer In';
    case 'transfer_out': return 'Transfer Out';
    case 'adjustment': return 'Adjustment';
    default: return type;
  }
};

const formatQty = (val) => {
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
};

export const MoveHistory = () => {
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState('');
  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);

  // Reference data for filters
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [refLoading, setRefLoading] = useState(true);

  // Detail modal
  const [detailEntry, setDetailEntry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Load reference data once
  useEffect(() => {
    const loadRef = async () => {
      setRefLoading(true);
      try {
        const [prods, locs] = await Promise.all([
          productService.getProducts(),
          locationService.getLocations()
        ]);
        setProducts(prods || []);
        setLocations(locs || []);
      } catch {
        // Non-critical — filters may be limited
      } finally {
        setRefLoading(false);
      }
    };
    loadRef();
  }, []);

  const fetchEntries = useCallback(async (currentPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: PAGE_SIZE
      };
      if (search.trim()) params.search = search.trim();
      if (movementType) params.movement_type = movementType;
      if (productId) params.product_id = productId;
      if (locationId) params.location_id = locationId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const { entries: rows, pagination: pag } = await ledgerService.getLedgerEntries(params);
      setEntries(rows);
      setPagination(pag);
    } catch (err) {
      setError(err.message || 'Failed to load stock ledger from server.');
    } finally {
      setLoading(false);
    }
  }, [search, movementType, productId, locationId, startDate, endDate]);

  useEffect(() => {
    setPage(1);
    fetchEntries(1);
  }, [search, movementType, productId, locationId, startDate, endDate]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchEntries(newPage);
  };

  const handleRefresh = () => {
    fetchEntries(page);
  };

  const handleResetFilters = () => {
    setSearch('');
    setMovementType('');
    setProductId('');
    setLocationId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const handleViewDetail = async (entry) => {
    setDetailLoading(true);
    setDetailEntry(entry);
    try {
      const full = await ledgerService.getLedgerEntry(entry.id);
      setDetailEntry(full || entry);
    } catch {
      // Use list-level data if fetch fails
    } finally {
      setDetailLoading(false);
    }
  };

  const hasActiveFilters = !!(search || movementType || productId || locationId || startDate || endDate);

  const totalPages = pagination ? Math.ceil(pagination.total / PAGE_SIZE) : 1;

  return (
    <div className="move-history-page">
      <PageHeader
        title="Move History — Stock Ledger"
        subtitle="Read-only authoritative history of all inventory movements. No frontend data is modified here."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Refresh
            </Button>
          </>
        }
      />

      <Card>
        {/* Filters Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)', alignItems: 'center' }}>
          <SearchBox
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search product, SKU, location..."
            width="240px"
          />

          <select
            className="form-select"
            style={{ height: '38px', fontSize: '13px', minWidth: '140px' }}
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
          >
            {MOVEMENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          {!refLoading && products.length > 0 && (
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px', minWidth: '150px' }}
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
              ))}
            </select>
          )}

          {!refLoading && locations.length > 0 && (
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px', minWidth: '150px' }}
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">All Locations</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>From:</label>
            <input
              type="date"
              className="form-input"
              style={{ height: '38px', fontSize: '13px', padding: '0 8px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To:</label>
            <input
              type="date"
              className="form-input"
              style={{ height: '38px', fontSize: '13px', padding: '0 8px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {pagination ? (
              <>Total: <strong>{Number(pagination.total).toLocaleString()}</strong> movements</>
            ) : null}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading inventory movements...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Stock Ledger"
            message={error}
            onRetry={handleRefresh}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'No matching movements' : 'No inventory movements found'}
            description={
              hasActiveFilters
                ? 'No ledger entries matched your filters. Try resetting them.'
                : 'Inventory movements will appear here after receipts, deliveries, transfers, or adjustments are validated.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Clear Filters
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Location</th>
                    <th>Movement Type</th>
                    <th>Reference</th>
                    <th style={{ textAlign: 'right' }}>Qty Change</th>
                    <th style={{ textAlign: 'right' }}>Balance After</th>
                    <th>Created By</th>
                    <th style={{ textAlign: 'right' }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const qtyChange = Number(entry.quantity_change);
                    const isPositive = qtyChange > 0;
                    const isNegative = qtyChange < 0;
                    return (
                      <tr key={entry.id}>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(entry.created_at)}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {entry.product_name || '—'}
                          </div>
                          {entry.warehouse_name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entry.warehouse_name}</div>
                          )}
                        </td>
                        <td>
                          <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                            {entry.sku || '—'}
                          </code>
                        </td>
                        <td>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            {entry.location_name || '—'}
                          </span>
                        </td>
                        <td>
                          <Badge variant={movementBadgeVariant(entry.movement_type)}>
                            {movementLabel(entry.movement_type)}
                          </Badge>
                        </td>
                        <td>
                          {entry.reference_number ? (
                            <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--primary)' }}>
                              {entry.reference_number}
                            </code>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            fontWeight: 700,
                            fontSize: '13px',
                            color: isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--text-secondary)'
                          }}>
                            {isPositive ? '+' : ''}{formatQty(entry.quantity_change)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                            {formatQty(entry.balance_after)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {entry.created_by_name || 'System'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetail(entry)}
                            title="View movement details"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> &nbsp;·&nbsp; {Number(pagination.total).toLocaleString()} total records
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1 || loading}
                  >
                    ← Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages || loading}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailEntry}
        onClose={() => setDetailEntry(null)}
        title="Ledger Movement Detail"
        maxWidth="600px"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <Spinner size="md" color="var(--primary)" />
          </div>
        ) : detailEntry ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: 'Movement Type', value: <Badge variant={movementBadgeVariant(detailEntry.movement_type)}>{movementLabel(detailEntry.movement_type)}</Badge> },
                { label: 'Date / Time', value: formatDateTime(detailEntry.created_at) },
                { label: 'Product', value: detailEntry.product_name || '—' },
                { label: 'SKU', value: <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>{detailEntry.sku || '—'}</code> },
                { label: 'Location', value: detailEntry.location_name || '—' },
                { label: 'Warehouse', value: detailEntry.warehouse_name || '—' },
                { label: 'Reference', value: detailEntry.reference_number ? <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: 'var(--primary)' }}>{detailEntry.reference_number}</code> : '—' },
                { label: 'Created By', value: detailEntry.created_by_name || 'System' }
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '14px 16px', borderRadius: '8px', backgroundColor: Number(detailEntry.quantity_change) >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${Number(detailEntry.quantity_change) >= 0 ? '#bbf7d0' : '#fecaca'}` }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Quantity Change</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: Number(detailEntry.quantity_change) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {Number(detailEntry.quantity_change) > 0 ? '+' : ''}{formatQty(detailEntry.quantity_change)}
                </div>
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Balance After</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatQty(detailEntry.balance_after)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Ledger Entry #{detailEntry.id}</span>
              <span>·</span>
              <span>This record is read-only and authoritative.</span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default MoveHistory;
