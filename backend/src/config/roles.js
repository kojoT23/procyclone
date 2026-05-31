// ProCyclone RBAC — role permissions map
// Each role lists exactly what it can do

const ROLES = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full access to everything including system settings',
    permissions: [
      'manage_users',
      'manage_products',
      'manage_orders',
      'manage_customers',
      'manage_riders',
      'manage_cash',
      'view_reports',
      'manage_settings',
      'delete_records',
    ],
  },

  admin: {
    label: 'Admin',
    description: 'Full operational access, cannot manage system settings',
    permissions: [
      'manage_users',
      'manage_products',
      'manage_orders',
      'manage_customers',
      'manage_riders',
      'manage_cash',
      'view_reports',
      'delete_records',
    ],
  },

  manager: {
    label: 'Manager',
    description: 'Can manage orders, products, customers and view reports',
    permissions: [
      'manage_products',
      'manage_orders',
      'manage_customers',
      'manage_riders',
      'view_reports',
    ],
  },

  cashier: {
    label: 'Cashier',
    description: 'Can create orders, manage customers and log cash',
    permissions: [
      'manage_orders',
      'manage_customers',
      'manage_cash',
    ],
  },

  dispatcher: {
    label: 'Dispatcher',
    description: 'Can assign riders and update delivery status',
    permissions: [
      'manage_orders',
      'manage_riders',
    ],
  },

  warehouse: {
    label: 'Warehouse Staff',
    description: 'Can manage products and stock levels',
    permissions: [
      'manage_products',
    ],
  },

  rider: {
    label: 'Rider',
    description: 'Can view assigned deliveries and log cash',
    permissions: [
      'manage_cash',
    ],
  },
};

// Helper — check if a role has a specific permission
const hasPermission = (role, permission) => {
  if (!ROLES[role]) return false;
  return ROLES[role].permissions.includes(permission);
};

// Middleware — check permission on a route
const can = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You do not have permission to: ${permission}`,
      });
    }
    next();
  };
};

module.exports = { ROLES, hasPermission, can };
