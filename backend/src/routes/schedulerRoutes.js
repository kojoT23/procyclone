const express = require('express');
const router = express.Router();
const {
  getSchedule,
  getDaySchedule,
  createTask,
  updateTaskStatus,
  deleteTask,
} = require('../controllers/schedulerController');
const { protect, authorize } = require('../middleware/auth');
const audit = require('../middleware/auditLog');

router.use(protect);

router.get('/', getSchedule); // own schedule by default; ?user_id= for privileged roles
router.get('/day', authorize('super_admin', 'admin', 'manager', 'customer_support'), getDaySchedule);

router.post('/', authorize('super_admin', 'admin', 'manager', 'customer_support'),
  audit('CREATE_SCHEDULED_TASK', 'scheduled_task',
    (req, data) => data.task?.id || null,
    (req, data) => `Created scheduled task${data.task?.id ? ' #' + data.task.id : ''}${req.body.rider_id ? ' for rider #' + req.body.rider_id : ''}`
  ),
  createTask
);

router.put('/:id/status', updateTaskStatus); // self or privileged, enforced in controller

router.delete('/:id', authorize('super_admin', 'admin', 'manager', 'customer_support'),
  audit('DELETE_SCHEDULED_TASK', 'scheduled_task',
    (req) => parseInt(req.params.id),
    (req, data) => data.message || `Deleted scheduled task #${req.params.id}`
  ),
  deleteTask
);

module.exports = router;
