import api from './api';

export const productService = {
  async getProducts() {
    const res = await api.get('/products');
    return res.data?.data || res.data || [];
  },

  async getProduct(id) {
    const res = await api.get(`/products/${id}`);
    return res.data?.data || res.data;
  },

  async createProduct(productData) {
    const res = await api.post('/products', productData);
    return res.data?.data || res.data;
  },

  async updateProduct(id, productData) {
    const res = await api.put(`/products/${id}`, productData);
    return res.data?.data || res.data;
  },

  async deleteProduct(id) {
    const res = await api.delete(`/products/${id}`);
    return res.data;
  }
};

export default productService;
