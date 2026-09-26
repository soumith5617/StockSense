import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authService.forgotPassword(email.trim());
      // Navigate to verify-otp step, passing email and dev OTP if returned
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}`, {
        state: {
          email: email.trim(),
          devOtp: res.otp || null,
          message: res.message || 'Verification code sent to your email.'
        }
      });
    } catch (err) {
      setError(err.message || 'Failed to request password reset.');
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span>StockSense</span>
          </div>
          <h2 className="auth-title">Reset your password</h2>
          <p className="auth-subtitle">
            Enter your work email and we'll send you a 6-digit verification code.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Work Email"
            id="email"
            name="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            required
            autoComplete="email"
            autoFocus
          />

          <Button
            type="submit"
            variant="primary"
            className="btn-block"
            loading={loading}
            style={{ marginTop: '8px' }}
          >
            Send Verification Code
          </Button>
        </form>

        <div className="auth-footer">
          Remember your password?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
