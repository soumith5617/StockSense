import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import SupplierQuickModal from './SupplierQuickModal';
import receiptService from '../../services/receiptService';

export const ReceiptModal = ({
  isOpen,
  onClose,
  receipt = null,
  suppliers = [],
  locations = [],
  products = [],
  onSuccess,
  onRefreshSuppliers
}) => {
  const isEdit = Boolean(receipt && receipt.id);

  const [formData, setFormData] = useState({
    receipt_number: '',
    supplier_id: '',
    location_id: '',
    status: 'draft',
    items: [{ product_id: '', quantity: 1 }]
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  useEffect(() => {
    if (receipt) {
      setFormData({
        receipt_number: receipt.receipt_number || '',
        supplier_id: receipt.supplier_id ? String(receipt.supplier_id) : '',
        location_id: receipt.location_id ? String(receipt.location_id) : '',
        status: receipt.status || 'draft',
        items: Array.isArray(receipt.items) && receipt.items.length > 0
          ? receipt.items.map((it) => ({
              product_id: String(it.product_id),
              quantity: it.quantity
            }))
          : [{ product_id: '', quantity: 1 }]
      });
    } else {
      setFormData({
        receipt_number: '',
        supplier_id: '',
        location_id: locations.length === 1 ? String(locations[0].id) : '',
        status: 'draft',
        items: [{ product_id: '', quantity: 1 }]
      });
    }
    setErrors({});
    setServerError(null);
  }, [receipt, locations, isOpen]);

  // Form validations
  const validate = () => {
    const newErrors = {};

    if (!formData.location_id) {
      newErrors.location_id = 'Destination location is required';
    }

    if (!Array.isArray(formData.items) || formData.items.length === 0) {
      newErrors.items = 'At least one line item is required in the receipt';
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

  const handleSupplierCreated = (newSupplier) => {
    if (onRefreshSuppliers) {
      onRefreshSuppliers();
    }
    setFormData((prev) => ({ ...prev, supplier_id: String(newSupplier.id) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setServerError(null);

    const payload = {
      supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
      location_id: Number(formData.location_id),
      status: formData.status,
      items: formData.items.map((it) => ({
        product_id: Number(it.product_id),
        quantity: Number(it.quantity)
      }))
    };

    if (!isEdit && formData.receipt_number.trim()) {
      payload.receipt_number = formData.receipt_number.trim();
    }

    try {
      if (isEdit) {
        await receiptService.updateReceipt(receipt.id, payload);
      } else {
        await receiptService.createReceipt(payload);
      }
      onSuccess(isEdit ? 'Receipt updated successfully' : 'Receipt created successfully');
      onClose();
    } catch (err) {
      setServerError(err.message || 'Failed to save receipt');
    } finally {
      setLoading(false);
    }
  };

  // Build select option arrays
  const supplierOptions = [
    { value: '', label: 'None (Direct Ingestion / Internal)' },
    ...suppliers.map((s) => ({
      value: String(s.id),
      label: s.name + (s.email ? ` (${s.email})` : '')
    }))
  ];

  const locationOptions = locations.map((loc) => ({
    value: String(loc.id),
    label: `${loc.name} (${loc.code}) · ${loc.warehouse_name || 'Warehouse'}`
  }));

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'ready', label: 'Ready for Receipt' }
  ];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? `Edit Receipt: ${receipt.receipt_number}` : 'Create Incoming Stock Receipt'}
        maxWidth="740px"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading}>
              {isEdit ? 'Save Changes' : 'Create Receipt'}
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
          {/* Header Row: Receipt Number & Status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 14 }}>
            {!isEdit ? (
              <Input
                label="Receipt Reference Number"
                id="receipt_number"
                name="receipt_number"
                placeholder="Auto-generated (e.g. REC-1727...)"
                value={formData.receipt_number}
                onChange={handleChange}
                helperText="Optional. Leave blank to generate automatically."
              />
            ) : (
              <div className="form-group">
                <label className="form-label">
                  <span>Receipt Reference Number</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={formData.receipt_number}
                  className="form-input btn-disabled"
                  style={{ backgroundColor: '#f1f5f9', fontWeight: 600 }}
                />
                <div className="form-help">Receipt number is permanent once created.</div>
              </div>
            )}

            <Select
              label="Receipt Status"
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={statusOptions}
              required
            />
          </div>

          {/* Supplier & Destination Location */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 20 }}>
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label htmlFor="supplier_id" className="form-label" style={{ margin: 0 }}>
                  <span>Supplier</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  + New Supplier
                </button>
              </div>

              <select
                id="supplier_id"
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleChange}
                className="form-select"
              >
                {supplierOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <Select
              label="Destination Warehouse Location"
              id="location_id"
              name="location_id"
              value={formData.location_id}
              onChange={handleChange}
              options={locationOptions}
              error={errors.location_id}
              placeholder="Select destination location"
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
                  Received Line Items ({formData.items.length})
                </h4>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Specify product items and quantities to be stocked into the destination location upon validation
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
                    <th style={{ width: '30%' }}>Quantity to Receive</th>
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

      {/* Inline Quick Supplier Creation Modal */}
      <SupplierQuickModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSupplierCreated={handleSupplierCreated}
      />
    </>
  );
};

export default ReceiptModal;
