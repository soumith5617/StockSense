import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import adjustmentService from '../../services/adjustmentService';

export const AdjustmentModal = ({
  isOpen,
  onClose,
  adjustment = null,
  locations = [],
  products = [],
  onSuccess
}) => {
  const isEdit = Boolean(adjustment && adjustment.id);

  const [formData, setFormData] = useState({
    adjustment_number: '',
    location_id: '',
    reason: '',
    items: [{ product_id: '', counted_quantity: 0, system_quantity: null }]
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (adjustment) {
      setFormData({
        adjustment_number: adjustment.adjustment_number || '',
        location_id: adjustment.location_id ? String(adjustment.location_id) : '',
        reason: adjustment.reason || '',
        items: Array.isArray(adjustment.items) && adjustment.items.length > 0
          ? adjustment.items.map((it) => ({
              product_id: String(it.product_id),
              counted_quantity: it.counted_quantity !== undefined && it.counted_quantity !== null
                ? Number(it.counted_quantity)
                : 0,
              system_quantity: it.system_quantity !== undefined && it.system_quantity !== null
                ? Number(it.system_quantity)
                : null
            }))
          : [{ product_id: '', counted_quantity: 0, system_quantity: null }]
      });
    } else {
      setFormData({
        adjustment_number: '',
        location_id: locations.length === 1 ? String(locations[0].id) : '',
        reason: '',
        items: [{ product_id: '', counted_quantity: 0, system_quantity: null }]
      });
    }
    setErrors({});
    setServerError(null);
  }, [adjustment, locations, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.location_id) {
      newErrors.location_id = 'Adjustment location is required';
    }

    if (!Array.isArray(formData.items) || formData.items.length === 0) {
      newErrors.items = 'At least one line item is required in the adjustment';
    } else {
      const itemErrors = [];
      const seenProducts = new Set();
      let hasItemErrors = false;

      formData.items.forEach((item, index) => {
        const lineErr = {};
        if (!item.product_id) {
          lineErr.product_id = 'Product is required';
          hasItemErrors = true;
        } else if (seenProducts.has(item.product_id)) {
          lineErr.product_id = 'Duplicate product in adjustment items';
          hasItemErrors = true;
        } else {
          seenProducts.add(item.product_id);
        }

        const qtyNum = Number(item.counted_quantity);
        if (item.counted_quantity === '' || item.counted_quantity === undefined || isNaN(qtyNum) || qtyNum < 0) {
          lineErr.counted_quantity = 'Counted quantity must be 0 or greater';
          hasItemErrors = true;
        }

        itemErrors[index] = lineErr;
      });

      if (hasItemErrors) {
        newErrors.itemLines = itemErrors;
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

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value
      };
      return { ...prev, items: updatedItems };
    });

    if (errors.itemLines && errors.itemLines[index]?.[field]) {
      setErrors((prev) => {
        const updatedLines = [...(prev.itemLines || [])];
        if (updatedLines[index]) {
          updatedLines[index][field] = null;
        }
        return { ...prev, itemLines: updatedLines };
      });
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: '', counted_quantity: 0, system_quantity: null }]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    const payload = {
      location_id: Number(formData.location_id),
      reason: formData.reason.trim() ? formData.reason.trim() : null,
      status: 'draft',
      items: formData.items.map((it) => ({
        product_id: Number(it.product_id),
        counted_quantity: Number(it.counted_quantity)
      }))
    };

    if (!isEdit && formData.adjustment_number.trim()) {
      payload.adjustment_number = formData.adjustment_number.trim();
    }

    try {
      if (isEdit) {
        await adjustmentService.updateAdjustment(adjustment.id, payload);
      } else {
        await adjustmentService.createAdjustment(payload);
      }
      onSuccess(isEdit ? 'Adjustment updated successfully' : 'Adjustment created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save inventory adjustment');
    } finally {
      setLoading(false);
    }
  };

  const locationOptions = locations.map((loc) => ({
    value: String(loc.id),
    label: `${loc.name} (${loc.code}) · ${loc.warehouse_name || 'Warehouse'}`
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Inventory Adjustment: ${adjustment.adjustment_number}` : 'Create Inventory Adjustment'}
      maxWidth="760px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Adjustment'}
          </Button>
        </>
      }
    >
      {serverError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {serverError}
        </div>
      )}

      {errors.items && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {errors.items}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Header Row: Adjustment Number & Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
          {!isEdit ? (
            <Input
              label="Adjustment Reference Number"
              id="adjustment_number"
              name="adjustment_number"
              placeholder="Auto-generated (e.g. ADJ-1727...)"
              value={formData.adjustment_number}
              onChange={handleChange}
              helperText="Optional. Leave blank to generate automatically."
            />
          ) : (
            <div className="form-group">
              <label className="form-label">
                <span>Adjustment Reference Number</span>
              </label>
              <input
                type="text"
                disabled
                value={formData.adjustment_number}
                className="form-input btn-disabled"
                style={{ backgroundColor: '#f1f5f9', fontWeight: 600 }}
              />
              <div className="form-help">Adjustment number is permanent once assigned.</div>
            </div>
          )}

          <Select
            label="Storage Location"
            id="location_id"
            name="location_id"
            value={formData.location_id}
            onChange={handleChange}
            options={locationOptions}
            error={errors.location_id}
            placeholder="Select location to adjust"
            required
          />
        </div>

        {/* Reason Field */}
        <div style={{ marginBottom: 20 }}>
          <Input
            label="Adjustment Reason (Optional)"
            id="reason"
            name="reason"
            placeholder="e.g. Annual physical cycle count, Damaged packaging, Missing inventory reconciliation"
            value={formData.reason}
            onChange={handleChange}
            helperText="Document why physical counts differ from recorded balances"
          />
        </div>

        {/* Line Items Section */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: 16,
            marginTop: 10
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}
          >
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                Counted Products ({formData.items.length})
              </h4>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Enter the verified physical count. The backend will read authoritative system stock to calculate differences.
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddItem}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Add Product
            </Button>
          </div>

          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              backgroundColor: '#ffffff'
            }}
          >
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Product Selection</th>
                  <th style={{ width: '25%' }}>Counted Quantity</th>
                  <th style={{ width: '20%' }}>Difference Preview</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => {
                  const selectedProd = products.find((p) => String(p.id) === String(item.product_id));
                  const lineError = errors.itemLines?.[index];

                  const hasSystemQty = item.system_quantity !== null && item.system_quantity !== undefined;
                  const countedNum = Number(item.counted_quantity);
                  const previewDiff = hasSystemQty && !isNaN(countedNum)
                    ? Number((countedNum - Number(item.system_quantity)).toFixed(2))
                    : null;

                  return (
                    <tr key={index}>
                      <td style={{ verticalAlign: 'top', padding: '10px 12px' }}>
                        <select
                          className={`form-select ${lineError?.product_id ? 'is-error' : ''}`}
                          value={item.product_id}
                          onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                          style={{ fontSize: 13 }}
                        >
                          <option value="" disabled>Select product from catalog</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) [{p.unit_of_measure}]
                            </option>
                          ))}
                        </select>
                        {hasSystemQty && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                            Recorded System Stock: <strong>{Number(item.system_quantity).toLocaleString()}</strong> {selectedProd?.unit_of_measure || ''}
                          </div>
                        )}
                        {lineError?.product_id && (
                          <div className="form-error" style={{ fontSize: 11, marginTop: 3 }}>
                            {lineError.product_id}
                          </div>
                        )}
                      </td>

                      <td style={{ verticalAlign: 'top', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            placeholder="0.00"
                            className={`form-input ${lineError?.counted_quantity ? 'is-error' : ''}`}
                            value={item.counted_quantity}
                            onChange={(e) => handleItemChange(index, 'counted_quantity', e.target.value)}
                            style={{ fontSize: 13 }}
                          />
                          {selectedProd && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {selectedProd.unit_of_measure}
                            </span>
                          )}
                        </div>
                        {lineError?.counted_quantity && (
                          <div className="form-error" style={{ fontSize: 11, marginTop: 3 }}>
                            {lineError.counted_quantity}
                          </div>
                        )}
                      </td>

                      <td style={{ verticalAlign: 'top', padding: '10px 12px' }}>
                        {previewDiff !== null ? (
                          <div>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 700,
                                backgroundColor: previewDiff > 0 ? '#dcfce7' : previewDiff < 0 ? '#fee2e2' : '#f1f5f9',
                                color: previewDiff > 0 ? '#166534' : previewDiff < 0 ? '#991b1b' : 'var(--text-secondary)'
                              }}
                            >
                              {previewDiff > 0 ? `+${previewDiff}` : previewDiff}
                            </span>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                              {previewDiff > 0 ? 'Stock Increase' : previewDiff < 0 ? 'Stock Decrease' : 'No Change'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Calculated on save
                          </span>
                        )}
                      </td>

                      <td style={{ verticalAlign: 'top', textAlign: 'center', padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={formData.items.length <= 1}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: formData.items.length <= 1 ? 'var(--text-muted)' : 'var(--danger)',
                            cursor: formData.items.length <= 1 ? 'not-allowed' : 'pointer',
                            padding: '6px',
                            borderRadius: '4px'
                          }}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default AdjustmentModal;
