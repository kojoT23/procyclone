const pool = require('../config/db');

/* ⚠️ RATES BELOW ARE APPROXIMATE — sanity-check against the current
   GRA (Ghana Revenue Authority) tables before this touches real
   payroll. Tax bands change; these are illustrative defaults so the
   feature works out of the box, not a substitute for checking the
   current official rates. */

const SSNIT_EMPLOYEE_RATE = 0.055; // 5.5% employee tier-1 contribution

// Monthly PAYE bands (chargeable income after SSNIT deduction), GHS
const PAYE_BANDS = [
  { upTo: 490,     rate: 0.00 },
  { upTo: 600,     rate: 0.05 },
  { upTo: 730,     rate: 0.10 },
  { upTo: 3896.67, rate: 0.175 },
  { upTo: 19896.67, rate: 0.25 },
  { upTo: 50416.67, rate: 0.30 },
  { upTo: Infinity, rate: 0.35 },
];

const calculatePAYE = (chargeableIncome) => {
  let remaining = chargeableIncome;
  let tax = 0;
  let lowerBound = 0;
  for (const band of PAYE_BANDS) {
    if (remaining <= 0) break;
    const bandWidth = band.upTo - lowerBound;
    const amountInBand = Math.min(remaining, bandWidth);
    tax += amountInBand * band.rate;
    remaining -= amountInBand;
    lowerBound = band.upTo;
  }
  return Math.round(tax * 100) / 100;
};

const sumLineItems = (items) => (items || []).reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

// ── My payslips (self-service) ──────────────────────────────────
const getMyPayslips = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `SELECT * FROM payslips WHERE user_id = $1 AND status != 'draft' ORDER BY period_start DESC`,
      [userId]
    );
    res.json({ success: true, payslips: result.rows });
  } catch (error) {
    console.error('getMyPayslips error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMyPayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM payslips WHERE id = $1 AND user_id = $2 AND status != 'draft'`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payslip not found' });
    }
    res.json({ success: true, payslip: result.rows[0] });
  } catch (error) {
    console.error('getMyPayslip error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: list all payslips ─────────────────────────────────────
const getAllPayslips = async (req, res) => {
  try {
    const { user_id, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let i = 1;

    if (user_id) { conditions.push(`p.user_id = $${i++}`); values.push(user_id); }
    if (status)  { conditions.push(`p.status = $${i++}`); values.push(status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(`SELECT COUNT(*) FROM payslips p ${where}`, values);
    const result = await pool.query(
      `SELECT p.*, u.name as user_name, u.role as user_role
       FROM payslips p
       JOIN users u ON p.user_id = u.id
       ${where} ORDER BY p.period_start DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...values, limit, offset]
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countResult.rows[0].count),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      payslips: result.rows,
    });
  } catch (error) {
    console.error('getAllPayslips error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: generate a payslip (draft, auto SSNIT/PAYE) ───────────
const generatePayslip = async (req, res) => {
  try {
    const { user_id, period_start, period_end, base_pay, allowances, deductions } = req.body;
    if (!user_id || !period_start || !period_end || base_pay == null) {
      return res.status(400).json({ success: false, message: 'user_id, period_start, period_end and base_pay are required' });
    }

    const basePay = parseFloat(base_pay);
    const allowancesTotal = sumLineItems(allowances);
    const manualDeductionsTotal = sumLineItems(deductions);

    const ssnitAmount = Math.round(basePay * SSNIT_EMPLOYEE_RATE * 100) / 100;
    const chargeableIncome = Math.max(0, basePay - ssnitAmount);
    const payeAmount = calculatePAYE(chargeableIncome);

    const grossPay = basePay + allowancesTotal;
    const netPay = grossPay - ssnitAmount - payeAmount - manualDeductionsTotal;

    const result = await pool.query(
      `INSERT INTO payslips
       (user_id, period_start, period_end, base_pay, allowances, deductions, ssnit_amount, paye_amount, gross_pay, net_pay, status, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', $11) RETURNING *`,
      [
        user_id, period_start, period_end, basePay,
        JSON.stringify(allowances || []), JSON.stringify(deductions || []),
        ssnitAmount, payeAmount, grossPay, netPay, req.user.id,
      ]
    );

    res.status(201).json({ success: true, message: 'Payslip generated as draft', payslip: result.rows[0] });
  } catch (error) {
    console.error('generatePayslip error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: finalize a draft (makes it visible to the employee) ───
const finalizePayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE payslips SET status = 'final', updated_at = NOW() WHERE id = $1 AND status = 'draft' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Draft payslip not found' });
    }
    res.json({ success: true, message: 'Payslip finalized', payslip: result.rows[0] });
  } catch (error) {
    console.error('finalizePayslip error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: mark as paid ───────────────────────────────────────────
const markPayslipPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE payslips SET status = 'paid', paid_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'final' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Finalized payslip not found' });
    }
    res.json({ success: true, message: 'Payslip marked as paid', payslip: result.rows[0] });
  } catch (error) {
    console.error('markPayslipPaid error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Admin: delete a draft ─────────────────────────────────────────
const deletePayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM payslips WHERE id = $1 AND status = 'draft' RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Draft payslip not found (only drafts can be deleted)' });
    }
    res.json({ success: true, message: 'Draft payslip deleted' });
  } catch (error) {
    console.error('deletePayslip error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getMyPayslips,
  getMyPayslip,
  getAllPayslips,
  generatePayslip,
  finalizePayslip,
  markPayslipPaid,
  deletePayslip,
};
