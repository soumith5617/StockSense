import api from './api';

export const receiptService = {
  /**
   * Fetch all receipts with item aggregations
   * GET /api/receipts
   */
  async getReceipts() {
    const res = await api.get('/receipts');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch single receipt with detailed line items
   * GET /api/receipts/:id
   */
  async getReceipt(id) {
    const res = await api.get(`/receipts/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new incoming receipt
   * POST /api/receipts
   */
  async createReceipt(receiptData) {
    const res = await api.post('/receipts', receiptData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing draft/waiting/ready receipt
   * PUT /api/receipts/:id
   */
  async updateReceipt(id, receiptData) {
    const res = await api.put(`/receipts/${id}`, receiptData);
    return res.data?.data || res.data;
  },

  /**
   * Cancel a receipt
   * POST /api/receipts/:id/cancel
   */
  async cancelReceipt(id) {
    const res = await api.post(`/receipts/${id}/cancel`);
    return res.data;
  },

  /**
   * Validate a receipt and execute atomic stock increment + ledger entry
   * POST /api/receipts/:id/validate
   */
  async validateReceipt(id) {
    const res = await api.post(`/receipts/${id}/validate`);
    return res.data?.data || res.data;
  }
};

export default receiptService;
