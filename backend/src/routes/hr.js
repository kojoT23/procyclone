const express = require('express');
const router  = express.Router();
const {
  clockIn, clockOut, startBreak, endBreak,
  getMyStatus, getMyHistory, getAllAttendance,
} = require('../controllers/hrAttendanceController');
const {
  getMyShifts, getAllShifts, createShift, updateShift, deleteShift,
} = require('../controllers/hrSchedulerController');
const {
  getMyPayslips, getMyPayslip, getAllPayslips, generatePayslip,
  finalizePayslip, markPayslipPaid, deletePayslip,
} = require('../controllers/hrPayslipController');
const {
  getMyLeaveRequests, createLeaveRequest, cancelMyLeaveRequest,
  getAllLeaveRequests, approveLeaveRequest, rejectLeaveRequest,
} = require('../controllers/hrLeaveController');
const {
  getMyCareerProfile, getVacancies, createVacancy, updateVacancyStatus,
  deleteVacancy, applyToVacancy, getMyApplications, getApplicants, updateApplicationStatus,
} = require('../controllers/hrCareerController');
const {
  getMyDocuments, getAllDocuments, generateDocument, deleteDocument,
} = require('../controllers/hrDocumentsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

/* Self-service — any authenticated user (staff or rider) */
router.get('/attendance/me',            getMyStatus);
router.get('/attendance/me/history',    getMyHistory);
router.post('/attendance/clock-in',     clockIn);
router.post('/attendance/clock-out',    clockOut);
router.post('/attendance/break-start',  startBreak);
router.post('/attendance/break-end',    endBreak);
router.get('/shifts/me',                getMyShifts);
router.get('/payslips/me',              getMyPayslips);
router.get('/payslips/me/:id',          getMyPayslip);
router.get('/leave/me',                 getMyLeaveRequests);
router.post('/leave',                   createLeaveRequest);
router.delete('/leave/me/:id',          cancelMyLeaveRequest);
router.get('/career/me',                getMyCareerProfile);
router.get('/vacancies',                getVacancies);
router.post('/vacancies/:id/apply',     applyToVacancy);
router.get('/applications/me',          getMyApplications);
router.get('/documents/me',             getMyDocuments);

/* Admin/reporting */
router.get('/attendance', authorize('super_admin', 'admin', 'manager'), getAllAttendance);
router.get('/shifts',     authorize('super_admin', 'admin', 'manager'), getAllShifts);
router.post('/shifts',    authorize('super_admin', 'admin', 'manager'), createShift);
router.put('/shifts/:id', authorize('super_admin', 'admin', 'manager'), updateShift);
router.delete('/shifts/:id', authorize('super_admin', 'admin', 'manager'), deleteShift);

router.get('/payslips',              authorize('super_admin', 'admin', 'manager'), getAllPayslips);
router.post('/payslips',             authorize('super_admin', 'admin', 'manager'), generatePayslip);
router.put('/payslips/:id/finalize', authorize('super_admin', 'admin', 'manager'), finalizePayslip);
router.put('/payslips/:id/paid',     authorize('super_admin', 'admin', 'manager'), markPayslipPaid);
router.delete('/payslips/:id',       authorize('super_admin', 'admin', 'manager'), deletePayslip);

router.get('/leave',              authorize('super_admin', 'admin', 'manager'), getAllLeaveRequests);
router.put('/leave/:id/approve',  authorize('super_admin', 'admin', 'manager'), approveLeaveRequest);
router.put('/leave/:id/reject',   authorize('super_admin', 'admin', 'manager'), rejectLeaveRequest);

router.post('/vacancies',                    authorize('super_admin', 'admin', 'manager'), createVacancy);
router.put('/vacancies/:id/status',          authorize('super_admin', 'admin', 'manager'), updateVacancyStatus);
router.delete('/vacancies/:id',              authorize('super_admin', 'admin', 'manager'), deleteVacancy);
router.get('/vacancies/:id/applicants',      authorize('super_admin', 'admin', 'manager'), getApplicants);
router.put('/applications/:id/status',       authorize('super_admin', 'admin', 'manager'), updateApplicationStatus);

router.get('/documents',    authorize('super_admin', 'admin', 'manager'), getAllDocuments);
router.post('/documents',   authorize('super_admin', 'admin', 'manager'), generateDocument);
router.delete('/documents/:id', authorize('super_admin', 'admin', 'manager'), deleteDocument);

module.exports = router;
