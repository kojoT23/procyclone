import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const res = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem('accessToken', res.data.accessToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return API(original);
      } catch (err) {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
  requestReset: (data) => API.post('/password/request', data),
  verifyToken: (token) => API.get(`/password/verify/${token}`),
  resetPassword: (data) => API.post('/password/reset', data),
};

export const usersAPI = {
  getAll: (params) => API.get('/users', { params }),
  getOne: (id) => API.get(`/users/${id}`),
  create: (data) => API.post('/users', data),
  update: (id, data) => API.put(`/users/${id}`, data),
  toggle: (id) => API.patch(`/users/${id}/toggle`),
  getRoles: () => API.get('/users/roles'),
};

export const productsAPI = {
  getAll: (params) => API.get('/products', { params }),
  getOne: (id) => API.get(`/products/${id}`),
  create: (data) => API.post('/products', data),
  update: (id, data) => API.put(`/products/${id}`, data),
  delete: (id) => API.delete(`/products/${id}`),
  updateStock: (id, data) => API.patch(`/products/${id}/stock`, data),
};

export const customersAPI = {
  getAll: (params) => API.get('/customers', { params }),
  getOne: (id) => API.get(`/customers/${id}`),
  create: (data) => API.post('/customers', data),
  update: (id, data) => API.put(`/customers/${id}`, data),
};

export const ordersAPI = {
  getAll: (params) => API.get('/orders', { params }),
  getOne: (id) => API.get(`/orders/${id}`),
  create: (data) => API.post('/orders', data),
  updateStatus: (id, data) => API.put(`/orders/${id}/status`, data),
};

export const ridersAPI = {
  getAll: (params) => API.get('/riders', { params }),
  getOne: (id) => API.get(`/riders/${id}`),
  create: (data) => API.post('/riders', data),
  update: (id, data) => API.put(`/riders/${id}`, data),
  delete: (id) => API.delete(`/riders/${id}`),
  assignDelivery: (data) => API.post('/riders/assign', data),
  updateDeliveryStatus: (id, data) => API.put(`/riders/delivery/${id}/status`, data),
};

export const cashAPI = {
  getAll: (params) => API.get('/cash', { params }),
  create: (data) => API.post('/cash', data),
  verify: (id) => API.put(`/cash/${id}/verify`),
  getDailyReport: () => API.get('/cash/report/daily'),
};

export default API;
