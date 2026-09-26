import React, { useState } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import supplierService from '../../services/supplierService';

export const SupplierQuickModal = ({
  isOpen,
  onClose,
  onSupplierCreated
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Supplier name is required';
    }

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        newErrors.email = 'Please provide a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    const payload = {
      name: formData.name.trim(),
      email: formData.email.trim() ? formData.email.trim() : null,
      phone: formData.phone.trim() ? formData.phone.trim() : null,
      address: formData.address.trim() ? formData.address.trim() : null
    };

    try {
      const created = await supplierService.createSupplier(payload);
      onSupplierCreated(created);
      setFormData({ name: '', email: '', phone: '', address: '' });
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to create supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Supplier"
      maxWidth="480px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            Create Supplier
          </Button>
        </>
      }
    >
      {serverError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Supplier Name"
          id="quick_supplier_name"
          name="name"
          placeholder="e.g. Apex Industrial Supplies"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
          autoFocus
        />

        <Input
          label="Contact Email (Optional)"
          id="quick_supplier_email"
          name="email"
          type="email"
          placeholder="e.g. orders@apexsupplies.com"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
        />

        <Input
          label="Phone Number (Optional)"
          id="quick_supplier_phone"
          name="phone"
          placeholder="e.g. +1 (555) 234-5678"
          value={formData.phone}
          onChange={handleChange}
        />

        <div className="form-group">
          <label htmlFor="quick_supplier_address" className="form-label">
            <span>Billing / Dispatch Address (Optional)</span>
          </label>
          <textarea
            id="quick_supplier_address"
            name="address"
            rows="2"
            className="form-input"
            placeholder="e.g. 789 Supply Chain Way, Suite 400"
            value={formData.address}
            onChange={handleChange}
            style={{ resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default SupplierQuickModal;
