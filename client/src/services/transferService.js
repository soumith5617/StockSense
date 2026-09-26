import api from './api';

export const transferService = {
  /**
   * Fetch all transfers with line item aggregates
   * GET /api/transfers
   */
  async getTransfers() {
    const res = await api.get('/transfers');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch single transfer by ID with line items
   * GET /api/transfers/:id
   */
  async getTransfer(id) {
    const res = await api.get(`/transfers/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new internal stock transfer
   * POST /api/transfers
   */
  async createTransfer(transferData) {
    const res = await api.post('/transfers', transferData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing draft/waiting/ready transfer
   * PUT /api/transfers/:id
   */
  async updateTransfer(id, transferData) {
    const res = await api.put(`/transfers/${id}`, transferData);
    return res.data?.data || res.data;
  },

  /**
   * Cancel an internal transfer
   * POST /api/transfers/:id/cancel
   */
  async cancelTransfer(id) {
    const res = await api.post(`/transfers/${id}/cancel`);
    return res.data;
  },

  /**
   * Validate an internal transfer and atomically move stock between locations
   * POST /api/transfers/:id/validate
   */
  async validateTransfer(id) {
    const res = await api.post(`/transfers/${id}/validate`);
    return res.data?.data || res.data;
  }
};

export default transferService;
