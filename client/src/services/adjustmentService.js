import api from './api';

export const adjustmentService = {
  /**
   * Fetch all inventory adjustments with line item aggregates
   * GET /api/adjustments
   */
  async getAdjustments() {
    const res = await api.get('/adjustments');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch single adjustment by ID with line items
   * GET /api/adjustments/:id
   */
  async getAdjustment(id) {
    const res = await api.get(`/adjustments/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new draft inventory adjustment
   * POST /api/adjustments
   */
  async createAdjustment(adjustmentData) {
    const res = await api.post('/adjustments', adjustmentData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing draft adjustment
   * PUT /api/adjustments/:id
   */
  async updateAdjustment(id, adjustmentData) {
    const res = await api.put(`/adjustments/${id}`, adjustmentData);
    return res.data?.data || res.data;
  },

  /**
   * Cancel an adjustment
   * POST /api/adjustments/:id/cancel
   */
  async cancelAdjustment(id) {
    const res = await api.post(`/adjustments/${id}/cancel`);
    return res.data;
  },

  /**
   * Validate an adjustment and reconcile stock
   * POST /api/adjustments/:id/validate
   */
  async validateAdjustment(id) {
    const res = await api.post(`/adjustments/${id}/validate`);
    return res.data?.data || res.data;
  }
};

export default adjustmentService;
