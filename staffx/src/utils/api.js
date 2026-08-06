import axios from 'axios';

/* ⚠️ ASSUMPTION — same backend as the main Shorewinds app, so this
   points at the same REACT_APP_API_URL. Set this in StaffX's own
   .env file (separate app = separate build = separate .env). */
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

/* Namespaced localStorage keys — StaffX is a separate origin from the
   dashboard, so tokens are never actually shared, but the staffx_
   prefix also protects against collisions if the two apps ever end
   up served from the same domain (e.g. same domain, different path)
   in the future. */
const TOKEN_KEY = 'staffx_accessToken';
const REFRESH_KEY = 'staffx_refreshToken';

API.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
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
        const refreshToken = localStorage.getItem(REFRESH_KEY);
        const res = await axios.post(
          `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/auth/refresh`,
          { refreshToken }
        );
        localStorage.setItem(TOKEN_KEY, res.data.accessToken);
        original.headers.Authorization = `Bearer ${res.data.accessToken}`;
        return API(original);
      } catch (err) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        window.location.href = '/login';
      }
    }
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/* Confirmed against authController.js: login expects { email, password }
   and returns { accessToken, refreshToken, user }. */
export const authAPI = {
  login:  (data) => API.post('/auth/login', data),
  getMe:  ()     => API.get('/auth/me'),
};

export const hrAPI = {
  getMyStatus:   ()       => API.get('/hr/attendance/me'),
  getMyHistory:  (params) => API.get('/hr/attendance/me/history', { params }),
  clockIn:       ()       => API.post('/hr/attendance/clock-in'),
  clockOut:      ()       => API.post('/hr/attendance/clock-out'),
  startBreak:    (data)   => API.post('/hr/attendance/break-start', data),
  endBreak:      ()       => API.post('/hr/attendance/break-end'),

  getMyShifts:   (params) => API.get('/hr/shifts/me', { params }),
  getAllShifts:  (params) => API.get('/hr/shifts', { params }),
  createShift:   (data)   => API.post('/hr/shifts', data),
  updateShift:   (id, data) => API.put(`/hr/shifts/${id}`, data),
  deleteShift:   (id)     => API.delete(`/hr/shifts/${id}`),

  getMyPayslips:    ()       => API.get('/hr/payslips/me'),
  getMyPayslip:     (id)     => API.get(`/hr/payslips/me/${id}`),
  getAllPayslips:   (params) => API.get('/hr/payslips', { params }),
  generatePayslip:  (data)   => API.post('/hr/payslips', data),
  finalizePayslip:  (id)     => API.put(`/hr/payslips/${id}/finalize`),
  markPayslipPaid:  (id)     => API.put(`/hr/payslips/${id}/paid`),
  deletePayslip:    (id)     => API.delete(`/hr/payslips/${id}`),

  getMyLeaveRequests:   ()       => API.get('/hr/leave/me'),
  createLeaveRequest:   (data)   => API.post('/hr/leave', data),
  cancelMyLeaveRequest: (id)     => API.delete(`/hr/leave/me/${id}`),
  getAllLeaveRequests:  (params) => API.get('/hr/leave', { params }),
  approveLeaveRequest:  (id)     => API.put(`/hr/leave/${id}/approve`),
  rejectLeaveRequest:   (id)     => API.put(`/hr/leave/${id}/reject`),

  getMyCareerProfile:      ()       => API.get('/hr/career/me'),
  getVacancies:            (params) => API.get('/hr/vacancies', { params }),
  createVacancy:           (data)   => API.post('/hr/vacancies', data),
  updateVacancyStatus:     (id, status) => API.put(`/hr/vacancies/${id}/status`, { status }),
  deleteVacancy:           (id)     => API.delete(`/hr/vacancies/${id}`),
  applyToVacancy:          (id, data) => API.post(`/hr/vacancies/${id}/apply`, data),
  getMyApplications:       ()       => API.get('/hr/applications/me'),
  getApplicants:           (id)     => API.get(`/hr/vacancies/${id}/applicants`),
  updateApplicationStatus: (id, status) => API.put(`/hr/applications/${id}/status`, { status }),

  getMyDocuments:    ()       => API.get('/hr/documents/me'),
  getAllDocuments:   (params) => API.get('/hr/documents', { params }),
  generateDocument:  (data)   => API.post('/hr/documents', data),
  deleteDocument:    (id)     => API.delete(`/hr/documents/${id}`),
};

/* For the admin scheduler's staff picker — reuses the main app's
   existing /api/users endpoint (same backend, same database). */
export const usersAPI = {
  getAll: (params) => API.get('/users', { params }),
};

export { TOKEN_KEY, REFRESH_KEY };
export default API;
