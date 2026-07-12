// Public waitlist signup — no auth. Collects an email from the landing page
// and stores it in the Insforge `waitlist` table.
import { Router } from 'express';
import { addToWaitlist } from '../db/index.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.', code: 'INVALID_EMAIL' });
  }
  try {
    const result = await addToWaitlist(email, {
      source: req.body?.source || 'landing',
      referrer: req.get('referer') || null,
    });
    if (!result.ok) return res.status(500).json({ error: result.error || 'Could not request early access.' });
    return res.json({ ok: true, already: Boolean(result.already) });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: 'WAITLIST_ERROR' });
  }
});

export default router;
