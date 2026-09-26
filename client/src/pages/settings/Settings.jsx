import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../components/common/Card';
import PageHeader from '../../components/common/PageHeader';

const SettingSection = ({ title, description, links }) => (
  <Card title={title} subtitle={description}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {links.map(({ label, to, description: desc }, idx) => (
        <Link
          key={to}
          to={to}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 0',
            borderBottom: idx < links.length - 1 ? '1px solid var(--border-color)' : 'none',
            textDecoration: 'none',
            color: 'inherit'
          }}
          className="settings-nav-link"
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{label}</div>
            {desc && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      ))}
    </div>
  </Card>
);

export const Settings = () => {
  return (
    <div className="settings-page">
      <PageHeader
        title="Settings"
        subtitle="Manage warehouse infrastructure, locations, and application configuration"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>

        <SettingSection
          title="Warehouse Management"
          description="Create and manage physical warehouse buildings and storage facilities"
          links={[
            {
              label: 'Warehouses',
              to: '/warehouses',
              description: 'View, create, edit, and delete warehouse records'
            }
          ]}
        />

        <SettingSection
          title="Location Management"
          description="Define storage zones, bins, and shelf locations within warehouses"
          links={[
            {
              label: 'Locations',
              to: '/locations',
              description: 'Manage specific inventory storage locations linked to warehouses'
            }
          ]}
        />

        <SettingSection
          title="Inventory Operations"
          description="Manage products and run inventory lifecycle operations"
          links={[
            { label: 'Product Catalog', to: '/products', description: 'Manage SKUs, categories, and reorder levels' },
            { label: 'Stock Ledger', to: '/operations/history', description: 'View full read-only inventory movement history' }
          ]}
        />

        <Card title="Application Information" subtitle="StockSense platform version and system details">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { label: 'Application', value: 'StockSense' },
              { label: 'Version', value: '1.0.0' },
              { label: 'Stack', value: 'React · Vite · Node.js · Express · MySQL' },
              { label: 'Authentication', value: 'JWT (Bearer Token)' },
              { label: 'Inventory Model', value: 'Transaction-safe, ledger-backed' }
            ].map(({ label, value }, idx) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx < 4 ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
