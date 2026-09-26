import React from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../common/Button';

export const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="header-title-badge">
          <span className="system-status-dot" title="API System Online" />
          <span>StockSense ERP</span>
        </div>
      </div>

      <div className="header-right">
        {user && (
          <div className="user-profile-menu">
            <div className="user-avatar" title={user.email}>
              {getInitials(user.name)}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name || 'User'}</span>
              <span className="user-role">{user.role || 'staff'}</span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              title="Sign out of StockSense"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              }
            >
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
