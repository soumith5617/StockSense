import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';

export const Signup = () => {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const roleOptions = [
    { value: 'staff', label: 'Staff (Standard Operations)' },
    { value: 'manager', label: 'Manager (Inventory & Auditing)' },
    { value: 'admin', label: 'Administrator (Full Access)' }
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
      setError('Please fill out all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role
      });

      // Seamlessly log in newly created user
      try {
        await login({ email: formData.email.trim(), password: formData.password });
        navigate('/dashboard', { replace: true });
      } catch {
        // Fallback to login screen with success message if auto-login fails
        navigate('/login', {
          state: { message: 'Account created successfully! Please sign in with your credentials.' },
          replace: true
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to create account.');
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
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-subtitle">Join your team on StockSense</p>
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Input
            label="Full Name"
            id="name"
            name="name"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={handleChange}
            required
            autoComplete="name"
            autoFocus
          />

          <Input
            label="Work Email"
            id="email"
            name="email"
            type="email"
            placeholder="jane@company.com"
            value={formData.email}
            onChange={handleChange}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            id="password"
            name="password"
            type="password"
            placeholder="At least 6 characters"
            value={formData.password}
            onChange={handleChange}
            required
            helperText="Minimum 6 characters"
            autoComplete="new-password"
          />

          <Select
            label="Assigned Role"
            id="role"
            name="role"
            value={formData.role}
            onChange={handleChange}
            options={roleOptions}
            required
          />

          <Button
            type="submit"
            variant="primary"
            className="btn-block"
            loading={loading}
            style={{ marginTop: '8px' }}
          >
            Create Account
          </Button>
        </form>

        <div className="auth-footer">
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
