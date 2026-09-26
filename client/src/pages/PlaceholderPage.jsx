import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import Badge from '../components/common/Badge';

export const PlaceholderPage = ({
  title = 'Module',
  moduleCode = 'MODULE',
  description = 'This inventory module backend is verified and ready. Full specialized UI views are scheduled for the next phase.'
}) => {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={description}
        actions={
          <Badge variant="primary">
            Backend API Active
          </Badge>
        }
      />

      <Card>
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
            {title} Foundation Ready
          </h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 24px' }}>
            The underlying REST APIs, database models, and transactions for <strong>{title}</strong> are active and verified on the server. Dedicated UI panels for this section will be enabled in Phase 2.
          </p>

          <Link to="/dashboard" className="btn btn-primary">
            ← Return to Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default PlaceholderPage;
