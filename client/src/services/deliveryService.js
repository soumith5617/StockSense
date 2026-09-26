import api from './api';

export const deliveryService = {
  /**
   * Fetch all deliveries with item aggregations
   * GET /api/deliveries
   */
  async getDeliveries() {
    const res = await api.get('/deliveries');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch single delivery by ID with line items
   * GET /api/deliveries/:id
   */
  async getDelivery(id) {
    const res = await api.get(`/deliveries/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new outgoing stock delivery
   * POST /api/deliveries
   */
  async createDelivery(deliveryData) {
    const res = await api.post('/deliveries', deliveryData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing draft/waiting/ready delivery
   * PUT /api/deliveries/:id
   */
  async updateDelivery(id, deliveryData) {
    const res = await api.put(`/deliveries/${id}`, deliveryData);
    return res.data?.data || res.data;
  },

  /**
   * Cancel a delivery
   * POST /api/deliveries/:id/cancel
   */
  async cancelDelivery(id) {
    const res = await api.post(`/deliveries/${id}/cancel`);
    return res.data;
  },

  /**
   * Validate a delivery order and atomically deduct stock + create ledger entries
   * POST /api/deliveries/:id/validate
   */
  async validateDelivery(id) {
    const res = await api.post(`/deliveries/${id}/validate`);
    return res.data?.data || res.data;
  }
};

export default deliveryService;
