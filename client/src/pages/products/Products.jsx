import React, { useState, useEffect, useMemo } from 'react';
import productService from '../../services/productService';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import SearchBox from '../../components/common/SearchBox';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Spinner from '../../components/common/Spinner';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import ProductModal from '../../components/products/ProductModal';
import ProductDetailModal from '../../components/products/ProductDetailModal';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Notifications
  const [successMessage, setSuccessMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Modals state
  const [modalState, setModalState] = useState({
    isOpen: false,
    product: null
  });

  const [detailModalState, setDetailModalState] = useState({
    isOpen: false,
    productId: null
  });

  const [deleteDialogState, setDeleteDialogState] = useState({
    isOpen: false,
    product: null,
    loading: false
  });

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productService.getProducts();
      setProducts(data);
    } catch (err) {
      setError(err.message || 'Failed to retrieve products from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Discover existing categories from product list
  const availableCategories = useMemo(() => {
    const catMap = new Map();
    products.forEach((p) => {
      if (p.category_id && p.category_name) {
        catMap.set(p.category_id, {
          id: p.category_id,
          name: p.category_name
        });
      }
    });
    return Array.from(catMap.values());
  }, [products]);

  // Client-side filtering across Name, SKU, and Category
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.category_name?.toLowerCase().includes(query);

      const matchesCategory =
        !selectedCategoryFilter ||
        String(p.category_id) === String(selectedCategoryFilter);

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategoryFilter]);

  const handleOpenCreate = () => {
    setActionError(null);
    setModalState({ isOpen: true, product: null });
  };

  const handleOpenEdit = (product) => {
    setActionError(null);
    setModalState({ isOpen: true, product });
  };

  const handleOpenView = (productId) => {
    setDetailModalState({ isOpen: true, productId });
  };

  const handleOpenDelete = (product) => {
    setActionError(null);
    setDeleteDialogState({ isOpen: true, product, loading: false });
  };

  const handleConfirmDelete = async () => {
    const { product } = deleteDialogState;
    if (!product) return;

    setDeleteDialogState((prev) => ({ ...prev, loading: true }));
    setActionError(null);

    try {
      await productService.deleteProduct(product.id);
      setSuccessMessage(`Product "${product.name}" (${product.sku}) deleted successfully`);
      setDeleteDialogState({ isOpen: false, product: null, loading: false });
      fetchProducts();
    } catch (err) {
      setDeleteDialogState((prev) => ({ ...prev, loading: false }));
      // Check for 409 Conflict when product is referenced in inventory or transactions
      if (err.status === 409 || err.message?.includes('referenced')) {
        setActionError(
          `Cannot delete product "${product.name}" (${product.sku}): it is referenced by existing inventory stock or transaction records.`
        );
      } else {
        setActionError(err.message || 'Failed to delete product.');
      }
      setDeleteDialogState({ isOpen: false, product: null, loading: false });
    }
  };

  const handleModalSuccess = (msg) => {
    setSuccessMessage(msg);
    fetchProducts();
  };

  return (
    <div className="products-page">
      {/* Header with Title and Add Product Button */}
      <PageHeader
        title="Product Master Catalog"
        subtitle="Manage product definitions, SKUs, barcode standards, and reorder levels"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchProducts}
              disabled={loading}
              icon={
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleOpenCreate}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              }
            >
              Add Product
            </Button>
          </>
        }
      />

      {/* Action / Success / Error Banners */}
      {successMessage && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div style={{ flex: 1 }}>{successMessage}</div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>{actionError}</div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Card with Filters and Data Table */}
      <Card>
        {/* Filters Toolbar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '20px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <SearchBox
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              placeholder="Search products by name or SKU..."
              width="300px"
            />

            {availableCategories.length > 0 && (
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '160px', height: '38px', fontSize: '13px' }}
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Spinner size="lg" color="var(--primary)" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              Loading product catalog...
            </p>
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Products"
            message={error}
            onRetry={fetchProducts}
          />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No matching products' : 'No products in catalog'}
            description={
              searchQuery
                ? `No products matched your search term "${searchQuery}". Try clearing filters.`
                : 'Get started by creating your first inventory product definition.'
            }
            action={
              searchQuery ? (
                <Button variant="secondary" size="sm" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleOpenCreate}>
                  + Add First Product
                </Button>
              )
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit</th>
                  <th>Reorder Level</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        ID #{p.id}
                      </div>
                    </td>

                    <td>
                      <code
                        style={{
                          backgroundColor: '#f1f5f9',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#334155'
                        }}
                      >
                        {p.sku}
                      </code>
                    </td>

                    <td>
                      <Badge variant={p.category_name ? 'primary' : 'draft'}>
                        {p.category_name || 'Uncategorized'}
                      </Badge>
                    </td>

                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {p.unit_of_measure}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600 }}>{p.reorder_level}</span>
                        {Number(p.reorder_level) > 0 && (
                          <span
                            title="Reorder safety threshold configured"
                            style={{ fontSize: '13px', cursor: 'help' }}
                          >
                            🛡️
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenView(p.id)}
                          title="View Product Details"
                        >
                          View
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Product"
                        >
                          Edit
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDelete(p)}
                          style={{ color: 'var(--danger)' }}
                          title="Delete Product"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create / Edit Modal */}
      <ProductModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, product: null })}
        product={modalState.product}
        availableCategories={availableCategories}
        onSuccess={handleModalSuccess}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={detailModalState.isOpen}
        onClose={() => setDetailModalState({ isOpen: false, productId: null })}
        productId={detailModalState.productId}
        onEdit={handleOpenEdit}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={deleteDialogState.isOpen}
        onClose={() => setDeleteDialogState({ isOpen: false, product: null, loading: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Product from Catalog"
        message={`Are you sure you want to delete "${deleteDialogState.product?.name}" (SKU: ${deleteDialogState.product?.sku})? Note that products referenced by inventory stock or receipts cannot be removed.`}
        confirmText="Delete Product"
        variant="danger"
        loading={deleteDialogState.loading}
      />
    </div>
  );
};

export default Products;
