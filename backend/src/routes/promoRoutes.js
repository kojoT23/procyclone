const express = require('express');
const router = express.Router();
const { validatePromo } = require('../controllers/promoController');

// This endpoint is public, so cap how fast one visitor can try codes —
// otherwise someone could script guesses until they hit a real one.
// Simple in-memory counter: 20 tries per IP per 10 minutes.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 20;
const attempts = new Map();
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, rec] of attempts) if (rec.start < cutoff) attempts.delete(ip);
}, WINDOW_MS).unref();

const limiter = (req, res, next) => {
  const now = Date.now();
  const rec = attempts.get(req.ip);
  if (!rec || now - rec.start > WINDOW_MS) {
    attempts.set(req.ip, { start: now, count: 1 });
    return next();
  }
  if (rec.count >= MAX_TRIES) {
    return res.status(429).json({ success: false, message: 'Too many attempts — please wait a few minutes and try again.' });
  }
  rec.count += 1;
  next();
};

router.post('/validate', limiter, validatePromo);

module.exports = router;
