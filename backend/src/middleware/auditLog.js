// backend/src/middleware/auditLog.js
// Wrap route handlers to automatically log key actions to audit_logs table

const pool = require('../config/db');

const audit = (action, entity, getEntityId = null, getDescription = null) => {
  return async (req, res, next) => {
    // Capture original json method
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      // Only log successful actions
      if (data?.success) {
        try {
          const entityId = getEntityId ? getEntityId(req, data) : null;
          const description = getDescription
            ? getDescription(req, data)
            : `${action} by ${req.user?.name || 'Unknown'}`;

          await pool.query(
            `INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              req.user?.id || null,
              action,
              entity || null,
              entityId,
              description,
              req.ip || req.connection?.remoteAddress || null,
            ]
          );
        } catch (err) {
          // Non-critical — never block the response
          console.error('Audit log error:', err.message);
        }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = audit;
