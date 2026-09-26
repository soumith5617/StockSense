import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import Card from '../../components/common/Card';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';

const ROLE_LABELS = {
  admin: 'Administrator',
  manager: 'Manager',
  staff: 'Staff'
};

export const Profile = () => {
  const { user: ctxUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await authService.getMe();
      setUser(data);
    } catch (err) {
      setError(err.message || 'Failed to load profile information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
    } catch { return iso; }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <Spinner size="lg" color="var(--primary)" />
        <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
          Loading profile...
        </p>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to Load Profile" message={error} onRetry={fetchProfile} />;
  }

  const profile = user || ctxUser;

  return (
    <div className="profile-page">
      <PageHeader
        title="My Profile"
        subtitle="Your account information from the StockSense directory"
      />

      <div style={{ maxWidth: '600px' }}>
        <Card>
          {/* Avatar / Name Block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              backgroundColor: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px', fontWeight: 700, flexShrink: 0,
              userSelect: 'none'
            }}>
              {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {profile?.name || '—'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {profile?.email || '—'}
              </div>
              <div style={{ marginTop: '6px' }}>
                <Badge variant={profile?.role === 'admin' ? 'primary' : profile?.role === 'manager' ? 'info' : 'secondary'}>
                  {ROLE_LABELS[profile?.role] || profile?.role || 'Staff'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              { label: 'Full Name', value: profile?.name },
              { label: 'Email Address', value: profile?.email },
              { label: 'Role', value: ROLE_LABELS[profile?.role] || profile?.role },
              { label: 'Account Created', value: formatDate(profile?.created_at) },
              { label: 'User ID', value: profile?.id ? `#${profile.id}` : '—' }
            ].map(({ label, value }, idx) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: idx < 4 ? '1px solid var(--border-color)' : 'none'
                }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {label}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {value || '—'}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-muted)' }}>
            Profile information is read-only. Contact your system administrator to update account details.
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
