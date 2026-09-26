import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import PublicOnlyRoute from '../components/layout/PublicOnlyRoute';
import AppLayout from '../components/layout/AppLayout';

import Login from '../pages/auth/Login';
import Signup from '../pages/auth/Signup';
import ForgotPassword from '../pages/auth/ForgotPassword';
import VerifyOTP from '../pages/auth/VerifyOTP';
import ResetPassword from '../pages/auth/ResetPassword';

import Dashboard from '../pages/Dashboard';
import Products from '../pages/products/Products';
import Warehouses from '../pages/warehouses/Warehouses';
import Locations from '../pages/locations/Locations';
import Receipts from '../pages/receipts/Receipts';
import Deliveries from '../pages/deliveries/Deliveries';
import Transfers from '../pages/transfers/Transfers';
import Adjustments from '../pages/adjustments/Adjustments';
import PlaceholderPage from '../pages/PlaceholderPage';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Authenticated Application Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<Products />} />
          
          <Route path="/operations/receipts" element={<Receipts />} />

          <Route path="/operations/deliveries" element={<Deliveries />} />

          <Route path="/operations/transfers" element={<Transfers />} />

          <Route path="/operations/adjustments" element={<Adjustments />} />

          <Route path="/warehouses" element={<Warehouses />} />
          <Route path="/locations" element={<Locations />} />

          <Route
            path="/settings"
            element={
              <PlaceholderPage
                title="System Settings & Audit Log"
                moduleCode="SETTINGS"
                description="Manage organization preferences, user roles, security tokens, and ledger audit exports."
              />
            }
          />

          <Route
            path="/profile"
            element={
              <PlaceholderPage
                title="My Profile"
                moduleCode="PROFILE"
                description="View user role credentials and update personal contact preferences."
              />
            }
          />
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
