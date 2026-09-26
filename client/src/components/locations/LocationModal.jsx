import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import locationService from '../../services/locationService';

export const LocationModal = ({
  isOpen,
  onClose,
  location = null,
  warehouses = [],
  defaultWarehouseId = '',
  onSuccess
}) => {
  const isEdit = Boolean(location && location.id);

  const [formData, setFormData] = useState({
    warehouse_id: '',
    name: '',
    code: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (location) {
      setFormData({
        warehouse_id: location.warehouse_id ? String(location.warehouse_id) : '',
        name: location.name || '',
        code: location.code || ''
      });
    } else {
      setFormData({
        warehouse_id: defaultWarehouseId ? String(defaultWarehouseId) : '',
        name: '',
        code: ''
      });
    }
    setErrors({});
    setServerError(null);
  }, [location, defaultWarehouseId, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.warehouse_id) {
      newErrors.warehouse_id = 'Please select a parent warehouse facility';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Location name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Location code is required';
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
      warehouse_id: Number(formData.warehouse_id),
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase()
    };

    try {
      if (isEdit) {
        await locationService.updateLocation(location.id, payload);
      } else {
        await locationService.createLocation(payload);
      }
      onSuccess(isEdit ? 'Location updated successfully' : 'Location created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save location');
    } finally {
      setLoading(false);
    }
  };

  const warehouseOptions = warehouses.map((w) => ({
    value: String(w.id),
    label: `${w.name} (${w.code})`
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Location: ${location.code}` : 'Add New Location'}
      maxWidth="520px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Location'}
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
        <Select
          label="Parent Warehouse Facility"
          id="warehouse_id"
          name="warehouse_id"
          value={formData.warehouse_id}
          onChange={handleChange}
          options={warehouseOptions}
          error={errors.warehouse_id}
          placeholder="Select parent warehouse"
          required
        />

        <Input
          label="Location Name"
          id="name"
          name="name"
          placeholder="e.g. Zone A - Rack 04 - Shelf 2"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
        />

        <Input
          label="Location Code"
          id="code"
          name="code"
          placeholder="e.g. LOC-A-04-2"
          value={formData.code}
          onChange={handleChange}
          error={errors.code}
          required
          helperText="Location code uniqueness is scoped to its parent warehouse"
        />
      </form>
    </Modal>
  );
};

export default LocationModal;
