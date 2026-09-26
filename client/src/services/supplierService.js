import api from './api';

export const supplierService = {
  /**
   * Fetch all suppliers
   * GET /api/suppliers
   */
  async getSuppliers() {
    const res = await api.get('/suppliers');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch a single supplier by ID
   * GET /api/suppliers/:id
   */
  async getSupplier(id) {
    const res = await api.get(`/suppliers/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new supplier
   * POST /api/suppliers
   */
  async createSupplier(supplierData) {
    const res = await api.post('/suppliers', supplierData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing supplier
   * PUT /api/suppliers/:id
   */
  async updateSupplier(id, supplierData) {
    const res = await api.put(`/suppliers/${id}`, supplierData);
    return res.data?.data || res.data;
  },

  /**
   * Delete a supplier by ID
   * DELETE /api/suppliers/:id
   */
  async deleteSupplier(id) {
    const res = await api.delete(`/suppliers/${id}`);
    return res.data;
  }
};

export default supplierService;
