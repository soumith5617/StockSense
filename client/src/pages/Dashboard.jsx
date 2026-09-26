import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    lowStockCount: 0,
    pendingReceipts: 0,
    pendingDeliveries: 0,
    scheduledTransfers: 0
  });

  const [recentActivities, setRecentActivities] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Consume actual verified backend APIs
      const [productsRes, receiptsRes, deliveriesRes, transfersRes] = await Promise.allSettled([
        api.get('/products'),
        api.get('/receipts'),
        api.get('/deliveries'),
        api.get('/transfers')
      ]);

      const products = productsRes.status === 'fulfilled' ? (productsRes.value.data?.data || productsRes.value.data || []) : [];
      const receipts = receiptsRes.status === 'fulfilled' ? (receiptsRes.value.data?.data || receiptsRes.value.data || []) : [];
      const deliveries = deliveriesRes.status === 'fulfilled' ? (deliveriesRes.value.data?.data || deliveriesRes.value.data || []) : [];
      const transfers = transfersRes.status === 'fulfilled' ? (transfersRes.value.data?.data || transfersRes.value.data || []) : [];

      // Calculate actual counts from real data
      const pendingReceiptsCount = receipts.filter(r => r.status !== 'done' && r.status !== 'canceled').length;
      const pendingDeliveriesCount = deliveries.filter(d => d.status !== 'done' && d.status !== 'canceled').length;
      const scheduledTransfersCount = transfers.filter(t => t.status !== 'done' && t.status !== 'canceled').length;

      // Identify products with reorder levels configured
      const lowStockItems = products.filter(p => Number(p.reorder_level) > 0);

      setMetrics({
        totalProducts: products.length,
        lowStockCount: lowStockItems.length,
        pendingReceipts: pendingReceiptsCount,
        pendingDeliveries: pendingDeliveriesCount,
        scheduledTransfers: scheduledTransfersCount
      });

      setLowStockProducts(lowStockItems.slice(0, 5));

      // Build unified recent activities feed from real records
      const activities = [
        ...receipts.map(r => ({
          id: `rcpt-${r.id}`,
          type: 'Receipt',
          number: r.receipt_number || `REC-${r.id}`,
          status: r.status,
          date: r.created_at,
          link: '/operations/receipts',
          details: `Supplier: ${r.supplier_name || 'General'}, Items: ${r.item_count || 1}`
        })),
        ...deliveries.map(d => ({
          id: `del-${d.id}`,
          type: 'Delivery',
          number: d.delivery_number || `DEL-${d.id}`,
          status: d.status,
          date: d.created_at,
          link: '/operations/deliveries',
          details: `Customer: ${d.customer_name || 'Customer'}, Items: ${d.item_count || 1}`
        })),
        ...transfers.map(t => ({
          id: `trf-${t.id}`,
          type: 'Transfer',
          number: t.transfer_number || `TRF-${t.id}`,
          status: t.status,
          date: t.created_at,
          link: '/operations/transfers',
          details: `${t.source_location_name || 'Source'} → ${t.destination_location_name || 'Destination'}`
        }))
      ];

      // Sort by newest first
      activities.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      setRecentActivities(activities.slice(0, 7));

    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setError(err.message || 'Failed to load dashboard metrics from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatDate = (isoString) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <Spinner size="lg" color="var(--primary)" />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
          Loading real-time inventory telemetry...
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

  return (
    <div className="dashboard-page">
      {/* Page Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
            Inventory Dashboard
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Real-time operational overview across warehouses and movement orders
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" size="sm" onClick={fetchDashboardData} icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }>
            Refresh Data
          </Button>
        </div>
      </div>

      {/* 5 Core KPI Cards */}
      <div className="kpi-grid">
        {/* KPI 1 */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="kpi-label">Total Products Cataloged</span>
          <span className="kpi-value">{metrics.totalProducts}</span>
          <span className="kpi-subtext">Active SKUs in master catalog</span>
        </div>

        {/* KPI 2 */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <span className="kpi-label">Low / Monitored Stock</span>
          <span className="kpi-value">{metrics.lowStockCount}</span>
          <span className="kpi-subtext">Items with configured reorder limits</span>
        </div>

        {/* KPI 3 */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <span className="kpi-label">Pending Receipts</span>
          <span className="kpi-value">{metrics.pendingReceipts}</span>
          <span className="kpi-subtext">Incoming stock awaiting validation</span>
        </div>

        {/* KPI 4 */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <span className="kpi-label">Pending Deliveries</span>
          <span className="kpi-value">{metrics.pendingDeliveries}</span>
          <span className="kpi-subtext">Outgoing shipments in draft/ready</span>
        </div>

        {/* KPI 5 */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span className="kpi-label">Transfers Scheduled</span>
          <span className="kpi-value">{metrics.scheduledTransfers}</span>
          <span className="kpi-subtext">Inter-location movements in progress</span>
        </div>
      </div>

      {/* Operational Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* Quick Actions Panel */}
        <Card title="Quick Operational Actions" subtitle="Initiate common warehouse movements">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <Link to="/operations/receipts" className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }}>
              <span style={{ color: 'var(--success)' }}>📥</span> New Receipt
            </Link>
            <Link to="/operations/deliveries" className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }}>
              <span style={{ color: 'var(--primary)' }}>📤</span> New Delivery
            </Link>
            <Link to="/operations/transfers" className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }}>
              <span style={{ color: '#9333ea' }}>🔄</span> Internal Transfer
            </Link>
            <Link to="/operations/adjustments" className="btn btn-secondary" style={{ justifyContent: 'flex-start', padding: '12px' }}>
              <span style={{ color: 'var(--warning)' }}>⚖️</span> Stock Adjustment
            </Link>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Looking to manage items or sites?</span>
            <Link to="/products" className="btn btn-outline btn-sm">
              Product Master Catalog →
            </Link>
          </div>
        </Card>

        {/* Low Stock Monitor Panel */}
        <Card
          title="Monitored Inventory Reorder Levels"
          subtitle="Products configured with active safety thresholds"
          headerActions={
            <Link to="/products" style={{ fontSize: '12px', fontWeight: 600 }}>
              View All
            </Link>
          }
        >
          {lowStockProducts.length === 0 ? (
            <EmptyState
              title="No Reorder Alerts"
              description="Configure reorder levels on your products to receive active stock warnings."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lowStockProducts.map(p => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#fafbfc'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: {p.sku} | Unit: {p.unit_of_measure}</div>
                  </div>
                  <Badge variant="warning">
                    Threshold: {p.reorder_level}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Inventory Movement Feed */}
      <div style={{ marginTop: '24px' }}>
        <Card
          title="Recent Movement Activity"
          subtitle="Chronological feed of latest receipts, deliveries, and internal transfers"
        >
          {recentActivities.length === 0 ? (
            <EmptyState
              title="No Inventory Activity Yet"
              description="Create a receipt or delivery to see live operational logs populate here."
            />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Document #</th>
                    <th>Status</th>
                    <th>Route / Partner Details</th>
                    <th>Logged At</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivities.map(act => (
                    <tr key={act.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {act.type}
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: '13px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {act.number}
                        </code>
                      </td>
                      <td>
                        <Badge status={act.status} />
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {act.details}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {formatDate(act.date)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link to={act.link} className="btn btn-ghost btn-sm">
                          Inspect →
                        </Link>
                      </td>
                    </tr>
                  ))}
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
