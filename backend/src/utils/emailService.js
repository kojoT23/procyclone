const nodemailer = require('nodemailer');

/* ═══════════════════════════════════════════════════════════════
   Gmail SMTP via nodemailer. Needs two env vars:
     GMAIL_USER         — the Gmail address sending from
     GMAIL_APP_PASSWORD — a 16-character App Password (NOT the
       regular Gmail password — Google blocks plain-password SMTP
       login). Generated at myaccount.google.com/apppasswords,
       which requires 2-Step Verification to be turned on first.
═══════════════════════════════════════════════════════════════ */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

/* ═══════════════════════════════════════════════════════════════
   sendOrderConfirmationEmail(...) — best-effort, fire-and-forget.
   Never throws: a broken/missing email setup or a bad address must
   never fail the order itself, which is the thing that actually
   matters. Silently does nothing if `to` is empty — email was always
   optional at checkout, WhatsApp is still the primary channel.
═══════════════════════════════════════════════════════════════ */
const sendOrderConfirmationEmail = async ({ to, customerName, orderNumber, items, deliveryFee, discount = 0, promoCode, total, paymentMethod }) => {
  if (!to) return;
  try {
    const rows = items.map(i => `
      <tr>
        <td style="padding:6px 0;">${i.quantity}× ${i.product_name}</td>
        <td style="padding:6px 0; text-align:right;">GH₵ ${(i.unit_price * i.quantity).toFixed(2)}</td>
      </tr>`).join('');

    await transporter.sendMail({
      from: `"Fleppystore" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Order ${orderNumber} confirmed — Fleppystore`,
      html: `
        <div style="font-family: -apple-system, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
          <h2 style="margin-bottom: 4px;">Thanks for your order${customerName ? `, ${customerName}` : ''}!</h2>
          <p style="color: #6b7280; margin-top: 0;">Order <strong>${orderNumber}</strong> has been placed.</p>
          <table style="width:100%; border-collapse: collapse; font-size: 14px;">
            ${rows}
            ${discount > 0 ? `<tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding:6px 0; color:#16a34a;">Discount${promoCode ? ` (${promoCode})` : ''}</td>
              <td style="padding:6px 0; text-align:right; color:#16a34a;">−GH₵ ${discount.toFixed(2)}</td>
            </tr>` : ''}
            <tr style="border-top: 1px solid #e5e7eb;">
              <td style="padding:6px 0;">Delivery</td>
              <td style="padding:6px 0; text-align:right;">${deliveryFee > 0 ? `GH₵ ${deliveryFee.toFixed(2)}` : 'To be confirmed'}</td>
            </tr>
            <tr style="font-weight: 700; font-size: 16px;">
              <td style="padding:10px 0;">Total</td>
              <td style="padding:10px 0; text-align:right;">GH₵ ${total.toFixed(2)}</td>
            </tr>
          </table>
          <p style="font-size: 13px; color: #6b7280;">
            ${paymentMethod === 'momo'
              ? "We'll verify your MoMo payment and get your order moving."
              : 'Have the exact cash ready — you\'ll pay the rider on delivery.'}
          </p>
          <p style="font-size: 13px; color: #6b7280;">Questions? Message us on WhatsApp any time.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('sendOrderConfirmationEmail error:', err.message);
  }
};

module.exports = { sendOrderConfirmationEmail };
