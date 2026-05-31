require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const seed = async () => {
  try {
    const email = 'admin@procyclone.com';
    const password = 'Admin1234';
    const name = 'Super Admin';

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('✅ Super admin already exists');
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, 'super_admin')`,
      [name, email, hashedPassword]
    );

    console.log('✅ Super admin created successfully');
    console.log('   Email:    admin@procyclone.com');
    console.log('   Password: Admin1234');
    console.log('   ⚠️  Change this password after first login!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seed();
