import api from './api';

const ledgerService = {
  /**
   * Fetch paginated, filtered stock ledger entries.
   * Supported query params: page, limit, search, movement_type, product_id, location_id, start_date, end_date
   */
  getLedgerEntries: async (params = {}) => {
    const response = await api.get('/stock-ledger', { params });
    const res = response.data;
    // Backend returns: { success, data: [], total, page, pageSize, totalPages }
    return {
      entries: res.data || [],
      pagination: {
        total: res.total || 0,
        page: res.page || 1,
        pageSize: res.pageSize || 25,
        totalPages: res.totalPages || 1
      }
    };
  },

  /**
   * Fetch a single ledger entry by ID.
   */
  getLedgerEntry: async (id) => {
    const response = await api.get(`/stock-ledger/${id}`);
    return response.data?.data || response.data;
  }
};

export default ledgerService;
