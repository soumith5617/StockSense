import api from './api';

export const warehouseService = {
  /**
   * Fetch all warehouses
   * GET /api/warehouses
   */
  async getWarehouses() {
    const res = await api.get('/warehouses');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch a single warehouse by ID
   * GET /api/warehouses/:id
   */
  async getWarehouse(id) {
    const res = await api.get(`/warehouses/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new warehouse
   * POST /api/warehouses
   */
  async createWarehouse(warehouseData) {
    const res = await api.post('/warehouses', warehouseData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing warehouse
   * PUT /api/warehouses/:id
   */
  async updateWarehouse(id, warehouseData) {
    const res = await api.put(`/warehouses/${id}`, warehouseData);
    return res.data?.data || res.data;
  },

  /**
   * Delete a warehouse by ID
   * DELETE /api/warehouses/:id
   */
  async deleteWarehouse(id) {
    const res = await api.delete(`/warehouses/${id}`);
    return res.data;
  }
};

export default warehouseService;
