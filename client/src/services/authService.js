import api from './api';

export const authService = {
  async login({ email, password }) {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },

  async register({ name, email, password, role = 'staff' }) {
    const res = await api.post('/auth/register', { name, email, password, role });
    return res.data;
  },

  async getMe() {
    const res = await api.get('/auth/me');
    return res.data.data;
  },

  async forgotPassword(email) {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  async verifyOtp({ email, otp }) {
    const res = await api.post('/auth/verify-otp', { email, otp });
    return res.data;
  },

  async resetPassword({ email, resetToken, newPassword }) {
    const res = await api.post('/auth/reset-password', { email, resetToken, newPassword });
    return res.data;
  }
};
