/* ─── Add to frontend/src/utils/api.js, alongside businessProfileAPI ─── */

export const reportSettingsAPI = {
  get:    ()     => API.get('/reports/settings'),
  update: (data) => API.put('/reports/settings', { settings: data }),
};
