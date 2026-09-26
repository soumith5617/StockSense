import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: attach JWT bearer token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('stocksense_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401s and uniform error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect on login or verify-otp attempts that return 401
      const url = error.config?.url || '';
      const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/verify-otp');
      
      if (!isAuthAttempt) {
        localStorage.removeItem('stocksense_token');
        window.dispatchEvent(new CustomEvent('stocksense:unauthorized'));
      }
    }

    const message = error.response?.data?.message || error.message || 'An unexpected error occurred';
    const enhancedError = new Error(message);
    enhancedError.status = error.response?.status;
    enhancedError.data = error.response?.data;
    enhancedError.originalError = error;

    return Promise.reject(enhancedError);
  }
);

export default api;
