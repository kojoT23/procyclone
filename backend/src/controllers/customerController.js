const pool = require("../config/db");

const getCustomers = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers ORDER BY created_at DESC");
    res.json({ success: true, count: result.rows.length, customers: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Name and phone are required" });
    }
    const result = await pool.query(
      "INSERT INTO customers (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, phone, email, address]
    );
    res.status(201).json({ success: true, message: "Customer created", customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      "UPDATE customers SET name=$1, phone=$2, email=$3, address=$4, updated_at=NOW() WHERE id=$5 RETURNING *",
      [name, phone, email, address, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    res.json({ success: true, message: "Customer updated", customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer };
