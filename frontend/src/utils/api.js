import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
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
          `${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/auth/refresh`,
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
  getAll:          (params) => API.get('/users', { params }),
  getOne:          (id)     => API.get(`/users/${id}`),
  create:          (data)   => API.post('/users', data),
  update:          (id, data) => API.put(`/users/${id}`, data),
  toggle:          (id)     => API.patch(`/users/${id}/toggle`),
  delete:          (id)     => API.delete(`/users/${id}`),
  getRoles:        ()       => API.get('/users/roles'),
  // Own profile
  getProfile:      ()       => API.get('/users/profile'),
  updateProfile:   (data)   => API.put('/users/profile', data),
  changePassword:  (data)   => API.post('/users/change-password', data),
  // Audit log — super_admin only
  getAuditLog:     (params) => API.get('/users/audit-log', { params }),
};

export const productsAPI = {
  getAll: (params) => API.get('/products', { params }),
  getOne: (id) => API.get(`/products/${id}`),
  create: (data) => API.post('/products', data),
  update: (id, data) => API.put(`/products/${id}`, data),
  delete: (id) => API.delete(`/products/${id}`),
  updateStock: (id, data) => API.patch(`/products/${id}/stock`, data),
  bulkImport: (data) => API.post('/products/bulk-import', data),
};

export const customersAPI = {
  getProfile: (id) => API.get(`/customers/${id}/profile`),
  updateNotes: (id, data) => API.put(`/customers/${id}/notes`, data),
  getAll: (params) => API.get('/customers', { params }),
  getOne: (id) => API.get(`/customers/${id}`),
  create: (data) => API.post('/customers', data),
  update: (id, data) => API.put(`/customers/${id}`, data),
  delete: (id) => API.delete(`/customers/${id}`),
};

export const ordersAPI = {
  getAll: (params) => API.get('/orders', { params }),
  getOne: (id) => API.get(`/orders/${id}`),
  getProof: (id) => API.get(`/orders/${id}/proof`),
  create: (data) => API.post('/orders', data),
  createBulk: (data) => API.post('/orders/bulk', data),
  updateStatus: (id, data) => API.put(`/orders/${id}/status`, data),
  cancel: (id, data) => API.put(`/orders/${id}/cancel`, data),
  delete: (id) => API.delete(`/orders/${id}`),
};

export const ridersAPI = {
  getAll: (params) => API.get('/riders', { params }),
  getOne: (id) => API.get(`/riders/${id}`),
  create: (data) => API.post('/riders', data),
  update: (id, data) => API.put(`/riders/${id}`, data),
  delete: (id) => API.delete(`/riders/${id}`),
  assignDelivery: (data) => API.post('/riders/assign', data),
  updateDeliveryStatus: (id, data) => API.put(`/riders/delivery/${id}/status`, data),
  resetAvailability: () => API.post('/riders/reset-availability'),
  getDeliveries: (riderId, params) => API.get(`/riders/${riderId}/deliveries`, { params }),
};

export const cashAPI = {
  getAll: (params) => API.get('/cash', { params }),
  create: (data) => API.post('/cash', data),
  verify: (id) => API.put(`/cash/${id}/verify`),
  dispute: (id, data) => API.put(`/cash/${id}/dispute`, data),
  resolve: (id, data) => API.put(`/cash/${id}/resolve`, data),
  getDailyReport: (params) => API.get('/cash/report/daily', { params }),
  getReconciliation: (params) => API.get('/cash/reconciliation', { params }),
};

export const paymentsAPI = {
  getAll: (params) => API.get('/payments', { params }),
  create: (data) => API.post('/payments', data),
  verify: (id, data) => API.put(`/payments/${id}/verify`, data),
  fail: (id) => API.put(`/payments/${id}/fail`),
  refund: (id) => API.put(`/payments/${id}/refund`),
  getSummary: (params) => API.get('/payments/summary', { params }),
};

export const returnsAPI = {
  getAll: (params) => API.get('/returns', { params }),
  submitEnquiry: (id, data) => API.put(`/returns/${id}/enquiry`, data),
  approveDisposal: (id, data) => API.put(`/returns/${id}/disposal`, data),
  confirmRefund: (id) => API.put(`/returns/${id}/refund`),
};

export const businessProfileAPI = {
  get:    ()     => API.get('/business-profile'),
  update: (data) => API.put('/business-profile', data),
};

export const reportSettingsAPI = {
  get:    ()     => API.get('/reports/settings'),
  update: (data) => API.put('/reports/settings', { settings: data }),
};

/* ─── Add to frontend/src/utils/api.js, alongside businessProfileAPI ─── */

export const pricingSettingsAPI = {
  get:    ()     => API.get('/pricing-settings'),
  update: (data) => API.put('/pricing-settings', data),
};

export const deliveryZonesAPI = {
  getAll: ()           => API.get('/delivery-zones'),
  create: (data)        => API.post('/delivery-zones', data),
  update: (id, data)    => API.put(`/delivery-zones/${id}`, data),
  delete: (id)          => API.delete(`/delivery-zones/${id}`),
};

export const surchargeRulesAPI = {
  getAll: ()           => API.get('/surcharge-rules'),
  create: (data)        => API.post('/surcharge-rules', data),
  update: (id, data)    => API.put(`/surcharge-rules/${id}`, data),
  delete: (id)          => API.delete(`/surcharge-rules/${id}`),
};

export const discountRulesAPI = {
  getAll: ()           => API.get('/discount-rules'),
  create: (data)        => API.post('/discount-rules', data),
  update: (id, data)    => API.put(`/discount-rules/${id}`, data),
  delete: (id)          => API.delete(`/discount-rules/${id}`),
};

export const expensesAPI = {
  getAll:      (params) => API.get('/expenses', { params }),
  getSummary:  (params) => API.get('/expenses/summary', { params }),
  create:      (data)   => API.post('/expenses', data),
  update:      (id, data) => API.put(`/expenses/${id}`, data),
  delete:      (id)     => API.delete(`/expenses/${id}`),
};

export const importsAPI = {
  getAll:       (params)   => API.get('/imports', { params }),
  getOne:       (id)       => API.get(`/imports/${id}`),
  getSummary:   ()         => API.get('/imports/summary'),
  getReports:   (params)   => API.get('/imports/reports', { params }),
  create:       (data)     => API.post('/imports', data),
  update:       (id, data) => API.put(`/imports/${id}`, data),
  updateStatus: (id, data) => API.put(`/imports/${id}/status`, data),
  confirmStock: (id, data) => API.put(`/imports/${id}/confirm-stock`, data),
  delete:       (id)       => API.delete(`/imports/${id}`),
};

/* ─── Add to frontend/src/utils/api.js ─── */

export const settlementsAPI = {
  getOutstanding: (riderId)    => API.get(`/settlements/outstanding/${riderId}`),
  declare:        (data)       => API.post('/settlements', data),
  getAll:         (params)     => API.get('/settlements', { params }),
  approve:        (id, data)   => API.put(`/settlements/${id}/approve`, data),
  getOverview:    (params)     => API.get('/settlements/overview', { params }),
};


/* ─── Add to frontend/src/utils/api.js ───
   inventoryAPI was previously defined locally inside Inventory.js.
   Centralizing it here so TransportInventory.js can reuse the same
   calls. Inventory.js can keep working as-is (its local const shadows
   this one), or you can delete the local def there and import from
   here instead — functionally identical, just avoids duplication. */

export const inventoryAPI = {
  getMovements:         (params)   => API.get('/inventory/movements', { params }),
  adjustStock:          (data)     => API.post('/inventory/movements/adjust', data),
  getSuppliers:         (params)   => API.get('/inventory/suppliers', { params }),
  createSupplier:       (data)     => API.post('/inventory/suppliers', data),
  updateSupplier:       (id, data) => API.put(`/inventory/suppliers/${id}`, data),
  deleteSupplier:       (id)       => API.delete(`/inventory/suppliers/${id}`),
  getPurchaseOrders:    (params)   => API.get('/inventory/purchase-orders', { params }),
  getPurchaseOrder:     (id)       => API.get(`/inventory/purchase-orders/${id}`),
  createPurchaseOrder:  (data)     => API.post('/inventory/purchase-orders', data),
  updatePurchaseOrder:  (id, data) => API.put(`/inventory/purchase-orders/${id}`, data),
  cancelPurchaseOrder:  (id)       => API.put(`/inventory/purchase-orders/${id}/cancel`),
  receivePurchaseOrder: (id, data) => API.post(`/inventory/purchase-orders/${id}/receive`, data),
};

/* ─── New — needs a matching backend route, see note below ─── */
export const restockAPI = {
  getAll:  (params) => API.get('/restock-requests', { params }),
  request: (data)    => API.post('/restock-requests', data),
};

export const schedulerAPI = {
  getSchedule: (params) => API.get('/scheduler', { params }),
  getDay: (params) => API.get('/scheduler/day', { params }),
  create: (data) => API.post('/scheduler', data),
  updateStatus: (id, data) => API.put(`/scheduler/${id}/status`, data),
  delete: (id) => API.delete(`/scheduler/${id}`),
};

export const quickLinksAPI = {
  getAll: () => API.get('/quick-links'),
  create: (data) => API.post('/quick-links', data),
  delete: (id) => API.delete(`/quick-links/${id}`),
};

export default API;

