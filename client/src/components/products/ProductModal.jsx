import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import productService from '../../services/productService';

export const ProductModal = ({
  isOpen,
  onClose,
  product = null,
  availableCategories = [],
  onSuccess
}) => {
  const isEdit = Boolean(product && product.id);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    unit_of_measure: 'pcs',
    reorder_level: 0,
    category_id: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        unit_of_measure: product.unit_of_measure || 'pcs',
        reorder_level: product.reorder_level !== undefined && product.reorder_level !== null ? product.reorder_level : 0,
        category_id: product.category_id || ''
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        unit_of_measure: 'pcs',
        reorder_level: 0,
        category_id: ''
      });
    }
    setErrors({});
    setServerError(null);
  }, [product, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'SKU is required';
    }

    if (!formData.unit_of_measure.trim()) {
      newErrors.unit_of_measure = 'Unit of measure is required';
    }

    const reorderNum = Number(formData.reorder_level);
    if (isNaN(reorderNum) || !Number.isInteger(reorderNum) || reorderNum < 0) {
      newErrors.reorder_level = 'Reorder level must be a non-negative integer (0 or greater)';
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
      sku: formData.sku.trim(),
      unit_of_measure: formData.unit_of_measure.trim(),
      reorder_level: Number(formData.reorder_level),
      category_id: formData.category_id ? Number(formData.category_id) : null
    };

    try {
      if (isEdit) {
        await productService.updateProduct(product.id, payload);
      } else {
        await productService.createProduct(payload);
      }
      onSuccess(isEdit ? 'Product updated successfully' : 'Product created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  // Build category select options
  const categoryOptions = [
    { value: '', label: 'None (Uncategorized)' },
    ...availableCategories.map((c) => ({
      value: String(c.id),
      label: c.name
    }))
  ];

  const commonUnits = ['pcs', 'units', 'boxes', 'kg', 'g', 'rolls', 'liters', 'meters', 'sets'];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Product: ${product.sku}` : 'Add New Product'}
      maxWidth="540px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Product'}
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
          label="Product Name"
          id="name"
          name="name"
          placeholder="e.g. Standard Steel Hex Nut M8"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
          autoFocus
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="SKU / Item Code"
            id="sku"
            name="sku"
            placeholder="e.g. SKU-NUT-008"
            value={formData.sku}
            onChange={handleChange}
            error={errors.sku}
            required
            helperText="Must be unique across the catalog"
          />

          <div className="form-group">
            <label htmlFor="unit_of_measure" className="form-label">
              <span>Unit of Measure <span style={{ color: 'var(--danger)' }}>*</span></span>
            </label>
            <input
              list="unit-suggestions"
              id="unit_of_measure"
              name="unit_of_measure"
              value={formData.unit_of_measure}
              onChange={handleChange}
              placeholder="e.g. pcs, boxes"
              className={`form-input ${errors.unit_of_measure ? 'is-error' : ''}`}
              required
            />
            <datalist id="unit-suggestions">
              {commonUnits.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            {errors.unit_of_measure && <div className="form-error">{errors.unit_of_measure}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Input
            label="Reorder Safety Level"
            id="reorder_level"
            name="reorder_level"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={formData.reorder_level}
            onChange={handleChange}
            error={errors.reorder_level}
            helperText="Minimum threshold for stock alerts"
          />

          <Select
            label="Category"
            id="category_id"
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            options={categoryOptions}
            helperText={availableCategories.length === 0 ? 'No categories recorded in database' : ''}
          />
        </div>
      </form>
    </Modal>
  );
};

export default ProductModal;
