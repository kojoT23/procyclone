const ROLES = {
  super_admin: {
    label: 'Super Admin',
    description: 'Full access to everything including system settings',
    permissions: [
      'manage_users','manage_products','manage_orders','manage_customers',
      'manage_riders','manage_cash','manage_expenses','view_reports',
      'manage_settings','delete_records','view_audit_log','manage_chat',
    ],
  },
  admin: {
    label: 'Admin',
    description: 'Full operational access, cannot manage system settings',
    permissions: [
      'manage_users','manage_products','manage_orders','manage_customers',
      'manage_riders','manage_cash','manage_expenses','view_reports',
      'delete_records','view_audit_log','manage_chat',
    ],
  },
  manager: {
    label: 'Manager',
    description: 'Manages day-to-day operations, reports and team',
    permissions: [
      'manage_products','manage_orders','manage_customers','manage_riders',
      'manage_expenses','view_reports','manage_chat',
    ],
  },
  accountant: {
    label: 'Accountant',
    description: 'Full financial access — cash, expenses, reports. No operational access.',
    permissions: [
      'manage_cash','manage_expenses','view_reports','manage_chat',
    ],
  },
  customer_support: {
    label: 'Customer Support',
    description: 'Handles customers and orders only. No financial access.',
    permissions: [
      'manage_orders','manage_customers','manage_chat',
    ],
  },
  cashier: {
    label: 'Cashier',
    description: 'Creates orders, manages customers and logs cash',
    permissions: [
      'manage_orders','manage_customers','manage_cash','manage_chat',
    ],
  },
  dispatcher: {
    label: 'Dispatcher',
    description: 'Assigns riders and updates delivery status',
    permissions: [
      'manage_orders','manage_riders','manage_chat',
    ],
  },
  warehouse: {
    label: 'Warehouse Staff',
    description: 'Manages products and stock levels',
    permissions: [
      'manage_products','manage_chat',
    ],
  },
  auditor: {
    label: 'Auditor',
    description: 'Read-only access to reports and audit log for compliance',
    permissions: [
      'view_reports','view_audit_log',
    ],
  },
  rider: {
    label: 'Rider',
    description: 'Views assigned deliveries and logs cash collections',
    permissions: [
      'manage_cash',
    ],
  },
};

const ALL_PERMISSIONS = [
  { key: 'manage_users',     label: 'Manage Users',     description: 'Add, edit, deactivate staff' },
  { key: 'manage_products',  label: 'Manage Products',  description: 'Add, edit, delete products & stock' },
  { key: 'manage_orders',    label: 'Manage Orders',    description: 'Create and update orders' },
  { key: 'manage_customers', label: 'Manage Customers', description: 'Add, edit customers, CRM access' },
  { key: 'manage_riders',    label: 'Manage Riders',    description: 'Assign riders, delivery board' },
  { key: 'manage_cash',      label: 'Manage Cash',      description: 'Log and verify cash collections' },
  { key: 'manage_expenses',  label: 'Manage Expenses',  description: 'Add and edit business expenses' },
  { key: 'view_reports',     label: 'View Reports',     description: 'Access reports and analytics' },
  { key: 'manage_settings',  label: 'Manage Settings',  description: 'System settings and configuration' },
  { key: 'delete_records',   label: 'Delete Records',   description: 'Permanently delete any record' },
  { key: 'view_audit_log',   label: 'View Audit Log',   description: 'See full system audit trail' },
  { key: 'manage_chat',      label: 'Internal Chat',    description: 'Access internal messaging' },
];

const hasPermission = (role, permission, overrides = {}) => {
  if (overrides[role]?.[permission] !== undefined) return overrides[role][permission];
  if (!ROLES[role]) return false;
  return ROLES[role].permissions.includes(permission);
};

const can = (permission) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ success: false, message: `Access denied. Required: ${permission}` });
    }
    next();
  };
};

module.exports = { ROLES, ALL_PERMISSIONS, hasPermission, can };
