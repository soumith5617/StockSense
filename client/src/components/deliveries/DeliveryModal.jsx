import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import deliveryService from '../../services/deliveryService';

export const DeliveryModal = ({
  isOpen,
  onClose,
  delivery = null,
  locations = [],
  products = [],
  onSuccess
}) => {
  const isEdit = Boolean(delivery && delivery.id);

  const [formData, setFormData] = useState({
    delivery_number: '',
    customer_name: '',
    location_id: '',
    status: 'draft',
    items: [{ product_id: '', quantity: 1 }]
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);

  useEffect(() => {
    if (delivery) {
      setFormData({
        delivery_number: delivery.delivery_number || '',
        customer_name: delivery.customer_name || '',
        location_id: delivery.location_id ? String(delivery.location_id) : '',
        status: delivery.status || 'draft',
        items: Array.isArray(delivery.items) && delivery.items.length > 0
          ? delivery.items.map((it) => ({
              product_id: String(it.product_id),
              quantity: it.quantity
            }))
          : [{ product_id: '', quantity: 1 }]
      });
    } else {
      setFormData({
        delivery_number: '',
        customer_name: '',
        location_id: locations.length === 1 ? String(locations[0].id) : '',
        status: 'draft',
        items: [{ product_id: '', quantity: 1 }]
      });
    }
    setErrors({});
    setServerError(null);
  }, [delivery, locations, isOpen]);

  const validate = () => {
    const newErrors = {};

    if (!formData.location_id) {
      newErrors.location_id = 'Source departure location is required';
    }

    if (!Array.isArray(formData.items) || formData.items.length === 0) {
      newErrors.items = 'At least one line item is required in the delivery order';
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
      customer_name: formData.customer_name.trim() ? formData.customer_name.trim() : null,
      location_id: Number(formData.location_id),
      status: formData.status,
      items: formData.items.map((it) => ({
        product_id: Number(it.product_id),
        quantity: Number(it.quantity)
      }))
    };

    if (!isEdit && formData.delivery_number.trim()) {
      payload.delivery_number = formData.delivery_number.trim();
    }

    try {
      if (isEdit) {
        await deliveryService.updateDelivery(delivery.id, payload);
      } else {
        await deliveryService.createDelivery(payload);
      }
      onSuccess(isEdit ? 'Delivery order updated successfully' : 'Delivery order created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save delivery order');
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
    { value: 'ready', label: 'Ready for Dispatch' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Delivery: ${delivery.delivery_number}` : 'Create Outgoing Delivery Order'}
      maxWidth="740px"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Delivery Order'}
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
        {/* Header Row: Delivery Number & Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 14 }}>
          {!isEdit ? (
            <Input
              label="Delivery Reference Number"
              id="delivery_number"
              name="delivery_number"
              placeholder="Auto-generated (e.g. DEL-1727...)"
              value={formData.delivery_number}
              onChange={handleChange}
              helperText="Optional. Leave blank to generate automatically."
            />
          ) : (
            <div className="form-group">
              <label className="form-label">
                <span>Delivery Reference Number</span>
              </label>
              <input
                type="text"
                disabled
                value={formData.delivery_number}
                className="form-input btn-disabled"
                style={{ backgroundColor: '#f1f5f9', fontWeight: 600 }}
              />
              <div className="form-help">Delivery number is permanent once assigned.</div>
            </div>
          )}

          <Select
            label="Order Status"
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={statusOptions}
            required
          />
        </div>

        {/* Customer Name & Source Location */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 20 }}>
          <Input
            label="Customer / Client Name (Optional)"
            id="customer_name"
            name="customer_name"
            placeholder="e.g. Global Tech Logistics / Order #8821"
            value={formData.customer_name}
            onChange={handleChange}
            helperText="Destination customer or recipient reference"
          />

          <Select
            label="Source Departure Location"
            id="location_id"
            name="location_id"
            value={formData.location_id}
            onChange={handleChange}
            options={locationOptions}
            error={errors.location_id}
            placeholder="Select departure location"
            required
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
                Dispatched Line Items ({formData.items.length})
              </h4>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Products and quantities to be picked and deducted from the source location upon validation
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
                  <th style={{ width: '30%' }}>Quantity to Dispatch</th>
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
                          title="Remove item line"
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

export default DeliveryModal;
