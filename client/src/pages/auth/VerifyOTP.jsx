import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const initialEmail = searchParams.get('email') || location.state?.email || '';
  const devOtp = location.state?.devOtp;
  const initialMessage = location.state?.message;

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(devOtp || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !otp.trim()) {
      setError('Please provide both your email and the 6-digit code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authService.verifyOtp({
        email: email.trim(),
        otp: otp.trim()
      });

      if (res.resetToken) {
        navigate('/reset-password', {
          state: {
            email: email.trim(),
            resetToken: res.resetToken,
            message: 'Code verified successfully. Now create your new password.'
          }
        });
      } else {
        setError('Verification succeeded but reset token was not received.');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>StockSense</span>
          </div>
          <h2 className="auth-title">Verify reset code</h2>
          <p className="auth-subtitle">
            Enter the 6-digit verification code sent to your email.
          </p>
        </div>

        {initialMessage && !error && (
          <div className="alert alert-info">
            {initialMessage}
          </div>
        )}

        {devOtp && (
          <div className="alert alert-warning" style={{ fontSize: '13px' }}>
            <strong>Dev Mode Helper:</strong> Your generated OTP is <code>{devOtp}</code>
          </div>
        )}

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="6-Digit Verification Code"
            id="otp"
            name="otp"
            type="text"
            placeholder="123456"
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value);
              if (error) setError(null);
            }}
            required
            maxLength={6}
            autoFocus
            style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
          />

          <Button
            type="submit"
            variant="primary"
            className="btn-block"
            loading={loading}
            style={{ marginTop: '8px' }}
          >
            Verify Code
          </Button>
        </form>

        <div className="auth-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Link to="/forgot-password" style={{ fontWeight: 500 }}>
            Resend code
          </Link>
          <Link to="/login" style={{ fontWeight: 600 }}>
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
