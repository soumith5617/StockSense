import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if redirected with a flash notification (e.g. from signup or reset password)
  const flashMessage = location.state?.message;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login({ email: formData.email, password: formData.password });
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
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
          <h2 className="auth-title">Sign in to your account</h2>
          <p className="auth-subtitle">Enterprise Inventory & Warehouse Management</p>
        </div>

        {flashMessage && (
          <div className="alert alert-success">
            {flashMessage}
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
            placeholder="name@company.com"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
            autoFocus
          />

          <Input
            label="Password"
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={handleChange}
            required
            autoComplete="current-password"
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              marginBottom: '20px',
              fontSize: '13px'
            }}
          >
            <Link to="/forgot-password" style={{ fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="btn-block"
            loading={loading}
          >
            Sign In
          </Button>
        </form>

        <div className="auth-footer">
          Don't have an account?{' '}
          <Link to="/signup" style={{ fontWeight: 600 }}>
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
