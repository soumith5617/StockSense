import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const email = location.state?.email || '';
  const resetToken = location.state?.resetToken || '';
  const initialMessage = location.state?.message;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!resetToken) {
      setError('Missing reset session token. Please restart the password reset process.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill out both password fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.resetPassword({
        email,
        resetToken,
        newPassword: password
      });

      navigate('/login', {
        state: { message: 'Password has been reset successfully! Please sign in with your new password.' },
        replace: true
      });
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>StockSense</span>
          </div>
          <h2 className="auth-title">Set new password</h2>
          <p className="auth-subtitle">Create a secure new password for your account.</p>
        </div>

        {initialMessage && !error && (
          <div className="alert alert-info">
            {initialMessage}
          </div>
        )}

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        {!resetToken ? (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <p style={{ color: 'var(--danger)', fontSize: '14px', marginBottom: '16px' }}>
              No active reset session found.
            </p>
            <Link to="/forgot-password" className="btn btn-primary btn-block">
              Request Verification Code
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <Input
              label="New Password"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              required
              helperText="Minimum 6 characters"
              autoFocus
              autoComplete="new-password"
            />

            <Input
              label="Confirm New Password"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(null);
              }}
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="primary"
              className="btn-block"
              loading={loading}
              style={{ marginTop: '8px' }}
            >
              Reset Password
            </Button>
          </form>
        )}

        <div className="auth-footer">
          <Link to="/login" style={{ fontWeight: 600 }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
