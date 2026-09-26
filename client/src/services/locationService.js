import api from './api';

export const locationService = {
  /**
   * Fetch all locations with joined warehouse details
   * GET /api/locations
   */
  async getLocations() {
    const res = await api.get('/locations');
    return res.data?.data || res.data || [];
  },

  /**
   * Fetch a single location by ID
   * GET /api/locations/:id
   */
  async getLocation(id) {
    const res = await api.get(`/locations/${id}`);
    return res.data?.data || res.data;
  },

  /**
   * Create a new location
   * POST /api/locations
   */
  async createLocation(locationData) {
    const res = await api.post('/locations', locationData);
    return res.data?.data || res.data;
  },

  /**
   * Update an existing location
   * PUT /api/locations/:id
   */
  async updateLocation(id, locationData) {
    const res = await api.put(`/locations/${id}`, locationData);
    return res.data?.data || res.data;
  },

  /**
   * Delete a location by ID
   * DELETE /api/locations/:id
   */
  async deleteLocation(id) {
    const res = await api.delete(`/locations/${id}`);
    return res.data;
  }
};

export default locationService;
