import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import transferService from '../../services/transferService';

export const TransferModal = ({
  isOpen,
  onClose,
  transfer = null,
  locations = [],
  products = [],
  onSuccess
}) => {
  const isEdit = Boolean(transfer && transfer.id);

  const [formData, setFormData] = useState({
    transfer_number: '',
    source_location_id: '',
    destination_location_id: '',
    status: 'draft',
    items: [{ product_id: '', quantity: 1 }]
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (transfer) {
      setFormData({
        transfer_number: transfer.transfer_number || '',
        source_location_id: transfer.source_location_id ? String(transfer.source_location_id) : '',
        destination_location_id: transfer.destination_location_id ? String(transfer.destination_location_id) : '',
        status: transfer.status || 'draft',
        items: Array.isArray(transfer.items) && transfer.items.length > 0
          ? transfer.items.map((it) => ({
              product_id: String(it.product_id),
              quantity: it.quantity
            }))
          : [{ product_id: '', quantity: 1 }]
      });
    } else {
      setFormData({
        transfer_number: '',
        source_location_id: locations.length > 0 ? String(locations[0].id) : '',
        destination_location_id: locations.length > 1 ? String(locations[1].id) : '',
        status: 'draft',
        items: [{ product_id: '', quantity: 1 }]
      });
    }
    setErrors({});
    setServerError(null);
  }, [transfer, locations, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.source_location_id) {
      newErrors.source_location_id = 'Source location is required';
    }

    if (!formData.destination_location_id) {
      newErrors.destination_location_id = 'Destination location is required';
    }

    if (
      formData.source_location_id &&
      formData.destination_location_id &&
      formData.source_location_id === formData.destination_location_id
    ) {
      newErrors.destination_location_id = 'Source and destination locations must be different.';
    }

    if (!Array.isArray(formData.items) || formData.items.length === 0) {
      newErrors.items = 'At least one product line item is required in the transfer order';
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
          lineErr.product_id = 'Duplicate product; please merge quantities';
          hasItemErrors = true;
        } else {
          seenProducts.add(item.product_id);
        }

        const qtyNum = Number(item.quantity);
        if (item.quantity === '' || item.quantity === undefined || isNaN(qtyNum) || qtyNum <= 0) {
          lineErr.quantity = 'Quantity must be > 0';
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
      items: [...prev.items, { product_id: '', quantity: 1 }]
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
      source_location_id: Number(formData.source_location_id),
      destination_location_id: Number(formData.destination_location_id),
      status: formData.status,
      items: formData.items.map((it) => ({
        product_id: Number(it.product_id),
        quantity: Number(it.quantity)
      }))
    };

    if (!isEdit && formData.transfer_number.trim()) {
      payload.transfer_number = formData.transfer_number.trim();
    }

    try {
      if (isEdit) {
        await transferService.updateTransfer(transfer.id, payload);
      } else {
        await transferService.createTransfer(payload);
      }
      onSuccess(isEdit ? 'Transfer updated successfully' : 'Transfer created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save transfer order');
    } finally {
      setLoading(false);
    }
  };

  const locationOptions = locations.map((loc) => ({
    value: String(loc.id),
    label: `${loc.name} (${loc.code}) · ${loc.warehouse_name || 'Warehouse'}`
  }));

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'ready', label: 'Ready for Transfer' }
  ];

  const sourceLocObj = locations.find((l) => String(l.id) === String(formData.source_location_id));
  const destLocObj = locations.find((l) => String(l.id) === String(formData.destination_location_id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Internal Transfer: ${transfer.transfer_number}` : 'Create Internal Stock Transfer'}
      maxWidth="760px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Transfer'}
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
        {/* Header Row: Transfer Number & Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
          {!isEdit ? (
            <Input
              label="Transfer Reference Number"
              id="transfer_number"
              name="transfer_number"
              placeholder="Auto-generated (e.g. TRF-1727...)"
              value={formData.transfer_number}
              onChange={handleChange}
              helperText="Optional. Leave blank to generate automatically."
            />
          ) : (
            <div className="form-group">
              <label className="form-label">
                <span>Transfer Reference Number</span>
              </label>
              <input
                type="text"
                disabled
                value={formData.transfer_number}
                className="form-input btn-disabled"
                style={{ backgroundColor: '#f1f5f9', fontWeight: 600 }}
              />
              <div className="form-help">Transfer number is permanent once assigned.</div>
            </div>
          )}

          <Select
            label="Transfer Status"
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={statusOptions}
            required
          />
        </div>

        {/* Source & Destination Locations Section */}
        <div
          style={{
            backgroundColor: '#fafbfc',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            marginBottom: 20
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Stock Movement Route
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', alignItems: 'center' }}>
            {/* FROM Location */}
            <div>
              <Select
                label="FROM: Source Location"
                id="source_location_id"
                name="source_location_id"
                value={formData.source_location_id}
                onChange={handleChange}
                options={locationOptions}
                error={errors.source_location_id}
                placeholder="Select source location"
                required
              />
              {sourceLocObj && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Origin: <strong>{sourceLocObj.warehouse_name || 'Warehouse'}</strong> / {sourceLocObj.name}
                </div>
              )}
            </div>

            {/* Direction Arrow */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                paddingTop: 12
              }}
              title="Stock transfers from source to destination"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            {/* TO Location */}
            <div>
              <Select
                label="TO: Destination Location"
                id="destination_location_id"
                name="destination_location_id"
                value={formData.destination_location_id}
                onChange={handleChange}
                options={locationOptions}
                error={errors.destination_location_id}
                placeholder="Select destination location"
                required
              />
              {destLocObj && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Target: <strong>{destLocObj.warehouse_name || 'Warehouse'}</strong> / {destLocObj.name}
                </div>
              )}
            </div>
          </div>
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
                Products to Transfer ({formData.items.length})
              </h4>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Items will be atomically deducted from source and credited to destination upon validation
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
                  <th style={{ width: '60%' }}>Product Selection</th>
                  <th style={{ width: '30%' }}>Transfer Quantity</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => {
                  const selectedProd = products.find((p) => String(p.id) === String(item.product_id));
                  const lineError = errors.itemLines?.[index];

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
                            min="0.01"
                            placeholder="0.00"
                            className={`form-input ${lineError?.quantity ? 'is-error' : ''}`}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            style={{ fontSize: 13 }}
                          />
                          {selectedProd && (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {selectedProd.unit_of_measure}
                            </span>
                          )}
                        </div>
                        {lineError?.quantity && (
                          <div className="form-error" style={{ fontSize: 11, marginTop: 3 }}>
                            {lineError.quantity}
                          </div>
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
                          title="Remove product row"
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

export default TransferModal;
