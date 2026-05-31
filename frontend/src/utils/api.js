import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
};

export const productsAPI = {
  getAll: () => API.get('/products'),
  getOne: (id) => API.get(`/products/${id}`),
  create: (data) => API.post('/products', data),
  update: (id, data) => API.put(`/products/${id}`, data),
  delete: (id) => API.delete(`/products/${id}`),
  updateStock: (id, data) => API.patch(`/products/${id}/stock`, data),
};

export const customersAPI = {
  getAll: () => API.get('/customers'),
  getOne: (id) => API.get(`/customers/${id}`),
  create: (data) => API.post('/customers', data),
  update: (id, data) => API.put(`/customers/${id}`, data),
};

export const ordersAPI = {
  getAll: () => API.get('/orders'),
  getOne: (id) => API.get(`/orders/${id}`),
  create: (data) => API.post('/orders', data),
  updateStatus: (id, data) => API.put(`/orders/${id}/status`, data),
};

export const ridersAPI = {
  getAll: () => API.get('/riders'),
  getOne: (id) => API.get(`/riders/${id}`),
  create: (data) => API.post('/riders', data),
  update: (id, data) => API.put(`/riders/${id}`, data),
  delete: (id) => API.delete(`/riders/${id}`),
  assignDelivery: (data) => API.post('/riders/assign', data),
  updateDeliveryStatus: (id, data) => API.put(`/riders/delivery/${id}/status`, data),
};

export const cashAPI = {
  getAll: () => API.get('/cash'),
  create: (data) => API.post('/cash', data),
  verify: (id) => API.put(`/cash/${id}/verify`),
  getDailyReport: () => API.get('/cash/report/daily'),
};

export default API;
