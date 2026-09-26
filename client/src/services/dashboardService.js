import api from './api';

const dashboardService = {
  /**
   * Fetch authoritative dashboard summary KPIs.
   */
  getSummary: async () => {
    const response = await api.get('/dashboard/summary');
    return response.data?.data || {};
  },

  /**
   * Fetch recent inventory ledger activity for dashboard feed.
   */
  getRecentActivity: async (limit = 10) => {
    const response = await api.get('/dashboard/activity', { params: { limit } });
    return response.data?.data || [];
  },

  /**
   * Fetch low-stock and out-of-stock products for dashboard widget.
   */
  getLowStockProducts: async (limit = 8) => {
    const response = await api.get('/dashboard/low-stock', { params: { limit } });
    return response.data?.data || [];
  }
};

export default dashboardService;
