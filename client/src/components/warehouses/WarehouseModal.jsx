import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import warehouseService from '../../services/warehouseService';

export const WarehouseModal = ({
  isOpen,
  onClose,
  warehouse = null,
  onSuccess
}) => {
  const isEdit = Boolean(warehouse && warehouse.id);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || '',
        code: warehouse.code || '',
        address: warehouse.address || ''
      });
    } else {
      setFormData({
        name: '',
        code: '',
        address: ''
      });
    }
    setErrors({});
    setServerError(null);
  }, [warehouse, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Warehouse name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Warehouse code is required';
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
      code: formData.code.trim().toUpperCase(),
      address: formData.address.trim() ? formData.address.trim() : null
    };

    try {
      if (isEdit) {
        await warehouseService.updateWarehouse(warehouse.id, payload);
      } else {
        await warehouseService.createWarehouse(payload);
      }
      onSuccess(isEdit ? 'Warehouse updated successfully' : 'Warehouse created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save warehouse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Warehouse: ${warehouse.code}` : 'Add New Warehouse'}
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Warehouse'}
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
          label="Warehouse Name"
          id="name"
          name="name"
          placeholder="e.g. Central Distribution Facility"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
          autoFocus
        />

        <Input
          label="Warehouse Code"
          id="code"
          name="code"
          placeholder="e.g. WH-CENTRAL"
          value={formData.code}
          onChange={handleChange}
          error={errors.code}
          required
          helperText="Unique facility code (will be formatted as uppercase)"
        />

        <div className="form-group">
          <label htmlFor="address" className="form-label">
            <span>Physical Address (Optional)</span>
          </label>
          <textarea
            id="address"
            name="address"
            rows="3"
            className="form-input"
            placeholder="e.g. 100 Logistics Blvd, Dock Bay 4, Chicago, IL"
            value={formData.address}
            onChange={handleChange}
            style={{ resize: 'vertical' }}
          />
        </div>
      </form>
    </Modal>
  );
};

export default WarehouseModal;
