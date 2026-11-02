/* ═══════════════════════════════════════════════════════════════
   normalizeGhanaPhone(raw)

   Ghana mobile numbers come in as local (0XXXXXXXXX — 10 digits) or
   international (+233XXXXXXXXX / 233XXXXXXXXX — 9 digits after the
   country code). This normalizes any valid form to the local
   0XXXXXXXXX format, which is what's already stored in `customers`.

   This matters beyond "reject bad input": customerLookup.js matches
   customers BY PHONE STRING. Without normalizing first, "0244123456"
   and "+233244123456" — the same real number — would silently create
   two different customer records instead of matching one.

   Returns the normalized 10-digit string, or null if the input isn't
   a valid Ghana number in any recognized form.
═══════════════════════════════════════════════════════════════ */
const normalizeGhanaPhone = (raw) => {
  if (!raw || typeof raw !== 'string') return null;

  // Strip spaces, dashes, parens — keep only digits and a leading +
  let digits = raw.trim().replace(/[\s\-().]/g, '');

  if (digits.startsWith('+233')) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('233') && digits.length === 12) {
    digits = '0' + digits.slice(3);
  }

  // Must now be exactly 10 digits starting with 0
  if (!/^0\d{9}$/.test(digits)) return null;

  return digits;
};

const isValidGhanaPhone = (raw) => normalizeGhanaPhone(raw) !== null;

module.exports = { normalizeGhanaPhone, isValidGhanaPhone };
