import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

const formatQty = (val) => {
  const n = Number(val);
  if (isNaN(n)) return '—';
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
};

const formatDateTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
};

const movementLabel = (type) => {
  const map = {
    receipt: 'Receipt', delivery: 'Delivery',
    transfer_in: 'Transfer In', transfer_out: 'Transfer Out',
    adjustment: 'Adjustment'
  };
  return map[type] || type;
};

const movementColor = (type) => {
  const map = {
    receipt: 'var(--success)',
    delivery: 'var(--primary)',
    transfer_in: '#0891b2',
    transfer_out: '#d97706',
    adjustment: '#7c3aed'
  };
  return map[type] || 'var(--text-secondary)';
};

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summary, activity, lowStock] = await Promise.all([
        dashboardService.getSummary(),
        dashboardService.getRecentActivity(8),
        dashboardService.getLowStockProducts(6)
      ]);
      setMetrics(summary);
      setRecentActivity(activity);
      setLowStockProducts(lowStock);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <Spinner size="lg" color="var(--primary)" />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
          Loading real-time inventory data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Dashboard Sync Failed"
        message={error}
        onRetry={fetchDashboardData}
      />
    );
  }

  const kpis = [
    {
      label: 'Total Products',
      value: metrics?.totalProducts ?? 0,
      subtext: 'Active SKUs in master catalog',
      iconColor: { bg: '#eff6ff', fg: '#2563eb' },
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      link: '/products'
    },
    {
      label: 'Low Stock Items',
      value: metrics?.lowStockItems ?? 0,
      subtext: 'Stock ≤ reorder level (but > 0)',
      iconColor: { bg: 'var(--warning-light)', fg: 'var(--warning)' },
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      link: '/products',
      highlight: (metrics?.lowStockItems ?? 0) > 0 ? 'warning' : null
    },
    {
      label: 'Out of Stock',
      value: metrics?.outOfStockItems ?? 0,
      subtext: 'Products with zero inventory',
      iconColor: { bg: '#fef2f2', fg: 'var(--danger)' },
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
      link: '/products',
      highlight: (metrics?.outOfStockItems ?? 0) > 0 ? 'danger' : null
    },
    {
      label: 'Pending Receipts',
      value: metrics?.pendingReceipts ?? 0,
      subtext: 'Incoming stock awaiting validation',
      iconColor: { bg: '#f0fdf4', fg: '#16a34a' },
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
      link: '/operations/receipts'
    },
    {
      label: 'Pending Deliveries',
      value: metrics?.pendingDeliveries ?? 0,
      subtext: 'Outgoing shipments in progress',
      iconColor: { bg: '#eff6ff', fg: '#2563eb' },
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      ),
      link: '/operations/deliveries'
    },
    {
      label: 'Transfers Scheduled',
      value: metrics?.scheduledTransfers ?? 0,
      subtext: 'Inter-location movements pending',
      iconColor: { bg: '#faf5ff', fg: '#9333ea' },
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      link: '/operations/transfers'
    }
  ];

  return (
    <div className="dashboard-page">
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Inventory Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Real-time KPIs computed from authoritative backend data
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchDashboardData}
          disabled={loading}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          Refresh
        </Button>
      </div>

      {/* 6 KPI Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.link} style={{ textDecoration: 'none' }}>
            <div className="kpi-card" style={{
              borderLeft: kpi.highlight === 'danger' ? '3px solid var(--danger)' :
                kpi.highlight === 'warning' ? '3px solid var(--warning)' : undefined,
              cursor: 'pointer'
            }}>
              <div className="kpi-icon-wrap" style={{ backgroundColor: kpi.iconColor.bg, color: kpi.iconColor.fg }}>
                {kpi.icon}
              </div>
              <span className="kpi-label">{kpi.label}</span>
              <span className="kpi-value" style={{
                color: kpi.highlight === 'danger' ? 'var(--danger)' :
                  kpi.highlight === 'warning' ? 'var(--warning)' : undefined
              }}>
                {kpi.value}
              </span>
              <span className="kpi-subtext">{kpi.subtext}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Two-column section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginTop: '24px' }}>

        {/* Quick Actions */}
        <Card title="Quick Actions" subtitle="Initiate common inventory operations">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {[
              { label: 'New Receipt', to: '/operations/receipts', color: 'var(--success)', emoji: '📥' },
              { label: 'New Delivery', to: '/operations/deliveries', color: 'var(--primary)', emoji: '📤' },
              { label: 'Transfer Stock', to: '/operations/transfers', color: '#9333ea', emoji: '🔄' },
              { label: 'Adjust Stock', to: '/operations/adjustments', color: 'var(--warning)', emoji: '⚖️' }
            ].map(({ label, to, color, emoji }) => (
              <Link
                key={to}
                to={to}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px', textDecoration: 'none', gap: '8px' }}
              >
                <span style={{ color }}>{emoji}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>View full ledger history</span>
            <Link to="/operations/history" className="btn btn-outline btn-sm">
              Move History →
            </Link>
          </div>
        </Card>

        {/* Low Stock / Out of Stock Widget */}
        <Card
          title="Stock Alerts"
          subtitle="Products below reorder level or out of stock"
          headerActions={
            <Link to="/products" style={{ fontSize: '12px', fontWeight: 600 }}>View All</Link>
          }
        >
          {lowStockProducts.length === 0 ? (
            <EmptyState
              title="All Stock Healthy"
              description="No products are below their reorder level. Great job!"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {lowStockProducts.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: `3px solid ${p.status === 'out_of_stock' ? 'var(--danger)' : 'var(--warning)'}`,
                    backgroundColor: p.status === 'out_of_stock' ? '#fff5f5' : '#fffbeb'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      SKU: {p.sku} · Qty: <strong>{formatQty(p.total_quantity)}</strong>
                      {p.reorder_level > 0 && ` · Reorder at: ${p.reorder_level}`}
                    </div>
                  </div>
                  <Badge variant={p.status === 'out_of_stock' ? 'danger' : 'warning'}>
                    {p.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Ledger Activity */}
      <div style={{ marginTop: '24px' }}>
        <Card
          title="Recent Inventory Activity"
          subtitle="Latest movements from the stock ledger — authoritative backend data"
          headerActions={
            <Link to="/operations/history" style={{ fontSize: '12px', fontWeight: 600 }}>
              Full Ledger →
            </Link>
          }
        >
          {recentActivity.length === 0 ? (
            <EmptyState
              title="No Activity Yet"
              description="Validate a receipt, delivery, transfer, or adjustment to see movements here."
            />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Reference</th>
                    <th style={{ textAlign: 'right' }}>Qty Change</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map(act => {
                    const qtyChange = Number(act.quantity_change);
                    return (
                      <tr key={act.id}>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: movementColor(act.movement_type) }}>
                            {movementLabel(act.movement_type)}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '13px' }}>{act.product_name || '—'}</div>
                          {act.sku && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{act.sku}</div>}
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {act.location_name || '—'}
                          </span>
                        </td>
                        <td>
                          {act.reference_number
                            ? <code style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 5px', borderRadius: '3px' }}>{act.reference_number}</code>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                          }
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            fontWeight: 700, fontSize: '13px',
                            color: qtyChange > 0 ? 'var(--success)' : qtyChange < 0 ? 'var(--danger)' : 'var(--text-secondary)'
                          }}>
                            {qtyChange > 0 ? '+' : ''}{formatQty(qtyChange)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{formatQty(act.balance_after)}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {formatDateTime(act.created_at)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
