const { normalizeGhanaPhone } = require('./phoneValidation');

/* ═══════════════════════════════════════════════════════════════
   findOrRestoreOrCreateCustomer(client, { name, phone, email, address })

   Shared by webhookController.js and posController.js (self-checkout).
   `customers.phone` has a plain UNIQUE constraint that is NOT partial
   on deleted_at — a soft-deleted customer still occupies their phone
   number. So "not found among live customers" is not the same as
   "safe to INSERT": if a deleted row holds this phone, a fresh INSERT
   would hit the unique constraint. Three cases:
     1. Live match (deleted_at IS NULL)      → reuse it
     2. Soft-deleted match (deleted_at SET)  → restore it (visible,
        deliberate — not a silent reattachment of a deleted record)
     3. No match at all                      → create it

   Must be called with a client that is inside a transaction
   (BEGIN already issued by the caller) since this can both SELECT
   and mutate — callers should COMMIT/ROLLBACK around it themselves.

   Returns the customer id.
═══════════════════════════════════════════════════════════════ */
const findOrRestoreOrCreateCustomer = async (client, { name, phone, email, address }) => {
  // Callers are expected to have already validated phone (so they can
  // return a clean 400 to their caller) — this normalizes it to the
  // same canonical form regardless of how it arrived, so a phone
  // lookup always matches the same customer no matter which format
  // (local/international) was used to enter it this time.
  const normalizedPhone = normalizeGhanaPhone(phone);
  if (!normalizedPhone) {
    throw new Error(`Invalid Ghana phone number: ${phone}`);
  }

  const existing = await client.query(
    'SELECT id, deleted_at FROM customers WHERE phone = $1',
    [normalizedPhone]
  );

  if (existing.rows.length > 0 && existing.rows[0].deleted_at === null) {
    return existing.rows[0].id;
  }

  if (existing.rows.length > 0) {
    const restored = await client.query(
      `UPDATE customers SET deleted_at = NULL, name = $1, email = COALESCE($2, email),
              address = COALESCE($3, address), updated_at = NOW()
       WHERE id = $4 RETURNING id`,
      [name || 'Customer', email || null, address || null, existing.rows[0].id]
    );
    return restored.rows[0].id;
  }

  const created = await client.query(
    `INSERT INTO customers (name, phone, email, address)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name || 'Customer', normalizedPhone, email || null, address || null]
  );
  return created.rows[0].id;
};

module.exports = { findOrRestoreOrCreateCustomer };
